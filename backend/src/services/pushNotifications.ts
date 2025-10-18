/**
 * Servicio de notificaciones push para MLTrack
 * Maneja el envío de notificaciones push usando Web Push API con VAPID
 */

import webpush from 'web-push';
import { db } from '../db';
import { pushSubscriptions, notificationPreferences } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';

// Configurar web-push con claves VAPID
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY!,
  privateKey: process.env.VAPID_PRIVATE_KEY!,
  subject: process.env.VAPID_SUBJECT || 'mailto:admin@sqsoft.top'
};

webpush.setVapidDetails(
  vapidKeys.subject,
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

/**
 * Interfaz para los datos de una notificación
 */
interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  sound?: string;
}

/**
 * Interfaz para filtros de notificación
 */
interface NotificationFilters {
  minPrice?: number;
  maxPrice?: number;
  categories?: string[];
  locations?: string[];
}

/**
 * Envía una notificación push a una suscripción específica
 */
export async function sendNotificationToSubscription(
  subscriptionId: number,
  notification: NotificationData
): Promise<boolean> {
  try {
    // Obtener la suscripción y sus preferencias
    const subscriptionData = await db
      .select({
        subscription: pushSubscriptions,
        preferences: notificationPreferences
      })
      .from(pushSubscriptions)
      .leftJoin(notificationPreferences, eq(notificationPreferences.subscriptionId, pushSubscriptions.id))
      .where(and(
        eq(pushSubscriptions.id, subscriptionId),
        eq(pushSubscriptions.isActive, true)
      ))
      .limit(1);

    if (!subscriptionData.length || !subscriptionData[0].subscription) {
      console.log('❌ Suscripción no encontrada o inactiva:', subscriptionId);
      return false;
    }

    const { subscription, preferences } = subscriptionData[0];

    // Verificar si las notificaciones están habilitadas
    if (preferences && !preferences.enabled) {
      console.log('❌ Notificaciones deshabilitadas para suscripción:', subscriptionId);
      return false;
    }

    // Preparar el payload de la notificación
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/pwa-192x192.png',
      badge: notification.badge || '/pwa-72x72.png',
      tag: notification.tag || 'mltrack-notification',
      data: notification.data || {},
      actions: notification.actions || [
        {
          action: 'open',
          title: 'Abrir',
          icon: '/pwa-72x72.png'
        },
        {
          action: 'close',
          title: 'Cerrar',
          icon: '/pwa-72x72.png'
        }
      ],
      requireInteraction: notification.requireInteraction || false,
      silent: notification.silent || false,
      timestamp: Date.now(),
      vibrate: notification.vibrate || [200, 100, 200],
      sound: notification.sound || null
    });

    // Enviar la notificación
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      },
      payload
    );

    console.log('✅ Notificación enviada exitosamente a suscripción:', subscriptionId);
    return true;

  } catch (error: any) {
    console.error('❌ Error al enviar notificación push:', error);

    // Si la suscripción es inválida, marcarla como inactiva
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log('🗑️ Marcando suscripción como inactiva:', subscriptionId);
      await db
        .update(pushSubscriptions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(pushSubscriptions.id, subscriptionId));
    }

    return false;
  }
}

/**
 * Envía una notificación a todas las suscripciones activas
 */
