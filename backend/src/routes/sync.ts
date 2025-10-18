import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { syncQueue } from '../jobs/syncProducts';
import { createScheduler } from '../utils/scheduler';
import { db } from '../db';
import { sellers, searches, syncHistory } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * Rutas para controlar la sincronización y el scheduler
 * Permite iniciar/parar sincronizaciones, ver estado y historial
 */

// Esquemas de validación
const sellerSyncSchema = z.object({
  sellerId: z.number().int().positive('ID del vendedor debe ser un número positivo')
});

const searchSyncSchema = z.object({
  searchId: z.number().int().positive('ID de la búsqueda debe ser un número positivo')
});

const schedulerControlSchema = z.object({
  action: z.enum(['start', 'stop', 'status'], {
    errorMap: () => ({ message: 'Acción debe ser: start, stop o status' })
  })
});

export async function syncRoutes(fastify: FastifyInstance) {
  // Variable para mantener referencia al scheduler
  let scheduler: ReturnType<typeof createScheduler> | null = null;

  /**
   * POST /sync/scheduler
   * Controla el scheduler (iniciar, parar, ver estado)
   */
  fastify.post('/sync/scheduler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { action } = schedulerControlSchema.parse(request.body);

      switch (action) {
        case 'start':
          if (!scheduler) {
            scheduler = createScheduler(fastify);
          }
          await scheduler.start();
          
          reply.send({
            success: true,
            message: 'Scheduler iniciado correctamente',
            data: await scheduler.getStatus()
          });
          break;

        case 'stop':
          if (scheduler) {
            await scheduler.stop();
            scheduler = null;
            
            reply.send({
              success: true,
              message: 'Scheduler detenido correctamente'
            });
          } else {
            reply.send({
              success: true,
              message: 'Scheduler ya estaba detenido'
            });
          }
          break;

        case 'status':
          const status = scheduler ? await scheduler.getStatus() : { isRunning: false, nextExecution: null };
          
          reply.send({
            success: true,
            message: 'Estado del scheduler obtenido',
            data: status
          });
          break;
      }
    } catch (error) {
      fastify.log.error('Error en control del scheduler:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parámetros inválidos',
          details: error.errors
        });
      }

      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo controlar el scheduler'
      });
    }
  });

  /**
   * POST /sync/seller/:sellerId
   * Fuerza la sincronización de un vendedor específico
   */
  fastify.post('/sync/seller/:sellerId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { sellerId } = sellerSyncSchema.parse(request.params);

      // Verificar que el vendedor existe
      const seller = await db.select()
        .from(sellers)
        .where(eq(sellers.id, sellerId))
        .limit(1);

      if (seller.length === 0) {
        return reply.status(404).send({
          error: 'Vendedor no encontrado',
          message: `No se encontró un vendedor con ID ${sellerId}`
        });
      }

      // Encolar trabajo de sincronización
      const job = await syncQueue.add('sync-seller', {
        sellerId: sellerId,
        mlUserId: seller[0].mlUserId,
        type: 'seller'
      }, {
        priority: 1, // Alta prioridad para sincronizaciones manuales
        delay: 0,
        attempts: 3
      });

      reply.send({
        success: true,
        message: 'Sincronización del vendedor encolada correctamente',
        data: {
          jobId: job.id,
          sellerId: sellerId,
          sellerNickname: seller[0].mlNickname
        }
      });
    } catch (error) {
      fastify.log.error('Error al sincronizar vendedor:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parámetros inválidos',
          details: error.errors
        });
      }

      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo encolar la sincronización del vendedor'
      });
    }
  });

  /**
   * POST /sync/search/:searchId
   * Fuerza la ejecución de una búsqueda específica
   */
  fastify.post('/sync/search/:searchId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { searchId } = searchSyncSchema.parse(request.params);

      // Verificar que la búsqueda existe
      const search = await db.select()
        .from(searches)
        .where(eq(searches.id, searchId))
        .limit(1);

      if (search.length === 0) {
        return reply.status(404).send({
          error: 'Búsqueda no encontrada',
          message: `No se encontró una búsqueda con ID ${searchId}`
        });
      }

      // Encolar trabajo de búsqueda
      const job = await syncQueue.add('sync-search', {
        searchId: searchId,
        query: search[0].query,
        limitItems: search[0].limitItems,
        sellerId: search[0].sellerId,
        type: 'search'
      }, {
        priority: 2,
        delay: 0,
        attempts: 3
      });

      reply.send({
        success: true,
        message: 'Búsqueda encolada correctamente',
        data: {
          jobId: job.id,
          searchId: searchId,
          query: search[0].query
        }
      });
    } catch (error) {
      fastify.log.error('Error al ejecutar búsqueda:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parámetros inválidos',
          details: error.errors
        });
      }

      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo encolar la búsqueda'
      });
    }
  });

  /**
   * POST /sync/all
   * Sincroniza todos los vendedores activos y búsquedas activas
   */
  fastify.post('/sync/all', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Obtener vendedores activos
      const activeSellers = await db.select({
        id: sellers.id,
        mlUserId: sellers.mlUserId,
        mlNickname: sellers.mlNickname
      })
      .from(sellers)
      .where(eq(sellers.isActive, true));

      // Obtener búsquedas activas
      const activeSearches = await db.select({
        id: searches.id,
        query: searches.query,
        limitItems: searches.limitItems,
        sellerId: searches.sellerId
      })
      .from(searches)
      .where(eq(searches.isActive, true));

      const jobs = [];

      // Encolar sincronización de vendedores
      for (const seller of activeSellers) {
        const job = await syncQueue.add('sync-seller', {
          sellerId: seller.id,
          mlUserId: seller.mlUserId,
          type: 'seller'
        }, {
          priority: 1,
          delay: 0,
          attempts: 3
        });
        jobs.push({ type: 'seller', jobId: job.id, sellerId: seller.id });
      }

      // Encolar búsquedas
      for (const search of activeSearches) {
        const job = await syncQueue.add('sync-search', {
          searchId: search.id,
          query: search.query,
          limitItems: search.limitItems,
          sellerId: search.sellerId,
          type: 'search'
        }, {
          priority: 2,
          delay: 0,
          attempts: 3
        });
        jobs.push({ type: 'search', jobId: job.id, searchId: search.id });
      }

      reply.send({
        success: true,
        message: 'Sincronización masiva encolada correctamente',
        data: {
          totalJobs: jobs.length,
          sellerJobs: jobs.filter(j => j.type === 'seller').length,
          searchJobs: jobs.filter(j => j.type === 'search').length,
          jobs: jobs
        }
      });
    } catch (error) {
      fastify.log.error('Error en sincronización masiva:', error);
      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo encolar la sincronización masiva'
      });
    }
  });

  /**
   * GET /sync/status
   * Obtiene el estado actual de las colas y trabajos
   */
  fastify.get('/sync/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Obtener estadísticas de la cola
      const waiting = await syncQueue.getWaiting();
      const active = await syncQueue.getActive();
      const completed = await syncQueue.getCompleted();
      const failed = await syncQueue.getFailed();

      // Obtener estadísticas del scheduler
      const schedulerStatus = scheduler ? await scheduler.getStatus() : { isRunning: false, nextExecution: null };

      reply.send({
        success: true,
        message: 'Estado de sincronización obtenido',
        data: {
          queue: {
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            total: waiting.length + active.length + completed.length + failed.length
          },
          scheduler: schedulerStatus,
          lastSync: {
            sellers: await this.getLastSyncInfo('seller'),
            searches: await this.getLastSyncInfo('search')
          }
        }
      });
    } catch (error) {
      fastify.log.error('Error al obtener estado de sincronización:', error);
      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el estado de sincronización'
      });
    }
  });

  /**
   * GET /sync/history
   * Obtiene el historial de sincronizaciones
   */
  fastify.get('/sync/history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { limit = 50, offset = 0, type } = request.query as {
        limit?: number;
        offset?: number;
        type?: 'seller' | 'search';
      };

      let query = db.select()
        .from(syncHistory)
        .orderBy(desc(syncHistory.syncedAt))
        .limit(limit)
        .offset(offset);

      // Filtrar por tipo si se especifica
      if (type) {
        query = query.where(eq(syncHistory.type, type));
      }

      const history = await query;

      reply.send({
        success: true,
        message: 'Historial de sincronización obtenido',
        data: history
      });
    } catch (error) {
      fastify.log.error('Error al obtener historial de sincronización:', error);
      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener el historial de sincronización'
      });
    }
  });

  /**
   * Helper para obtener información de la última sincronización
   */
  async function getLastSyncInfo(type: 'seller' | 'search') {
    try {
      const lastSync = await db.select()
        .from(syncHistory)
        .where(eq(syncHistory.type, type))
        .orderBy(desc(syncHistory.syncedAt))
        .limit(1);

      return lastSync.length > 0 ? lastSync[0] : null;
    } catch (error) {
      fastify.log.error(`Error al obtener última sincronización ${type}:`, error);
      return null;
    }
  }

  // Inicializar scheduler al cargar las rutas
  if (!scheduler) {
    scheduler = createScheduler(fastify);
  }
}
