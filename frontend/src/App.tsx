import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSocket } from './hooks/useSocket'
import { useAuthStore } from './stores/authStore'
import { useOfflineStore } from './stores/offlineStore'
import { usePWA } from './hooks/usePWA'

// Layout components
import Layout from './components/Layout/Layout'
import Sidebar from './components/Layout/Sidebar'
import Header from './components/Layout/Header'

// Page components
import Dashboard from './pages/Dashboard'
import Sellers from './pages/Sellers'
import Products from './pages/Products'
import Searches from './pages/Searches'
import SearchResults from './pages/SearchResults'
import SyncHistory from './pages/SyncHistory'
import Settings from './pages/Settings'
import AuthCallback from './pages/AuthCallback'
import NotFound from './pages/NotFound'

// PWA components
import { PWAInstallPrompt } from './components/PWA/PWAInstallPrompt'

// Loading component
import LoadingSpinner from './components/UI/LoadingSpinner'

/**
 * Componente principal de la aplicación MLTrack
 * Maneja el enrutamiento, autenticación y estado global
 */
function App() {
  const { isAuthenticated, isLoading, initializeAuth } = useAuthStore()
  const { initializeOfflineStore } = useOfflineStore()
  const { isOnline } = usePWA()
  
  // Inicializar Socket.IO para comunicación en tiempo real
  const { socket, isConnected } = useSocket()

  // Inicializar la aplicación
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Inicializar autenticación
        await initializeAuth()
        
        // Inicializar store offline (IndexedDB)
        await initializeOfflineStore()
        
        console.log('✅ Aplicación inicializada correctamente')
      } catch (error) {
        console.error('❌ Error al inicializar la aplicación:', error)
      }
    }

    initializeApp()
  }, [initializeAuth, initializeOfflineStore])

  // Mostrar loading mientras se inicializa la aplicación
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Iniciando MLTrack...</p>
        </div>
      </div>
    )
  }

  // Si no está autenticado, mostrar página de login/auth
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Navigate to="/auth/mercadolibre" replace />} />
      </Routes>
    )
  }

  // Aplicación principal autenticada
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Layout principal */}
      <Layout>
        {/* Header */}
        <Header socketConnected={isConnected} />
        
        {/* Contenido principal */}
        <main className="flex-1 p-6">
          <Routes>
            {/* Dashboard principal */}
            <Route path="/" element={<Dashboard />} />
            
            {/* Gestión de vendedores */}
            <Route path="/sellers" element={<Sellers />} />
            
            {/* Productos */}
            <Route path="/products" element={<Products />} />
            <Route path="/products/:sellerId" element={<Products />} />
            
            {/* Búsquedas */}
            <Route path="/searches" element={<Searches />} />
            <Route path="/searches/:searchId" element={<SearchResults />} />
            
            {/* Historial de sincronización */}
            <Route path="/sync" element={<SyncHistory />} />
            
            {/* Configuración */}
            <Route path="/settings" element={<Settings />} />
            
            {/* Callback de autenticación */}
            <Route path="/auth/callback" element={<AuthCallback />} />
            
            {/* Página 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </Layout>
      
      {/* Prompt de instalación PWA */}
      <PWAInstallPrompt />
    </div>
  )
}

export default App
