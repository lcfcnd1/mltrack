import React, { useState } from 'react';
import { Bell, BellOff, Settings, TestTube, Save } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { usePWA } from '@/hooks/usePWA';

/**
 * Componente para configurar las preferencias de notificaciones push
 * Permite al usuario personalizar qué tipo de notificaciones recibir
 */
export function NotificationSettings() {
  const {
    isSupported,
    isSubscribed,
    subscription,
    preferences,
    isLoading,
    subscribeToPush,
    unsubscribeFromPush,
    updatePreferences,
    sendTestNotification
  } = usePushNotifications();

  const { requestNotificationPermission, canNotify } = usePWA();

  const [localPreferences, setLocalPreferences] = useState(preferences);

  // Actualizar preferencias locales cuando cambien las del servidor
  React.useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences]);

  const handleToggleSubscription = async () => {
    if (isSubscribed) {
      await unsubscribeFromPush();
    } else {
      // Primero solicitar permisos de notificación
      const hasPermission = await requestNotificationPermission();
      if (hasPermission) {
        await subscribeToPush();
      }
    }
  };

  const handlePreferenceChange = (key: keyof typeof preferences, value: boolean | number | string[]) => {
    setLocalPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSavePreferences = async () => {
    await updatePreferences(localPreferences);
  };

  const handleTestNotification = async () => {
    if (isSubscribed) {
      await sendTestNotification();
    }
  };

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <BellOff className="w-5 h-5" />
          <span className="font-medium">Notificaciones no soportadas</span>
        </div>
        <p className="text-sm text-yellow-700 mt-1">
          Tu navegador no soporta notificaciones push. Actualiza tu navegador o usa Chrome/Firefox.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estado de suscripción */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Notificaciones Push
            </h3>
          </div>
          
          <button
            onClick={handleToggleSubscription}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isSubscribed
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSubscribed ? (
              <>
                <BellOff className="w-4 h-4" />
                Desactivar
              </>
            ) : (
              <>
                <Bell className="w-4 h-4" />
                Activar
              </>
            )}
          </button>
        </div>

        <div className="text-sm text-gray-600">
          {isSubscribed ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-green-700">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Notificaciones push activadas
              </p>
              {subscription && (
                <p className="text-xs text-gray-500">
                  Endpoint: {subscription.endpoint.substring(0, 50)}...
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-600">
              Activa las notificaciones push para recibir alertas sobre nuevos productos, cambios de precio y más.
            </p>
          )}
        </div>

        {/* Botón de prueba */}
        {isSubscribed && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              onClick={handleTestNotification}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
            >
              <TestTube className="w-4 h-4" />
              Enviar notificación de prueba
            </button>
          </div>
        )}
      </div>

      {/* Preferencias de notificación */}
      {isSubscribed && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-md font-semibold text-gray-900 mb-4">
            Preferencias de notificación
          </h4>

          <div className="space-y-4">
            {/* Notificaciones generales */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">
                  Notificaciones habilitadas
                </label>
                <p className="text-xs text-gray-500">
                  Activa o desactiva todas las notificaciones
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localPreferences.enabled}
                  onChange={(e) => handlePreferenceChange('enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            {/* Nuevos productos */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">
                  Nuevos productos
                </label>
                <p className="text-xs text-gray-500">
                  Recibe notificaciones cuando se agreguen nuevos productos
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localPreferences.newProducts}
                  onChange={(e) => handlePreferenceChange('newProducts', e.target.checked)}
                  disabled={!localPreferences.enabled}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 peer-disabled:opacity-50"></div>
              </label>
            </div>

            {/* Cambios de precio */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">
                  Cambios de precio
                </label>
                <p className="text-xs text-gray-500">
                  Recibe notificaciones cuando cambien los precios
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localPreferences.priceChanges}
                  onChange={(e) => handlePreferenceChange('priceChanges', e.target.checked)}
                  disabled={!localPreferences.enabled}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 peer-disabled:opacity-50"></div>
              </label>
            </div>

            {/* Resultados de búsqueda */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">
                  Resultados de búsqueda
                </label>
                <p className="text-xs text-gray-500">
                  Recibe notificaciones cuando se encuentren nuevos resultados
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localPreferences.searchResults}
                  onChange={(e) => handlePreferenceChange('searchResults', e.target.checked)}
                  disabled={!localPreferences.enabled}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 peer-disabled:opacity-50"></div>
              </label>
            </div>

            {/* Sincronización completa */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">
                  Sincronización completa
                </label>
                <p className="text-xs text-gray-500">
                  Recibe notificaciones cuando termine una sincronización
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localPreferences.syncComplete}
                  onChange={(e) => handlePreferenceChange('syncComplete', e.target.checked)}
                  disabled={!localPreferences.enabled}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600 peer-disabled:opacity-50"></div>
              </label>
            </div>
          </div>

          {/* Filtros de precio */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <h5 className="text-sm font-medium text-gray-900 mb-3">
              Filtros de precio (opcional)
            </h5>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Precio mínimo
                </label>
                <input
                  type="number"
                  value={localPreferences.minPrice || ''}
                  onChange={(e) => handlePreferenceChange('minPrice', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Precio máximo
                </label>
                <input
                  type="number"
                  value={localPreferences.maxPrice || ''}
                  onChange={(e) => handlePreferenceChange('maxPrice', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Sin límite"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Botón guardar */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={handleSavePreferences}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium text-sm"
            >
              <Save className="w-4 h-4" />
              Guardar preferencias
            </button>
          </div>
        </div>
      )}

      {/* Información adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">
          💡 Consejos para notificaciones
        </h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Las notificaciones se envían cuando hay actividad nueva</li>
          <li>• Puedes personalizar qué tipo de notificaciones recibir</li>
          <li>• Los filtros de precio te ayudan a recibir solo notificaciones relevantes</li>
          <li>• Puedes desactivar las notificaciones en cualquier momento</li>
        </ul>
      </div>
    </div>
  );
}