export async function sendNotificationToAllSubscriptions(
  notification: NotificationData,
  filters?: NotificationFilters
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  try {
    // Obtener todas las suscripciones activas con sus preferencias
    const subscriptions = await db
      .select({
        subscription: pushSubscriptions,
        preferences: notificationPreferences
      })
      .from(pushSubscriptions)
      .leftJoin(notificationPreferences, eq(notificationPreferences.subscriptionId, pushSubscriptions.id))
      .where(eq(pushSubscriptions.isActive, true));

    console.log(`📤 Enviando notificación a ${subscriptions.length} suscripciones...`);

    // Enviar a cada suscripción
    for (const { subscription, preferences } of subscriptions) {
      // Aplicar filtros si están especificados
      if (filters && preferences) {
        if (!shouldSendNotification(preferences, filters, notification)) {
          continue;
        }
      }

      // Verificar si las notificaciones están habilitadas
      if (preferences && !preferences.enabled) {
        continue;
      }

      const success = await sendNotificationToSubscription(subscription.id, notification);
      
      if (success) {
        sent++;
      } else {
        failed++;
      }

      // Pequeña pausa entre envíos para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Notificación enviada: ${sent} exitosos, ${failed} fallidos`);
    return { sent, failed };

  } catch (error) {
    console.error('❌ Error al enviar notificaciones masivas:', error);
    return { sent, failed };
  }
}

/**
 * Determina si se debe enviar una notificación basado en las preferencias y filtros
 */
function shouldSendNotification(
  preferences: any,
  filters: NotificationFilters,
  notification: NotificationData
): boolean {
  // Verificar filtros de precio si están configurados
  if (filters.minPrice !== undefined && preferences.minPrice) {
    if (filters.minPrice < preferences.minPrice) {
      return false;
    }
  }

  if (filters.maxPrice !== undefined && preferences.maxPrice) {
    if (filters.maxPrice > preferences.maxPrice) {
      return false;
    }
  }

  // Verificar filtros de categorías si están configurados
  if (filters.categories && preferences.categories) {
    const hasMatchingCategory = filters.categories.some(category =>
      preferences.categories.includes(category)
    );
    if (!hasMatchingCategory) {
      return false;
    }
  }

  // Verificar filtros de ubicación si están configurados
  if (filters.locations && preferences.locations) {
    const hasMatchingLocation = filters.locations.some(location =>
      preferences.locations.includes(location)
    );
    if (!hasMatchingLocation) {
      return false;
    }
  }

  return true;
}

/**
 * Notifica sobre nuevos productos
 */
export async function notifyNewProducts(
  sellerId: number,
  sellerNickname: string,
  newProductsCount: number
): Promise<void> {
  const notification: NotificationData = {
    title: `🆕 ${newProductsCount} nuevo${newProductsCount > 1 ? 's' : ''} producto${newProductsCount > 1 ? 's' : ''} de ${sellerNickname}`,
    body: `Se encontraron ${newProductsCount} producto${newProductsCount > 1 ? 's' : ''} nuevo${newProductsCount > 1 ? 's' : ''} en la tienda de ${sellerNickname}`,
    tag: `new-products-${sellerId}`,
    data: {
      type: 'new_products',
      sellerId,
      sellerNickname,
      count: newProductsCount,
      url: `/mltrack/products/${sellerId}`
    },
    requireInteraction: newProductsCount > 5 // Interacción requerida si hay muchos productos nuevos
  };

  await sendNotificationToAllSubscriptions(notification);
}

/**
 * Notifica sobre cambios de precio
 */
export async function notifyPriceChanges(
  sellerId: number,
  sellerNickname: string,
  priceChangesCount: number
): Promise<void> {
  const notification: NotificationData = {
    title: `💰 Cambios de precio en ${sellerNickname}`,
    body: `${priceChangesCount} producto${priceChangesCount > 1 ? 's' : ''} cambiaron de precio`,
    tag: `price-changes-${sellerId}`,
    data: {
      type: 'price_changes',
      sellerId,
      sellerNickname,
      count: priceChangesCount,
      url: `/mltrack/products/${sellerId}`
    }
  };

  await sendNotificationToAllSubscriptions(notification);
}

/**
 * Notifica sobre nuevos resultados de búsqueda
 */
export async function notifySearchResults(
  searchId: number,
  searchQuery: string,
  newResultsCount: number
): Promise<void> {
  const notification: NotificationData = {
    title: `🔍 Nuevos resultados para "${searchQuery}"`,
    body: `Se encontraron ${newResultsCount} resultado${newResultsCount > 1 ? 's' : ''} nuevo${newResultsCount > 1 ? 's' : ''}`,
    tag: `search-results-${searchId}`,
    data: {
      type: 'search_results',
      searchId,
      searchQuery,
      count: newResultsCount,
      url: `/mltrack/searches/${searchId}`
    }
  };

  await sendNotificationToAllSubscriptions(notification);
}

/**
 * Notifica sobre sincronización completada
 */
export async function notifySyncComplete(
  sellerId: number,
  sellerNickname: string,
  syncStats: {
    newItems: number;
    updatedItems: number;
    deletedItems: number;
    errorsCount: number;
  }
): Promise<void> {
  const { newItems, updatedItems, deletedItems, errorsCount } = syncStats;
  
  let title = '✅ Sincronización completada';
  let body = `Sincronización de ${sellerNickname} completada`;
  
  if (errorsCount > 0) {
    title = '⚠️ Sincronización con errores';
    body += ` (${errorsCount} error${errorsCount > 1 ? 'es' : ''})`;
  }

  const notification: NotificationData = {
    title,
    body,
    tag: `sync-complete-${sellerId}`,
    data: {
      type: 'sync_complete',
      sellerId,
      sellerNickname,
      stats: syncStats,
      url: `/mltrack/sync`
    },
    requireInteraction: errorsCount > 0 // Interacción requerida si hay errores
  };

  await sendNotificationToAllSubscriptions(notification);
}

/**
 * Envía una notificación de prueba
 */
export async function sendTestNotification(subscriptionId?: number): Promise<boolean> {
  const notification: NotificationData = {
    title: '🧪 Notificación de prueba',
    body: 'Esta es una notificación de prueba de MLTrack',
    tag: 'test-notification',
    data: {
      type: 'test',
      url: '/mltrack/'
    }
  };

  if (subscriptionId) {
    return await sendNotificationToSubscription(subscriptionId, notification);
  } else {
    const result = await sendNotificationToAllSubscriptions(notification);
    return result.sent > 0;
  }
}

/**
 * Obtiene las estadísticas de notificaciones
 */
export async function getNotificationStats(): Promise<{
  totalSubscriptions: number;
  activeSubscriptions: number;
  notificationsEnabled: number;
}> {
  const totalSubscriptions = await db
    .select({ count: sql`count(*)` })
    .from(pushSubscriptions);

  const activeSubscriptions = await db
    .select({ count: sql`count(*)` })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.isActive, true));

  const notificationsEnabled = await db
    .select({ count: sql`count(*)` })
    .from(pushSubscriptions)
    .leftJoin(notificationPreferences, eq(notificationPreferences.subscriptionId, pushSubscriptions.id))
    .where(and(
      eq(pushSubscriptions.isActive, true),
      eq(notificationPreferences.enabled, true)
    ));

  return {
    totalSubscriptions: totalSubscriptions[0]?.count || 0,
    activeSubscriptions: activeSubscriptions[0]?.count || 0,
    notificationsEnabled: notificationsEnabled[0]?.count || 0
  };
}
