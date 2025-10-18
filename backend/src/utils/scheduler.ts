import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { sellers, searches } from '../db/schema';
import { eq } from 'drizzle-orm';
import { syncQueue } from '../jobs/syncProducts';

/**
 * Scheduler personalizado para manejar la sincronización periódica
 * No utiliza setInterval fijo, sino que programa la siguiente ejecución al finalizar la actual
 * Esto evita solapamientos y permite control granular del scheduler
 */

interface SchedulerConfig {
  intervalMs: number; // Intervalo entre ejecuciones en milisegundos
  maxConcurrentSyncs: number; // Máximo de sincronizaciones concurrentes
  retryDelayMs: number; // Delay entre reintentos en caso de error
}

export class Scheduler {
  private fastify: FastifyInstance;
  private config: SchedulerConfig;
  private isRunning: boolean = false;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(fastify: FastifyInstance, config: SchedulerConfig) {
    this.fastify = fastify;
    this.config = config;
  }

  /**
   * Inicia el scheduler
   * Verifica que no haya otra instancia corriendo antes de iniciar
   */
  async start(): Promise<void> {
    try {
      // Verificar si ya hay una instancia corriendo
      const isAlreadyRunning = await this.fastify.redis.get('scheduler:running');
      if (isAlreadyRunning) {
        this.fastify.log.warn('⚠️  Scheduler ya está ejecutándose en otra instancia');
        return;
      }

      this.isRunning = true;
      this.fastify.log.info('🚀 Iniciando scheduler de sincronización...');
      
      // Marcar como corriendo en Redis
      await this.fastify.redis.set('scheduler:running', '1', 'EX', 3600); // Expira en 1 hora como fallback
      
      // Ejecutar inmediatamente la primera sincronización
      await this.runScheduler();
      
    } catch (error) {
      this.fastify.log.error('❌ Error al iniciar scheduler:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Detiene el scheduler
   */
  async stop(): Promise<void> {
    try {
      this.isRunning = false;
      
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      // Limpiar flag en Redis
      await this.fastify.redis.del('scheduler:running');
      
      this.fastify.log.info('⏹️  Scheduler detenido correctamente');
    } catch (error) {
      this.fastify.log.error('❌ Error al detener scheduler:', error);
      throw error;
    }
  }

  /**
   * Función principal del scheduler que ejecuta la sincronización
   */
  private async runScheduler(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const startTime = Date.now();
    
    try {
      this.fastify.log.info('🔄 Iniciando ciclo de sincronización...');
      
      // Obtener vendedores activos para sincronización
      const activeSellers = await this.getActiveSellers();
      this.fastify.log.info(`📊 Encontrados ${activeSellers.length} vendedores activos`);

      // Obtener búsquedas activas
      const activeSearches = await this.getActiveSearches();
      this.fastify.log.info(`🔍 Encontradas ${activeSearches.length} búsquedas activas`);

      // Procesar vendedores en lotes para evitar sobrecarga
      await this.processSellersInBatches(activeSellers);

      // Procesar búsquedas
      await this.processSearches(activeSearches);

      const duration = Date.now() - startTime;
      this.fastify.log.info(`✅ Ciclo de sincronización completado en ${duration}ms`);

    } catch (error) {
      this.fastify.log.error('❌ Error durante la sincronización:', error);
      
      // En caso de error, esperar un poco más antes del siguiente intento
      await this.scheduleNext(this.config.retryDelayMs);
      return;
    }

    // Programar la siguiente ejecución
    await this.scheduleNext(this.config.intervalMs);
  }

  /**
   * Obtiene todos los vendedores activos para sincronización
   */
  private async getActiveSellers(): Promise<Array<{ id: number; mlUserId: string; mlNickname: string | null }>> {
    try {
      const sellersList = await db.select({
        id: sellers.id,
        mlUserId: sellers.mlUserId,
        mlNickname: sellers.mlNickname
      })
      .from(sellers)
      .where(eq(sellers.isActive, true));

      return sellersList;
    } catch (error) {
      this.fastify.log.error('Error al obtener vendedores activos:', error);
      return [];
    }
  }

  /**
   * Obtiene todas las búsquedas activas
   */
  private async getActiveSearches(): Promise<Array<{ id: number; query: string; limitItems: number; sellerId: number | null }>> {
    try {
      const searchesList = await db.select({
        id: searches.id,
        query: searches.query,
        limitItems: searches.limitItems,
        sellerId: searches.sellerId
      })
      .from(searches)
      .where(eq(searches.isActive, true));

      return searchesList;
    } catch (error) {
      this.fastify.log.error('Error al obtener búsquedas activas:', error);
      return [];
    }
  }

  /**
   * Procesa vendedores en lotes para evitar sobrecarga de la API
   */
  private async processSellersInBatches(sellersList: Array<{ id: number; mlUserId: string; mlNickname: string | null }>): Promise<void> {
    const batchSize = Math.min(this.config.maxConcurrentSyncs, 5); // Máximo 5 concurrentes
    
    for (let i = 0; i < sellersList.length; i += batchSize) {
      const batch = sellersList.slice(i, i + batchSize);
      
      // Procesar lote en paralelo
      const promises = batch.map(seller => this.syncSeller(seller));
      await Promise.allSettled(promises);
      
      // Pequeña pausa entre lotes para no sobrecargar la API
      if (i + batchSize < sellersList.length) {
        await this.delay(1000); // 1 segundo entre lotes
      }
    }
  }

  /**
   * Sincroniza un vendedor específico
   */
  private async syncSeller(seller: { id: number; mlUserId: string; mlNickname: string | null }): Promise<void> {
    try {
      this.fastify.log.info(`🔄 Sincronizando vendedor: ${seller.mlNickname || seller.mlUserId}`);
      
      // Encolar job de sincronización para el vendedor
      await syncQueue.add('sync-seller', {
        sellerId: seller.id,
        mlUserId: seller.mlUserId,
        type: 'seller'
      }, {
        priority: 1, // Alta prioridad para vendedores
        delay: 0, // Sin delay
        attempts: 3, // 3 intentos en caso de fallo
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      });

    } catch (error) {
      this.fastify.log.error(`❌ Error al encolar sincronización para vendedor ${seller.mlUserId}:`, error);
    }
  }

  /**
   * Procesa todas las búsquedas activas
   */
  private async processSearches(searchesList: Array<{ id: number; query: string; limitItems: number; sellerId: number | null }>): Promise<void> {
    for (const search of searchesList) {
      try {
        this.fastify.log.info(`🔍 Procesando búsqueda: "${search.query}"`);
        
        // Encolar job de búsqueda
        await syncQueue.add('sync-search', {
          searchId: search.id,
          query: search.query,
          limitItems: search.limitItems,
          sellerId: search.sellerId,
          type: 'search'
        }, {
          priority: 2, // Prioridad media para búsquedas
          delay: 0,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 3000
          }
        });

      } catch (error) {
        this.fastify.log.error(`❌ Error al encolar búsqueda "${search.query}":`, error);
      }
    }
  }

  /**
   * Programa la siguiente ejecución del scheduler
   */
  private async scheduleNext(delayMs: number): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Limpiar timeout anterior si existe
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(async () => {
      // Limpiar flag de ejecución en Redis antes de la próxima ejecución
      await this.fastify.redis.del('scheduler:running');
      
      // Ejecutar siguiente ciclo
      await this.runScheduler();
    }, delayMs);

    const nextExecution = new Date(Date.now() + delayMs);
    this.fastify.log.info(`⏰ Próxima ejecución programada para: ${nextExecution.toISOString()}`);
  }

  /**
   * Utilidad para crear delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtiene el estado actual del scheduler
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    nextExecution: Date | null;
    config: SchedulerConfig;
  }> {
    const nextExecution = this.timeoutId ? 
      new Date(Date.now() + (this.timeoutId as any)._idleStart + (this.timeoutId as any)._idleTimeout) : 
      null;

    return {
      isRunning: this.isRunning,
      nextExecution,
      config: this.config
    };
  }
}

// Función helper para crear instancia del scheduler
export function createScheduler(fastify: FastifyInstance): Scheduler {
  const config: SchedulerConfig = {
    intervalMs: parseInt(process.env.SCHEDULER_INTERVAL || '300000'), // 5 minutos por defecto
    maxConcurrentSyncs: parseInt(process.env.MAX_CONCURRENT_SYNCS || '3'),
    retryDelayMs: parseInt(process.env.SCHEDULER_RETRY_DELAY || '60000') // 1 minuto para reintentos
  };

  return new Scheduler(fastify, config);
}
