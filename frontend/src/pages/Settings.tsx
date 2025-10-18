import React from 'react'
import { Bell, Shield, Database, Info, Download, Smartphone } from 'lucide-react'
import { usePWA } from '../hooks/usePWA'
import { NotificationSettings } from '../components/PWA/NotificationSettings'

/**
 * Página de configuración de la aplicación
 * Permite configurar notificaciones, privacidad, datos y información del sistema
 */
export default function Settings() {
  const { isInstalled, isInstallable, installPWA, hasUpdate, updateApp, isOnline } = usePWA()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
            <p className="text-gray-600">Personaliza tu experiencia con MLTrack</p>
          </div>
        </div>

        {/* Estado de la aplicación */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium text-gray-700">Estado de conexión</span>
            </div>
            <p className="text-xs text-gray-600">
              {isOnline ? 'Conectado' : 'Sin conexión'}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Instalación</span>
            </div>
            <p className="text-xs text-gray-600">
              {isInstalled ? 'PWA instalada' : 'No instalada'}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Versión</span>
            </div>
            <p className="text-xs text-gray-600">v1.0.0</p>
          </div>
        </div>
      </div>

      {/* Instalación PWA */}
      {!isInstalled && isInstallable && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Download className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Instalar MLTrack</h2>
              <p className="text-gray-600">Instala la aplicación para acceso rápido y mejor experiencia</p>
            </div>
          </div>

          <button
            onClick={installPWA}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            Instalar aplicación
          </button>
        </div>
      )}

      {/* Actualización disponible */}
      {hasUpdate && (
        <div className="bg-white rounded-lg shadow-sm border border-yellow-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
              <Download className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Actualización disponible</h2>
              <p className="text-gray-600">Hay una nueva versión de MLTrack disponible</p>
            </div>
          </div>

          <button
            onClick={updateApp}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            Actualizar aplicación
          </button>
        </div>
      )}

      {/* Configuración de notificaciones */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <Bell className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Notificaciones</h2>
            <p className="text-gray-600">Configura cómo y cuándo recibir notificaciones</p>
          </div>
        </div>

        <NotificationSettings />
      </div>

      {/* Configuración de privacidad */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Privacidad y seguridad</h2>
            <p className="text-gray-600">Configuración de privacidad y seguridad de datos</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Compartir datos de uso</h3>
              <p className="text-xs text-gray-500">
                Ayuda a mejorar MLTrack compartiendo datos de uso anónimos
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={false}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Sincronización automática</h3>
              <p className="text-xs text-gray-500">
                Sincroniza datos automáticamente cuando esté conectado
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={true}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Gestión de datos */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
            <Database className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Gestión de datos</h2>
            <p className="text-gray-600">Administra los datos almacenados localmente</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Cache de productos</h3>
              <p className="text-xs text-gray-600 mb-3">Datos de productos almacenados localmente</p>
              <button className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                Limpiar cache
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Búsquedas offline</h3>
              <p className="text-xs text-gray-600 mb-3">Resultados de búsqueda guardados</p>
              <button className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                Ver datos
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Configuración local</h3>
              <p className="text-xs text-gray-600 mb-3">Preferencias y configuraciones</p>
              <button className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                Exportar
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
              <Database className="w-4 h-4" />
              Limpiar todos los datos locales
            </button>
          </div>
        </div>
      </div>

      {/* Información del sistema */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-gray-500 rounded-lg flex items-center justify-center">
            <Info className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Información del sistema</h2>
            <p className="text-gray-600">Detalles técnicos de la aplicación</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Aplicación</h3>
            <div className="space-y-1 text-gray-600">
              <p>Versión: 1.0.0</p>
              <p>Build: 2024.01.15</p>
              <p>Entorno: {import.meta.env.MODE}</p>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-2">Navegador</h3>
            <div className="space-y-1 text-gray-600">
              <p>User Agent: {navigator.userAgent.split(' ')[0]}</p>
              <p>Plataforma: {navigator.platform}</p>
              <p>Idioma: {navigator.language}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
