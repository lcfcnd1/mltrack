import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { sellers } from '../db/schema';
import { mercadoLibreService } from '../services/mercadolibre';
import { eq } from 'drizzle-orm';

/**
 * Rutas de autenticación OAuth2 con MercadoLibre
 * Maneja el flujo completo de autorización y gestión de tokens
 */

// Esquemas de validación con Zod
const authCallbackSchema = z.object({
  code: z.string().min(1, 'Código de autorización requerido'),
  state: z.string().optional()
});

const sellerIdSchema = z.object({
  sellerId: z.string().min(1, 'ID del vendedor requerido')
});

export async function authRoutes(fastify: FastifyInstance) {
  // Registrar el esquema de validación
  fastify.addSchema({
    $id: 'authCallback',
    type: 'object',
    properties: {
      code: { type: 'string' },
      state: { type: 'string' }
    },
    required: ['code']
  });

  /**
   * GET /auth/mercadolibre
   * Redirige al usuario a la página de autorización de MercadoLibre
   */
  fastify.get('/auth/mercadolibre', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Generar estado aleatorio para seguridad
      const state = Math.random().toString(36).substring(2, 15);
      
      // Generar URL de autorización
      const authURL = mercadoLibreService.generateAuthURL(state);
      
      // Guardar estado en sesión o Redis para verificación posterior
      await fastify.redis.set(`auth:state:${state}`, '1', 'EX', 600); // Expira en 10 minutos
      
      reply.redirect(authURL);
    } catch (error) {
      fastify.log.error('Error al generar URL de autorización:', error);
      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo generar la URL de autorización'
      });
    }
  });

  /**
   * GET /auth/callback
   * Callback que recibe el código de autorización de MercadoLibre
   */
  fastify.get('/auth/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validar parámetros de la query
      const { code, state } = authCallbackSchema.parse(request.query);

      // Verificar estado si fue proporcionado
      if (state) {
        const isValidState = await fastify.redis.get(`auth:state:${state}`);
        if (!isValidState) {
          return reply.status(400).send({
            error: 'Estado inválido',
            message: 'El estado de autorización no es válido o ha expirado'
          });
        }
        // Limpiar estado usado
        await fastify.redis.del(`auth:state:${state}`);
      }

      // Intercambiar código por tokens
      const tokenData = await mercadoLibreService.exchangeCodeForTokens(code);

      // Guardar o actualizar vendedor en la base de datos
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
      
      const [seller] = await db.insert(sellers)
        .values({
          mlUserId: tokenData.user_id,
          mlNickname: tokenData.nickname,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiresAt: expiresAt,
          isActive: true,
          lastSyncAt: null
        })
        .onConflictDoUpdate({
          target: sellers.mlUserId,
          set: {
            mlNickname: tokenData.nickname,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt: expiresAt,
            isActive: true,
            updatedAt: new Date()
          }
        })
        .returning();

      // Generar JWT para el usuario (opcional, si se requiere autenticación en el frontend)
      const jwtToken = fastify.jwt.sign({
        userId: seller.mlUserId,
        sellerId: seller.id,
        nickname: seller.mlNickname
      }, { expiresIn: '7d' });

      // Redirigir al frontend con el token
      const frontendURL = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/success?token=${jwtToken}`;
      
      reply.redirect(frontendURL);
    } catch (error) {
      fastify.log.error('Error en callback de autorización:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parámetros inválidos',
          details: error.errors
        });
      }

      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo completar la autorización'
      });
    }
  });

  /**
   * GET /auth/sellers
   * Obtiene lista de vendedores autenticados
   */
  fastify.get('/auth/sellers', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sellersList = await db.select({
        id: sellers.id,
        mlUserId: sellers.mlUserId,
        mlNickname: sellers.mlNickname,
        isActive: sellers.isActive,
        lastSyncAt: sellers.lastSyncAt,
        createdAt: sellers.createdAt
      })
      .from(sellers)
      .orderBy(sellers.createdAt);

      reply.send({
        success: true,
        data: sellersList
      });
    } catch (error) {
      fastify.log.error('Error al obtener lista de vendedores:', error);
      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener la lista de vendedores'
      });
    }
  });

  /**
   * GET /auth/sellers/:sellerId
   * Obtiene información de un vendedor específico
   */
  fastify.get('/auth/sellers/:sellerId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { sellerId } = sellerIdSchema.parse(request.params);

      const seller = await db.select()
        .from(sellers)
        .where(eq(sellers.id, parseInt(sellerId)))
        .limit(1);

      if (seller.length === 0) {
        return reply.status(404).send({
          error: 'Vendedor no encontrado',
          message: `No se encontró un vendedor con ID ${sellerId}`
        });
      }

      // No devolver tokens sensibles
      const { accessToken, refreshToken, ...sellerInfo } = seller[0];

      reply.send({
        success: true,
        data: sellerInfo
      });
    } catch (error) {
      fastify.log.error('Error al obtener vendedor:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parámetros inválidos',
          details: error.errors
        });
      }

      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo obtener la información del vendedor'
      });
    }
  });

  /**
   * PUT /auth/sellers/:sellerId/toggle
   * Activa o desactiva un vendedor para sincronización
   */
  fastify.put('/auth/sellers/:sellerId/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { sellerId } = sellerIdSchema.parse(request.params);

      const seller = await db.select()
        .from(sellers)
        .where(eq(sellers.id, parseInt(sellerId)))
        .limit(1);

      if (seller.length === 0) {
        return reply.status(404).send({
          error: 'Vendedor no encontrado',
          message: `No se encontró un vendedor con ID ${sellerId}`
        });
      }

      // Cambiar estado de activación
      const newActiveState = !seller[0].isActive;
      
      await db.update(sellers)
        .set({
          isActive: newActiveState,
          updatedAt: new Date()
        })
        .where(eq(sellers.id, parseInt(sellerId)));

      reply.send({
        success: true,
        message: `Vendedor ${newActiveState ? 'activado' : 'desactivado'} correctamente`,
        data: {
          id: parseInt(sellerId),
          isActive: newActiveState
        }
      });
    } catch (error) {
      fastify.log.error('Error al cambiar estado del vendedor:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parámetros inválidos',
          details: error.errors
        });
      }

      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo cambiar el estado del vendedor'
      });
    }
  });

  /**
   * DELETE /auth/sellers/:sellerId
   * Elimina un vendedor y todos sus datos asociados
   */
  fastify.delete('/auth/sellers/:sellerId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { sellerId } = sellerIdSchema.parse(request.params);

      const seller = await db.select()
        .from(sellers)
        .where(eq(sellers.id, parseInt(sellerId)))
        .limit(1);

      if (seller.length === 0) {
        return reply.status(404).send({
          error: 'Vendedor no encontrado',
          message: `No se encontró un vendedor con ID ${sellerId}`
        });
      }

      // Eliminar vendedor (esto también eliminará productos y búsquedas asociadas por las foreign keys)
      await db.delete(sellers)
        .where(eq(sellers.id, parseInt(sellerId)));

      reply.send({
        success: true,
        message: 'Vendedor eliminado correctamente'
      });
    } catch (error) {
      fastify.log.error('Error al eliminar vendedor:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parámetros inválidos',
          details: error.errors
        });
      }

      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo eliminar el vendedor'
      });
    }
  });

  /**
   * POST /auth/refresh/:sellerId
   * Fuerza la renovación del token de un vendedor específico
   */
  fastify.post('/auth/refresh/:sellerId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { sellerId } = sellerIdSchema.parse(request.params);

      const seller = await db.select()
        .from(sellers)
        .where(eq(sellers.id, parseInt(sellerId)))
        .limit(1);

      if (seller.length === 0) {
        return reply.status(404).send({
          error: 'Vendedor no encontrado',
          message: `No se encontró un vendedor con ID ${sellerId}`
        });
      }

      // Renovar token
      const newTokens = await mercadoLibreService.refreshAccessToken(seller[0].refreshToken);
      
      // Actualizar en base de datos
      const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
      await db.update(sellers)
        .set({
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token,
          tokenExpiresAt: expiresAt,
          updatedAt: new Date()
        })
        .where(eq(sellers.id, parseInt(sellerId)));

      reply.send({
        success: true,
        message: 'Token renovado correctamente',
        data: {
          expiresAt,
          expiresIn: newTokens.expires_in
        }
      });
    } catch (error) {
      fastify.log.error('Error al renovar token:', error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parámetros inválidos',
          details: error.errors
        });
      }

      reply.status(500).send({
        error: 'Error interno del servidor',
        message: 'No se pudo renovar el token'
      });
    }
  });
}
