import { Queue, Worker, Job } from 'bullmq';
import { createRedisClient } from '../utils/redis';
import { db } from '../db';
import { sellers, products, syncHistory } from '../db/schema';
import { mercadoLibreService } from '../services/mercadolibre';
import { eq, and } from 'drizzle-orm';

/**
 * Sistema de colas BullMQ para manejar la sincronización de productos
 * Procesa trabajos de sincronización de vendedores y búsquedas de forma asíncrona
 */

// Cliente Redis para BullMQ
const redisClient = createRedisClient();

// Cola principal de sincronización
export const syncQueue = new Queue('mltrack-sync', {
  connection: redisClient,
  defaultJobOptions: {
    removeOnComplete: 100, // Mantener últimos 100 trabajos completados
    removeOnFail: 50, // Mantener últimos 50 trabajos fallidos
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
});

/**
 * Worker para procesar trabajos de sincronización de vendedores
 */
const sellerSyncWorker = new Worker(
  'mltrack-sync',
  async (job: Job) => {
    const { sellerId, mlUserId, type } = job.data;
    
    console.log(`🔄 Procesando sincronización de vendedor: ${mlUserId}`);
    
    try {
      // Obtener información del vendedor
      const seller = await db.select()
        .from(sellers)
        .where(eq(sellers.id, sellerId))
        .limit(1);

      if (seller.length === 0) {
        throw new Error(`Vendedor con ID ${sellerId} no encontrado`);
      }

      const sellerData = seller[0];
      const startTime = Date.now();

      // Obtener items del vendedor desde MercadoLibre
      const itemsResponse = await mercadoLibreService.getSellerItems(
        sellerData.mlUserId,
        sellerData.accessToken,
        0, // offset
        50 // limit inicial
      );

      const itemIds = itemsResponse.results;
      console.log(`📦 Encontrados ${itemIds.length} items para sincronizar`);

      // Si hay más items, obtener todos en paginación
      let allItemIds = [...itemIds];
      let offset = 50;
      
      while (itemsResponse.paging.total > offset) {
        const nextPageResponse = await mercadoLibreService.getSellerItems(
          sellerData.mlUserId,
          sellerData.accessToken,
          offset,
          50
        );
        allItemIds.push(...nextPageResponse.results);
        offset += 50;
      }

      console.log(`📊 Total de items a procesar: ${allItemIds.length}`);

      // Procesar items en lotes de 20 (límite de la API de MercadoLibre)
      let newItemsCount = 0;
      let updatedItemsCount = 0;
      let errorsCount = 0;

      for (let i = 0; i < allItemIds.length; i += 20) {
        const batch = allItemIds.slice(i, i + 20);
        
        try {
          // Obtener detalles de los items en lote
          const itemsDetails = await mercadoLibreService.getItemsDetails(
            batch,
            sellerData.accessToken
          );

          // Procesar cada item del lote
          for (const item of itemsDetails) {
            try {
              const existingProduct = await db.select()
                .from(products)
                .where(eq(products.mlItemId, item.id))
                .limit(1);

              const productData = {
                mlItemId: item.id,
                sellerId: sellerId,
                title: item.title,
                price: item.price?.toString() || '0',
                originalPrice: item.original_price?.toString() || null,
                pictureUrl: item.pictures?.[0]?.url || null,
                logisticType: item.shipping?.logistic_type || null,
                dateCreatedMl: new Date(item.date_created),
                dateUpdatedMl: new Date(item.date_updated),
                lastSyncedAt: new Date()
              };

              if (existingProduct.length === 0) {
                // Producto nuevo
                await db.insert(products).values(productData);
                newItemsCount++;
                console.log(`➕ Nuevo producto: ${item.title}`);
              } else {
                // Verificar si necesita actualización
                const existing = existingProduct[0];
                const needsUpdate = 
                  existing.price !== productData.price ||
                  existing.originalPrice !== productData.originalPrice ||
                  existing.title !== productData.title ||
                  existing.pictureUrl !== productData.pictureUrl ||
                  existing.logisticType !== productData.logisticType ||
                  new Date(existing.dateUpdatedMl).getTime() !== new Date(productData.dateUpdatedMl).getTime();

                if (needsUpdate) {
                  await db.update(products)
                    .set({
                      ...productData,
                      updatedAt: new Date()
                    })
                    .where(eq(products.mlItemId, item.id));
                  updatedItemsCount++;
                  console.log(`🔄 Producto actualizado: ${item.title}`);
                }
              }
            } catch (itemError) {
              console.error(`❌ Error procesando item ${item.id}:`, itemError);
              errorsCount++;
            }
          }

          // Pequeña pausa entre lotes para no sobrecargar la API
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (batchError) {
          console.error(`❌ Error procesando lote de items:`, batchError);
          errorsCount += batch.length;
        }
      }

      // Actualizar timestamp de última sincronización del vendedor
      await db.update(sellers)
        .set({
          lastSyncAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(sellers.id, sellerId));

      // Registrar en historial de sincronización
      const duration = Date.now() - startTime;
      await db.insert(syncHistory).values({
        sellerId: sellerId,
        type: 'seller',
        newItems: newItemsCount,
        updatedItems: updatedItemsCount,
        deletedItems: 0, // TODO: Implementar detección de items eliminados
        errorsCount: errorsCount,
        durationMs: duration,
        status: errorsCount === 0 ? 'completed' : 'partial',
        syncedAt: new Date()
      });

      console.log(`✅ Sincronización completada para vendedor ${mlUserId}:`);
      console.log(`   - Nuevos: ${newItemsCount}`);
      console.log(`   - Actualizados: ${updatedItemsCount}`);
      console.log(`   - Errores: ${errorsCount}`);
      console.log(`   - Duración: ${duration}ms`);

      // Actualizar progreso del job
      job.updateProgress(100);

    } catch (error) {
      console.error(`❌ Error en sincronización de vendedor ${mlUserId}:`, error);
      
      // Registrar error en historial
      await db.insert(syncHistory).values({
        sellerId: sellerId,
        type: 'seller',
        newItems: 0,
        updatedItems: 0,
        deletedItems: 0,
        errorsCount: 1,
        status: 'failed',
        errorMessage: error.message,
        syncedAt: new Date()
      });

      throw error;
    }
  },
  {
    connection: redisClient,
    concurrency: 3, // Procesar máximo 3 vendedores simultáneamente
  }
);

/**
 * Worker para procesar trabajos de sincronización de búsquedas
 */
const searchSyncWorker = new Worker(
  'mltrack-sync',
  async (job: Job) => {
    const { searchId, query, limitItems, sellerId, type } = job.data;
    
    console.log(`🔍 Procesando búsqueda: "${query}"`);
    
    try {
      const startTime = Date.now();

      // Obtener el vendedor para usar su token (si es búsqueda específica)
      let accessToken = process.env.ML_ACCESS_TOKEN; // Token por defecto
      
      if (sellerId) {
        const seller = await db.select()
          .from(sellers)
          .where(eq(sellers.id, sellerId))
          .limit(1);
        
        if (seller.length > 0) {
          accessToken = seller[0].accessToken;
        }
      }

      // Realizar búsqueda en MercadoLibre
      const searchResults = await mercadoLibreService.searchItems(
        query,
        accessToken,
        'MLA', // Argentina
        limitItems,
        'date_desc'
      );

      console.log(`🔍 Encontrados ${searchResults.results.length} resultados para "${query}"`);

      // Procesar resultados de la búsqueda
      let newResultsCount = 0;
      let updatedResultsCount = 0;
      let errorsCount = 0;

      for (let i = 0; i < searchResults.results.length; i++) {
        const item = searchResults.results[i];
        
        try {
          // Verificar si ya existe este resultado
          const existingResult = await db.select()
            .from(searchResults)
            .where(
              and(
                eq(searchResults.searchId, searchId),
                eq(searchResults.mlItemId, item.id)
              )
            )
            .limit(1);

          const resultData = {
            searchId: searchId,
            mlItemId: item.id,
            title: item.title,
            price: item.price?.toString() || '0',
            originalPrice: item.original_price?.toString() || null,
            pictureUrl: item.thumbnail || null,
            sellerId: item.seller?.id ? parseInt(item.seller.id) : null,
            sellerNickname: item.seller?.nickname || null,
            position: i + 1,
            foundAt: new Date(),
            isNew: existingResult.length === 0
          };

          if (existingResult.length === 0) {
            // Resultado nuevo
            await db.insert(searchResults).values(resultData);
            newResultsCount++;
          } else {
            // Actualizar posición si cambió
            const existing = existingResult[0];
            if (existing.position !== resultData.position) {
              await db.update(searchResults)
                .set({
                  position: resultData.position,
                  foundAt: new Date()
                })
                .where(eq(searchResults.id, existing.id));
              updatedResultsCount++;
            }
          }

        } catch (itemError) {
          console.error(`❌ Error procesando resultado de búsqueda ${item.id}:`, itemError);
          errorsCount++;
        }
      }

      // Actualizar timestamp de última ejecución de la búsqueda
      await db.update(searches)
        .set({
          lastExecutedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(searches.id, searchId));

      // Registrar en historial de sincronización
      const duration = Date.now() - startTime;
      await db.insert(syncHistory).values({
        searchId: searchId,
        type: 'search',
        newItems: newResultsCount,
        updatedItems: updatedResultsCount,
        deletedItems: 0,
        errorsCount: errorsCount,
        durationMs: duration,
        status: errorsCount === 0 ? 'completed' : 'partial',
        syncedAt: new Date()
      });

      console.log(`✅ Búsqueda completada para "${query}":`);
      console.log(`   - Nuevos resultados: ${newResultsCount}`);
      console.log(`   - Actualizados: ${updatedResultsCount}`);
      console.log(`   - Errores: ${errorsCount}`);
      console.log(`   - Duración: ${duration}ms`);

      // Actualizar progreso del job
      job.updateProgress(100);

    } catch (error) {
      console.error(`❌ Error en búsqueda "${query}":`, error);
      
      // Registrar error en historial
      await db.insert(syncHistory).values({
        searchId: searchId,
        type: 'search',
        newItems: 0,
        updatedItems: 0,
        deletedItems: 0,
        errorsCount: 1,
        status: 'failed',
        errorMessage: error.message,
        syncedAt: new Date()
      });

      throw error;
    }
  },
  {
    connection: redisClient,
    concurrency: 5, // Procesar máximo 5 búsquedas simultáneamente
  }
);

// Manejar eventos de los workers
sellerSyncWorker.on('completed', (job) => {
  console.log(`✅ Trabajo de sincronización completado: ${job.id}`);
});

sellerSyncWorker.on('failed', (job, err) => {
  console.error(`❌ Trabajo de sincronización falló: ${job?.id}`, err);
});

searchSyncWorker.on('completed', (job) => {
  console.log(`✅ Trabajo de búsqueda completado: ${job.id}`);
});

searchSyncWorker.on('failed', (job, err) => {
  console.error(`❌ Trabajo de búsqueda falló: ${job?.id}`, err);
});

// Exportar workers para control externo
export { sellerSyncWorker, searchSyncWorker };
