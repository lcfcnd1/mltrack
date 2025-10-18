/**
 * Rutas para manejo de notificaciones push
 * Incluye suscripción, desuscripción, preferencias y envío de notificaciones
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { pushSubscriptions, notificationPreferences } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import {
  sendNotificationToSubscription,
  sendNotificationToAllSubscriptions,
  sendTestNotification,
  getNotificationStats
} from '../services/pushNotifications';

// Esquemas de validación
const subscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string()
    })
  }),
  userId: z.string().optional(),
  userAgent: z.string().optional()
});

const preferencesSchema = z.object({
  enabled: z.boolean().optional(),
  newProducts: z.boolean().optional(),
  priceChanges: z.boolean().optional(),
  searchResults: z.boolean().optional(),
  syncComplete: z.boolean().optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  categories: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional()
});

const testNotificationSchema = z.object({
  subscriptionId: z.number().positive().optional()
});

/**
 * Registra las rutas de notificaciones push
 */
export async function pushRoutes(fastify: FastifyInstance) {
  // Obtener clave pública VAPID
  fastify.get('/vapid-public-key', async (request, reply) => {
    try {
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      
      if (!publicKey) {
        return reply.status(500).send({
          error: 'VAPID public key not configured'
        });
      }

      return {
        vapidPublicKey: publicKey
      };
    } catch (error) {
      console.error('❌ Error al obtener clave VAPID:', error);
      return reply.status(500).send({
        error: 'Error al obtener clave VAPID'
      });
    }
  });

  // Suscribirse a notificaciones push
  fastify.post('/subscribe', {
    schema: {
      body: subscriptionSchema
    }
  }, async (request, reply) => {
    try {
      const { subscription, userId, userAgent } = request.body as z.infer<typeof subscriptionSchema>;

      // Verificar si ya existe una suscripción con este endpoint
      const existingSubscription = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
        .limit(1);

      let subscriptionId: number;

      if (existingSubscription.length > 0) {
        // Actualizar suscripción existente
        const [updated] = await db
          .update(pushSubscriptions)
          .set({
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userId,
            userAgent,
            isActive: true,
            updatedAt: new Date()
          })
          .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
          .returning();

        subscriptionId = updated.id;
        console.log('✅ Suscripción actualizada:', subscriptionId);
      } else {
        // Crear nueva suscripción
        const [newSubscription] = await db
          .insert(pushSubscriptions)
          .values({
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userId,
            userAgent,
            isActive: true
          })
          .returning();

        subscriptionId = newSubscription.id;

        // Crear preferencias por defecto
        await db
          .insert(notificationPreferences)
          .values({
            subscriptionId,
            enabled: true,
            newProducts: true,
            priceChanges: true,
            searchResults: true,
            syncComplete: false
          });

        console.log('✅ Nueva suscripción creada:', subscriptionId);
      }

      return {
        success: true,
        subscriptionId,
        message: 'Suscripción registrada exitosamente'
      };

    } catch (error) {
      console.error('❌ Error al suscribirse:', error);
      return reply.status(500).send({
        error: 'Error al registrar suscripción'
      });
    }
  });

  // Desuscribirse de notificaciones push
  fastify.post('/unsubscribe', {
    schema: {
      body: z.object({
        endpoint: z.string().url()
      })
    }
  }, async (request, reply) => {
    try {
      const { endpoint } = request.body;

      // Marcar suscripción como inactiva
      const result = await db
        .update(pushSubscriptions)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(pushSubscriptions.endpoint, endpoint))
        .returning();

      if (result.length === 0) {
        return reply.status(404).send({
          error: 'Suscripción no encontrada'
        });
      }

      console.log('✅ Suscripción desactivada:', result[0].id);

      return {
        success: true,
        message: 'Suscripción desactivada exitosamente'
      };

    } catch (error) {
      console.error('❌ Error al desuscribirse:', error);
      return reply.status(500).send({
        error: 'Error al desactivar suscripción'
      });
    }
  });

  // Obtener preferencias de notificación
  fastify.get('/preferences', async (request, reply) => {
    try {
      // En una implementación real, aquí obtendrías el subscriptionId del usuario autenticado
      // Por ahora, retornamos preferencias por defecto
      const defaultPreferences = {
        enabled: true,
        newProducts: true,
        priceChanges: true,
        searchResults: true,
        syncComplete: false,
        minPrice: undefined,
        maxPrice: undefined,
        categories: [],
        locations: []
      };

      return {
        preferences: defaultPreferences
      };

    } catch (error) {
      console.error('❌ Error al obtener preferencias:', error);
      return reply.status(500).send({
        error: 'Error al obtener preferencias'
      });
    }
  });

  // Actualizar preferencias de notificación
  fastify.put('/preferences', {
    schema: {
      body: preferencesSchema
    }
  }, async (request, reply) => {
    try {
      const preferences = request.body as z.infer<typeof preferencesSchema>;

      // En una implementación real, aquí actualizarías las preferencias del usuario autenticado
      // Por ahora, solo retornamos éxito
      console.log('✅ Preferencias actualizadas:', preferences);

      return {
        success: true,
        message: 'Preferencias actualizadas exitosamente',
        preferences
      };

    } catch (error) {
      console.error('❌ Error al actualizar preferencias:', error);
      return reply.status(500).send({
        error: 'Error al actualizar preferencias'
      });
    }
  });

  // Enviar notificación de prueba
  fastify.post('/test', {
    schema: {
      body: testNotificationSchema
    }
  }, async (request, reply) => {
    try {
      const { subscriptionId } = request.body as z.infer<typeof testNotificationSchema>;

      const success = await sendTestNotification(subscriptionId);

      if (success) {
        return {
          success: true,
          message: 'Notificación de prueba enviada exitosamente'
        };
      } else {
        return reply.status(500).send({
          error: 'Error al enviar notificación de prueba'
        });
      }

    } catch (error) {
      console.error('❌ Error al enviar notificación de prueba:', error);
      return reply.status(500).send({
        error: 'Error al enviar notificación de prueba'
      });
    }
  });

  // Obtener estadísticas de notificaciones (solo para administradores)
  fastify.get('/stats', async (request, reply) => {
    try {
      const stats = await getNotificationStats();

      return {
        success: true,
        stats
      };

    } catch (error) {
      console.error('❌ Error al obtener estadísticas:', error);
      return reply.status(500).send({
        error: 'Error al obtener estadísticas'
      });
    }
  });

  // Enviar notificación personalizada (solo para administradores)
  fastify.post('/send', {
    schema: {
      body: z.object({
        title: z.string().min(1),
        body: z.string().min(1),
        icon: z.string().optional(),
        badge: z.string().optional(),
        tag: z.string().optional(),
        data: z.any().optional(),
        subscriptionId: z.number().positive().optional()
      })
    }
  }, async (request, reply) => {
    try {
      const notification = request.body;

      if (notification.subscriptionId) {
        // Enviar a suscripción específica
        const success = await sendNotificationToSubscription(
          notification.subscriptionId,
          notification
        );

        if (success) {
          return {
            success: true,
            message: 'Notificación enviada exitosamente'
          };
        } else {
          return reply.status(500).send({
            error: 'Error al enviar notificación'
          });
        }
      } else {
        // Enviar a todas las suscripciones
        const result = await sendNotificationToAllSubscriptions(notification);

        return {
          success: true,
          message: 'Notificaciones enviadas',
          sent: result.sent,
          failed: result.failed
        };
      }

    } catch (error) {
      console.error('❌ Error al enviar notificación personalizada:', error);
      return reply.status(500).send({
        error: 'Error al enviar notificación'
      });
    }
  });
}
