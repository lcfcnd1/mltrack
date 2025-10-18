import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/services/api';
import type { AuthUser, AuthTokens } from '@/types';

/**
 * Store de autenticación usando Zustand
 * Maneja el estado de autenticación del usuario y tokens
 */

interface AuthState {
  // Estado de autenticación
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  tokens: AuthTokens | null;
  
  // Acciones
  login: (tokens: AuthTokens, user: AuthUser) => void;
  logout: () => void;
  initializeAuth: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  updateUser: (user: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Estado inicial
      isAuthenticated: false,
      isLoading: true,
      user: null,
      tokens: null,

      // Acción de login
      login: (tokens: AuthTokens, user: AuthUser) => {
        set({
          isAuthenticated: true,
          user,
          tokens,
          isLoading: false
        });
        
        // Guardar token en localStorage para el interceptor de axios
        localStorage.setItem('auth_token', tokens.accessToken);
        
        console.log('✅ Usuario autenticado:', user);
      },

      // Acción de logout
      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          tokens: null,
          isLoading: false
        });
        
        // Limpiar token del localStorage
        localStorage.removeItem('auth_token');
        
        console.log('👋 Usuario deslogueado');
      },

      // Inicializar autenticación desde localStorage
      initializeAuth: async () => {
        set({ isLoading: true });
        
        try {
          const token = localStorage.getItem('auth_token');
          
          if (!token) {
            set({ isAuthenticated: false, isLoading: false });
            return;
          }

          // Verificar si el token es válido haciendo una llamada a la API
          try {
            const userData = await apiClient.getCurrentUser();
            
            set({
              isAuthenticated: true,
              user: userData,
              isLoading: false
            });
            
            console.log('✅ Autenticación restaurada desde localStorage');
          } catch (error) {
            // Token inválido o expirado
            localStorage.removeItem('auth_token');
            set({
              isAuthenticated: false,
              user: null,
              tokens: null,
              isLoading: false
            });
            
            console.log('❌ Token inválido, usuario no autenticado');
          }
        } catch (error) {
          console.error('Error al inicializar autenticación:', error);
          set({
            isAuthenticated: false,
            user: null,
            tokens: null,
            isLoading: false
          });
        }
      },

      // Refrescar tokens
      refreshTokens: async (): Promise<boolean> => {
        try {
          const currentTokens = get().tokens;
          
          if (!currentTokens?.refreshToken) {
            return false;
          }

          // Aquí implementarías la lógica de refresh token
          // Por ahora, simplemente retornamos false
          console.log('🔄 Refrescando tokens...');
          return false;
        } catch (error) {
          console.error('Error al refrescar tokens:', error);
          return false;
        }
      },

      // Actualizar información del usuario
      updateUser: (userData: Partial<AuthUser>) => {
        const currentUser = get().user;
        
        if (currentUser) {
          set({
            user: { ...currentUser, ...userData }
          });
        }
      }
    }),
    {
      name: 'mltrack-auth',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        tokens: state.tokens
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Restaurar token en localStorage si existe
          if (state.tokens?.accessToken) {
            localStorage.setItem('auth_token', state.tokens.accessToken);
          }
        }
      }
    }
  )
);
