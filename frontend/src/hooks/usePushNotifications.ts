import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api';
import toast from 'react-hot-toast';

/**
 * Hook para manejar notificaciones push con Web Push API
 * Incluye suscripción, desuscripción y gestión de notificaciones push
 */

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface NotificationPreferences {
  enabled: boolean;
  newProducts: boolean;
  priceChanges: boolean;
  searchResults: boolean;
  syncComplete: boolean;
  minPrice?: number;
  maxPrice?: number;
  categories?: string[];
  locations?: string[];
}

interface PushState {
  isSupported: boolean;
  isSubscribed: boolean;
  subscription: PushSubscription | null;
  preferences: NotificationPreferences;
  isLoading: boolean;
}

export function usePushNotifications() {
  const [pushState, setPushState] = useState<PushState>({
    isSupported: false,
    isSubscribed: false,
    subscription: null,
    preferences: {
      enabled: false,
      newProducts: true,
      priceChanges: true,
      searchResults: true,
      syncComplete: false,
    },
    isLoading: false
  });

  /**
   * Verifica si las notificaciones push están soportadas
   */
  const checkSupport = useCallback(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setPushState(prev => ({ ...prev, isSupported: supported }));
    return supported;
  }, []);

  /**
   * Obtiene la clave pública VAPID del servidor
   */
  const getVapidPublicKey = useCallback(async (): Promise<string> => {
    try {
      const response = await apiClient.request({
        method: 'GET',
        url: '/push/vapid-public-key'
      });
      return response.vapidPublicKey;
    } catch (error) {
      console.error('❌ Error al obtener clave VAPID:', error);
      throw new Error('No se pudo obtener la clave de notificaciones');
    }
  }, []);

  /**
   * Convierte la clave base64 a Uint8Array
   */
  const urlBase64ToUint8Array = useCallback((base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }, []);

  /**
   * Suscribe al usuario a notificaciones push
   */
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!pushState.isSupported) {
      toast.error('Las notificaciones push no están soportadas en este navegador');
      return false;
    }

    setPushState(prev => ({ ...prev, isLoading: true }));

    try {
      // Obtener el service worker registrado
      const registration = await navigator.serviceWorker.ready;
      
      if (!registration.pushManager) {
        throw new Error('Push Manager no está disponible');
      }

      // Verificar si ya está suscrito
      let subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        console.log('✅ Ya está suscrito a notificaciones push');
        setPushState(prev => ({
          ...prev,
          isSubscribed: true,
          subscription: subscription as any,
          isLoading: false
        }));
        return true;
      }

      // Obtener clave VAPID pública
      const vapidPublicKey = await getVapidPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // Suscribirse a push
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      // Enviar suscripción al servidor
      await apiClient.request({
        method: 'POST',
        url: '/push/subscribe',
        data: {
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
              auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)))
            }
          }
        }
      });

      setPushState(prev => ({
        ...prev,
        isSubscribed: true,
        subscription: subscription as any,
        isLoading: false
      }));

      toast.success('Notificaciones push activadas correctamente');
      return true;

    } catch (error) {
      console.error('❌ Error al suscribirse a notificaciones push:', error);
      toast.error('Error al activar notificaciones push');
      setPushState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [pushState.isSupported, getVapidPublicKey, urlBase64ToUint8Array]);

  /**
   * Desuscribe al usuario de notificaciones push
   */
  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    setPushState(prev => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Desuscribirse del navegador
        await subscription.unsubscribe();

        // Notificar al servidor
        await apiClient.request({
          method: 'POST',
          url: '/push/unsubscribe',
          data: {
            endpoint: subscription.endpoint
          }
        });
      }

      setPushState(prev => ({
        ...prev,
        isSubscribed: false,
        subscription: null,
        isLoading: false
      }));

      toast.success('Notificaciones push desactivadas');
      return true;

    } catch (error) {
      console.error('❌ Error al desuscribirse de notificaciones push:', error);
      toast.error('Error al desactivar notificaciones push');
      setPushState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, []);

  /**
   * Actualiza las preferencias de notificación
   */
  const updatePreferences = useCallback(async (preferences: Partial<NotificationPreferences>): Promise<boolean> => {
    setPushState(prev => ({ ...prev, isLoading: true }));

    try {
      await apiClient.request({
        method: 'PUT',
        url: '/push/preferences',
        data: preferences
      });

      setPushState(prev => ({
        ...prev,
        preferences: { ...prev.preferences, ...preferences },
        isLoading: false
      }));

      toast.success('Preferencias actualizadas');
      return true;

    } catch (error) {
      console.error('❌ Error al actualizar preferencias:', error);
      toast.error('Error al actualizar preferencias');
      setPushState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, []);

  /**
   * Obtiene las preferencias actuales del servidor
   */
  const loadPreferences = useCallback(async (): Promise<void> => {
    try {
      const response = await apiClient.request({
        method: 'GET',
        url: '/push/preferences'
      });

      setPushState(prev => ({
        ...prev,
        preferences: response.preferences
      }));

    } catch (error) {
      console.error('❌ Error al cargar preferencias:', error);
    }
  }, []);

  /**
   * Verifica el estado de suscripción actual
   */
  const checkSubscriptionStatus = useCallback(async (): Promise<void> => {
    if (!pushState.isSupported) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      setPushState(prev => ({
        ...prev,
        isSubscribed: !!subscription,
        subscription: subscription as any
      }));

      // Cargar preferencias si está suscrito
      if (subscription) {
        await loadPreferences();
      }

    } catch (error) {
      console.error('❌ Error al verificar estado de suscripción:', error);
    }
  }, [pushState.isSupported, loadPreferences]);

  /**
   * Envía una notificación de prueba
   */
  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    try {
      await apiClient.request({
        method: 'POST',
        url: '/push/test'
      });

      toast.success('Notificación de prueba enviada');
      return true;

    } catch (error) {
      console.error('❌ Error al enviar notificación de prueba:', error);
      toast.error('Error al enviar notificación de prueba');
      return false;
    }
  }, []);

  /**
   * Configura listeners para notificaciones push
   */
  useEffect(() => {
    if (!pushState.isSupported) return;

    const handlePushMessage = (event: PushEvent) => {
      console.log('📨 Notificación push recibida:', event);

      const data = event.data ? event.data.json() : {};
      
      // Mostrar notificación
      const options: NotificationOptions = {
        body: data.body || 'Nueva notificación de MLTrack',
        icon: '/pwa-192x192.png',
        badge: '/pwa-72x72.png',
        tag: data.tag || 'mltrack-notification',
        data: data.data || {},
        actions: data.actions || [],
        requireInteraction: data.requireInteraction || false
      };

      self.registration.showNotification(
        data.title || 'MLTrack',
        options
      );
    };

    const handleNotificationClick = (event: NotificationEvent) => {
      console.log('🔔 Notificación clickeada:', event);

      event.notification.close();

      if (event.notification.data && event.notification.data.url) {
        // Abrir la URL específica en una nueva ventana
        event.waitUntil(
          clients.openWindow(event.notification.data.url)
        );
      } else {
        // Abrir la aplicación principal
        event.waitUntil(
          clients.openWindow('/mltrack/')
        );
      }
    };

    // Registrar listeners
    self.addEventListener('push', handlePushMessage);
    self.addEventListener('notificationclick', handleNotificationClick);

    // Cleanup (aunque estos listeners son globales)
    return () => {
      self.removeEventListener('push', handlePushMessage);
      self.removeEventListener('notificationclick', handleNotificationClick);
    };
  }, [pushState.isSupported]);

  /**
   * Inicialización
   */
  useEffect(() => {
    const initialize = async () => {
      checkSupport();
      
      if (pushState.isSupported) {
        await checkSubscriptionStatus();
      }
    };

    initialize();
  }, [checkSupport, checkSubscriptionStatus, pushState.isSupported]);

  return {
    // Estado
    ...pushState,
    
    // Acciones
    subscribeToPush,
    unsubscribeFromPush,
    updatePreferences,
    loadPreferences,
    sendTestNotification,
    checkSubscriptionStatus,
  };
}
