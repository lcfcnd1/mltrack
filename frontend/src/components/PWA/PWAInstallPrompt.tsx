import React from 'react';
import { Download, Smartphone, Monitor, X } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

/**
 * Componente para mostrar el prompt de instalación de PWA
 * Se muestra cuando la aplicación puede ser instalada
 */
export function PWAInstallPrompt() {
  const { isInstallable, isInstalled, installPWA, isIOS, isAndroid } = usePWA();

  // No mostrar si ya está instalada o no es instalable
  if (isInstalled || !isInstallable) {
    return null;
  }

  const handleInstall = () => {
    installPWA();
  };

  const handleDismiss = () => {
    // Aquí podrías guardar la preferencia del usuario para no mostrar más el prompt
    console.log('Usuario descartó el prompt de instalación');
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <div className="flex items-start gap-3">
          {/* Icono */}
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Instalar MLTrack
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              {isIOS ? (
                'Toca el botón de compartir y selecciona "Agregar a pantalla de inicio"'
              ) : isAndroid ? (
                'Agrega MLTrack a tu pantalla de inicio para acceso rápido'
              ) : (
                'Instala MLTrack como una aplicación para mejor experiencia'
              )}
            </p>

            {/* Botones */}
            <div className="flex gap-2">
              <button
                onClick={handleInstall}
                className="flex-1 bg-primary-500 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-primary-600 transition-colors"
              >
                {isIOS ? 'Instalar' : 'Instalar'}
              </button>
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Indicadores de plataforma */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Monitor className="w-3 h-3" />
            <span>Desktop</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Smartphone className="w-3 h-3" />
            <span>Móvil</span>
          </div>
        </div>
      </div>
    </div>
  );
}
