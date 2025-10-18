import { useState, useEffect, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import toast from 'react-hot-toast';

/**
 * Hook personalizado para manejar funcionalidades PWA
 * Incluye registro del service worker, instalación de PWA y notificaciones push
 */

interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  hasUpdate: boolean;
  canNotify: boolean;
  notificationPermission: NotificationPermission;
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWA() {
  // Estado del PWA
  const [pwaState, setPwaState] = useState<PWAState>({
    isInstallable: false,
    isInstalled: false,
    isOnline: navigator.onLine,
    hasUpdate: false,
    canNotify: false,
    notificationPermission: 'default'
  });

  // Estado de instalación pendiente
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Configuración del service worker con Vite PWA
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('✅ Service Worker registrado:', r);
    },
    onRegisterError(error) {
      console.error('❌ Error al registrar Service Worker:', error);
    },
    onNeedRefresh() {
      console.log('🔄 Nueva versión disponible');
      setPwaState(prev => ({ ...prev, hasUpdate: true }));
      
      // Mostrar notificación de actualización
      toast.success('Nueva versión de MLTrack disponible. Actualiza para continuar.', {
        duration: 8000,
        action: {
          label: 'Actualizar',
          onClick: () => updateServiceWorker(true)
        }
      });
    }
  });

  /**
   * Verifica si la PWA está instalada
   */
  const checkIfInstalled = useCallback(() => {
    // Verificar si está en modo standalone (PWA instalada)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    // O si está en pantalla completa en iOS
    const isIOSStandalone = (window.navigator as any).standalone;
    
    setPwaState(prev => ({
      ...prev,
      isInstalled: isStandalone || isIOSStandalone
    }));
  }, []);

  /**
   * Maneja el evento beforeinstallprompt para mostrar el botón de instalación
   */
  const handleBeforeInstallPrompt = useCallback((e: Event) => {
    e.preventDefault();
    const event = e as BeforeInstallPromptEvent;
    setDeferredPrompt(event);
    setPwaState(prev => ({ ...prev, isInstallable: true }));
    
    console.log('💡 PWA puede ser instalada');
  }, []);

  /**
   * Instala la PWA
   */
  const installPWA = useCallback(async () => {
    if (!deferredPrompt) {
      toast.error('No se puede instalar la aplicación en este momento');
      return;
    }

    try {
      // Mostrar el prompt de instalación
      await deferredPrompt.prompt();
      
      // Esperar la respuesta del usuario
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('✅ Usuario aceptó instalar la PWA');
        toast.success('¡MLTrack se está instalando!');
        
        // Limpiar el prompt
        setDeferredPrompt(null);
        setPwaState(prev => ({ ...prev, isInstallable: false }));
      } else {
        console.log('❌ Usuario rechazó instalar la PWA');
        toast.error('Instalación cancelada');
      }
    } catch (error) {
      console.error('❌ Error al instalar PWA:', error);
      toast.error('Error al instalar la aplicación');
    }
  }, [deferredPrompt]);

  /**
   * Solicita permisos de notificación
   */
  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      toast.error('Este navegador no soporta notificaciones');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      toast.error('Las notificaciones están bloqueadas. Actívalas en la configuración del navegador.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      
      setPwaState(prev => ({
        ...prev,
        notificationPermission: permission,
        canNotify: granted
      }));

      if (granted) {
        toast.success('Notificaciones activadas correctamente');
      } else {
        toast.error('Permisos de notificación denegados');
      }

      return granted;
    } catch (error) {
      console.error('❌ Error al solicitar permisos de notificación:', error);
      toast.error('Error al solicitar permisos de notificación');
      return false;
    }
  }, []);

  /**
   * Muestra una notificación local
   */
  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!pwaState.canNotify || !('Notification' in window)) {
      return;
    }

    try {
      const notification = new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-72x72.png',
        ...options
      });

      // Cerrar la notificación después de 5 segundos
      setTimeout(() => {
        notification.close();
      }, 5000);

      return notification;
    } catch (error) {
      console.error('❌ Error al mostrar notificación:', error);
    }
  }, [pwaState.canNotify]);

  /**
   * Actualiza la aplicación
   */
  const updateApp = useCallback(() => {
    updateServiceWorker(true);
    setPwaState(prev => ({ ...prev, hasUpdate: false }));
    toast.success('Actualizando aplicación...');
  }, [updateServiceWorker]);

  /**
   * Configura listeners de eventos
   */
  useEffect(() => {
    // Verificar si está instalada
    checkIfInstalled();

    // Listener para el evento beforeinstallprompt
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listener para cambios de conectividad
    const handleOnline = () => setPwaState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setPwaState(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificar permisos de notificación
    if ('Notification' in window) {
      setPwaState(prev => ({
        ...prev,
        notificationPermission: Notification.permission,
        canNotify: Notification.permission === 'granted'
      }));
    }

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkIfInstalled, handleBeforeInstallPrompt]);

  /**
   * Actualiza el estado cuando hay una nueva versión
   */
  useEffect(() => {
    if (needRefresh) {
      setPwaState(prev => ({ ...prev, hasUpdate: true }));
    }
  }, [needRefresh]);

  return {
    // Estado
    ...pwaState,
    
    // Acciones
    installPWA,
    requestNotificationPermission,
    showNotification,
    updateApp,
    
    // Utilidades
    isSupported: 'serviceWorker' in navigator,
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
    isAndroid: /Android/.test(navigator.userAgent),
  };
}
