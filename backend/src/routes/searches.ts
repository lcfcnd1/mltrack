import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { searches, searchResults, sellers } from '../db/schema';
import { eq, desc, and, ilike } from 'drizzle-orm';

/**
 * Rutas para manejar las búsquedas guardadas y sus resultados
 * Permite crear, editar, eliminar búsquedas y consultar resultados
 */

// Esquemas de validación
const createSearchSchema = z.object({
  query: z.string().min(1, 'Query de búsqueda requerida').max(500, 'Query demasiado larga'),
  limitItems: z.number().int().min(1, 'Límite mínimo de 1 item').max(1000, 'Límite máximo de 1000 items').default(50),
  sellerId: z.number().int().positive('ID del vendedor debe ser positivo').optional()
});

const updateSearchSchema = z.object({
  query: z.string().min(1).max(500).optional(),
  limitItems: z.number().int().min(1).max(1000).optional(),
  isActive: z.boolean().optional()
});

const searchIdSchema = z.object({
  searchId: z.number().int().positive('ID de la búsqueda debe ser positivo')
});

const searchResultsQuerySchema = z.object({
  searchId: z.number().int().positive(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  isNew: z.boolean().optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional()
});

export async function searchRoutes(fastify: FastifyInstance) {
  /**
   * POST /searches
   * Crea una nueva búsqueda
   */
  fastify.post('/searches', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { query, limitItems, sellerId } = createSearchSchema.parse(request.body);

      // Verificar que el vendedor existe si se proporciona
      if (sellerId) {
        const seller = await db.select()
          .from(sellers)
          .where(eq(sellers.id, sellerId))
          .limit(1);

        if (seller.length === 0) {
          return reply.status(400).send({
            error: 'Vendedor no encontrado',
            message: `No se encontró un vendedor con ID ${sellerId}`
          });
        }
      }

      // Crear la búsqueda
      const [newSearch] = await db.insert(searches).values({
        query,
        limitItems,
        sellerId: sellerId || null,
        isActive: true
      }).returning();

      reply.status(201).send({
        success: true,
        message: 'Búsqueda creada correctamente',
        data: newSearch
      });
    } catch (error) {
      fastify.log.error('Error al crear búsqueda:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parámetros inválidos',
          details: error.errors
        });
      }

      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo crear la búsqueda'
      });
    }
  });

  /**
   * GET /searches
   * Obtiene todas las búsquedas con opciones de filtrado
   */
  fastify.get('/searches', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { 
        limit = 50, 
        offset = 0, 
        isActive, 
        sellerId,
        query 
      } = request.query as {
        limit?: number;
        offset?: number;
        isActive?: boolean;
        sellerId?: number;
        query?: string;
      };

      let dbQuery = db.select({
        id: searches.id,
        query: searches.query,
        limitItems: searches.limitItems,
        isActive: searches.isActive,
        lastExecutedAt: searches.lastExecutedAt,
        createdAt: searches.createdAt,
        updatedAt: searches.updatedAt,
        sellerNickname: sellers.mlNickname
      })
      .from(searches)
      .leftJoin(sellers, eq(searches.sellerId, sellers.id))
      .orderBy(desc(searches.createdAt))
      .limit(limit)
      .offset(offset);

      // Aplicar filtros
      const conditions = [];
      
      if (isActive !== undefined) {
        conditions.push(eq(searches.isActive, isActive));
      }
      
      if (sellerId) {
        conditions.push(eq(searches.sellerId, sellerId));
      }
      
      if (query) {
        conditions.push(ilike(searches.query, `%${query}%`));
      }

      if (conditions.length > 0) {
        dbQuery = dbQuery.where(and(...conditions));
      }

      const searchesList = await dbQuery;

      // Obtener conteo total para paginación
      let countQuery = db.select({ count: db.$count() })
        .from(searches)
        .leftJoin(sellers, eq(searches.sellerId, sellers.id));

      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions));
      }

      const [{ count: totalCount }] = await countQuery;

      reply.send({
        success: true,
        message: 'Búsquedas obtenidas correctamente',
        data: {
          searches: searchesList,
          pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: offset + limit < totalCount
          }
        }
      });
    } catch (error) {
      fastify.log.error('Error al obtener búsquedas:', error);
      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener las búsquedas'
      });
    }
  });

  /**
   * GET /searches/:searchId
   * Obtiene una búsqueda específica
   */
  fastify.get('/searches/:searchId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { searchId } = searchIdSchema.parse(request.params);

      const search = await db.select({
        id: searches.id,
        query: searches.query,
        limitItems: searches.limitItems,
        isActive: searches.isActive,
        lastExecutedAt: searches.lastExecutedAt,
        createdAt: searches.createdAt,
        updatedAt: searches.updatedAt,
        sellerId: searches.sellerId,
        sellerNickname: sellers.mlNickname
      })
      .from(searches)
      .leftJoin(sellers, eq(searches.sellerId, sellers.id))
      .where(eq(searches.id, searchId))
      .limit(1);

      if (search.length === 0) {
        return reply.status(404).send({
          error: 'Búsqueda no encontrada',
          message: `No se encontró una búsqueda con ID ${searchId}`
        });
      }

      reply.send({
        success: true,
        message: 'Búsqueda obtenida correctamente',
        data: search[0]
      });
    } catch (error) {
      fastify.log.error('Error al obtener búsqueda:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parámetros inválidos',
          details: error.errors
        });
      }

      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener la búsqueda'
      });
    }
  });

  /**
   * PUT /searches/:searchId
   * Actualiza una búsqueda existente
   */
  fastify.put('/searches/:searchId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { searchId } = searchIdSchema.parse(request.params);
      const updateData = updateSearchSchema.parse(request.body);

      // Verificar que la búsqueda existe
      const existingSearch = await db.select()
        .from(searches)
        .where(eq(searches.id, searchId))
        .limit(1);

      if (existingSearch.length === 0) {
        return reply.status(404).send({
          error: 'Búsqueda no encontrada',
          message: `No se encontró una búsqueda con ID ${searchId}`
        });
      }

      // Actualizar la búsqueda
      const [updatedSearch] = await db.update(searches)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(searches.id, searchId))
        .returning();

      reply.send({
        success: true,
        message: 'Búsqueda actualizada correctamente',
        data: updatedSearch
      });
    } catch (error) {
      fastify.log.error('Error al actualizar búsqueda:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parámetros inválidos',
          details: error.errors
        });
      }

      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo actualizar la búsqueda'
      });
    }
  });

  /**
   * DELETE /searches/:searchId
   * Elimina una búsqueda y todos sus resultados
   */
  fastify.delete('/searches/:searchId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { searchId } = searchIdSchema.parse(request.params);

      // Verificar que la búsqueda existe
      const existingSearch = await db.select()
        .from(searches)
        .where(eq(searches.id, searchId))
        .limit(1);

      if (existingSearch.length === 0) {
        return reply.status(404).send({
          error: 'Búsqueda no encontrada',
          message: `No se encontró una búsqueda con ID ${searchId}`
        });
      }

      // Eliminar la búsqueda (esto también eliminará los resultados por foreign key)
      await db.delete(searches)
        .where(eq(searches.id, searchId));

      reply.send({
        success: true,
        message: 'Búsqueda eliminada correctamente'
      });
    } catch (error) {
      fastify.log.error('Error al eliminar búsqueda:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parámetros inválidos',
          details: error.errors
        });
      }

      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo eliminar la búsqueda'
      });
    }
  });

  /**
   * GET /searches/:searchId/results
   * Obtiene los resultados de una búsqueda específica
   */
  fastify.get('/searches/:searchId/results', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { searchId, limit, offset, isNew, minPrice, maxPrice } = searchResultsQuerySchema.parse({
        ...request.params,
        ...request.query
      });

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

      // Construir query para resultados
      let resultsQuery = db.select({
        id: searchResults.id,
        mlItemId: searchResults.mlItemId,
        title: searchResults.title,
        price: searchResults.price,
        originalPrice: searchResults.originalPrice,
        pictureUrl: searchResults.pictureUrl,
        sellerId: searchResults.sellerId,
        sellerNickname: searchResults.sellerNickname,
        position: searchResults.position,
        isNew: searchResults.isNew,
        foundAt: searchResults.foundAt,
        createdAt: searchResults.createdAt
      })
      .from(searchResults)
      .where(eq(searchResults.searchId, searchId))
      .orderBy(searchResults.position)
      .limit(limit)
      .offset(offset);

      // Aplicar filtros adicionales
      const conditions = [eq(searchResults.searchId, searchId)];
      
      if (isNew !== undefined) {
        conditions.push(eq(searchResults.isNew, isNew));
      }
      
      if (minPrice !== undefined) {
        conditions.push(db.$gt(searchResults.price, minPrice.toString()));
      }
      
      if (maxPrice !== undefined) {
        conditions.push(db.$lt(searchResults.price, maxPrice.toString()));
      }

      resultsQuery = resultsQuery.where(and(...conditions));

      const results = await resultsQuery;

      // Obtener conteo total
      let countQuery = db.select({ count: db.$count() })
        .from(searchResults)
        .where(and(...conditions));

      const [{ count: totalCount }] = await countQuery;

      reply.send({
        success: true,
        message: 'Resultados de búsqueda obtenidos correctamente',
        data: {
          search: search[0],
          results: results,
          pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: offset + limit < totalCount
          }
        }
      });
    } catch (error) {
      fastify.log.error('Error al obtener resultados de búsqueda:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parámetros inválidos',
          details: error.errors
        });
      }

      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener los resultados de la búsqueda'
      });
    }
  });

  /**
   * GET /searches/stats
   * Obtiene estadísticas de las búsquedas
   */
  fastify.get('/searches/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Estadísticas generales
      const totalSearches = await db.select({ count: db.$count() }).from(searches);
      const activeSearches = await db.select({ count: db.$count() }).from(searches).where(eq(searches.isActive, true));
      
      // Búsquedas más recientes
      const recentSearches = await db.select({
        id: searches.id,
        query: searches.query,
        lastExecutedAt: searches.lastExecutedAt
      })
      .from(searches)
      .orderBy(desc(searches.lastExecutedAt))
      .limit(5);

      // Búsquedas más populares (por cantidad de resultados)
      const popularSearches = await db.select({
        searchId: searchResults.searchId,
        query: searches.query,
        resultCount: db.$count()
      })
      .from(searchResults)
      .innerJoin(searches, eq(searchResults.searchId, searches.id))
      .groupBy(searchResults.searchId, searches.query)
      .orderBy(desc(db.$count()))
      .limit(5);

      reply.send({
        success: true,
        message: 'Estadísticas de búsquedas obtenidas correctamente',
        data: {
          total: totalSearches[0].count,
          active: activeSearches[0].count,
          recent: recentSearches,
          popular: popularSearches
        }
      });
    } catch (error) {
      fastify.log.error('Error al obtener estadísticas de búsquedas:', error);
      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudieron obtener las estadísticas de búsquedas'
      });
    }
  });
}
