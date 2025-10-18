import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { OfflineStore, OfflineData, Product, Search, SearchResult, SyncHistory } from '@/types';

/**
 * Store offline usando Zustand e IndexedDB
 * Maneja el almacenamiento local de datos para funcionamiento offline
 */

interface OfflineStoreState extends OfflineStore {
  // Acciones
  initializeOfflineStore: () => Promise<void>;
  syncData: (data: Partial<OfflineData>) => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (productId: number, updates: Partial<Product>) => Promise<void>;
  removeProduct: (productId: number) => Promise<void>;
  addSearch: (search: Search) => Promise<void>;
  updateSearch: (searchId: number, updates: Partial<Search>) => Promise<void>;
  removeSearch: (searchId: number) => Promise<void>;
  addSearchResult: (result: SearchResult) => Promise<void>;
  updateSearchResult: (resultId: number, updates: Partial<SearchResult>) => Promise<void>;
  removeSearchResult: (resultId: number) => Promise<void>;
  addSyncHistory: (history: SyncHistory) => Promise<void>;
  clearAllData: () => Promise<void>;
  addPendingAction: (action: OfflineStore['pendingActions'][0]) => Promise<void>;
  removePendingAction: (actionId: string) => Promise<void>;
  clearPendingActions: () => Promise<void>;
}

// Esquema de IndexedDB
interface MLTrackDB extends DBSchema {
  products: {
    key: number;
    value: Product;
    indexes: { 'by-seller': number; 'by-ml-item': string };
  };
  searches: {
    key: number;
    value: Search;
    indexes: { 'by-seller': number };
  };
  searchResults: {
    key: number;
    value: SearchResult;
    indexes: { 'by-search': number; 'by-ml-item': string };
  };
  syncHistory: {
    key: number;
    value: SyncHistory;
    indexes: { 'by-type': string; 'by-date': string };
  };
  pendingActions: {
    key: string;
    value: OfflineStore['pendingActions'][0];
  };
}

export const useOfflineStore = create<OfflineStoreState>()(
  persist(
    (set, get) => ({
      // Estado inicial
      isOnline: navigator.onLine,
      lastSync: null,
      data: {
        products: [],
        searches: [],
        searchResults: [],
        syncHistory: [],
        lastSync: null
      },
      pendingActions: [],

      // Inicializar store offline
      initializeOfflineStore: async () => {
        try {
          console.log('🗄️ Inicializando store offline...');
          
          // Crear/abrir base de datos IndexedDB
          const db = await openDB<MLTrackDB>('mltrack-offline', 1, {
            upgrade(db) {
              // Store de productos
              const productsStore = db.createObjectStore('products', {
                keyPath: 'id',
                autoIncrement: true
              });
              productsStore.createIndex('by-seller', 'sellerId');
              productsStore.createIndex('by-ml-item', 'mlItemId');

              // Store de búsquedas
              const searchesStore = db.createObjectStore('searches', {
                keyPath: 'id',
                autoIncrement: true
              });
              searchesStore.createIndex('by-seller', 'sellerId');

              // Store de resultados de búsqueda
              const searchResultsStore = db.createObjectStore('searchResults', {
                keyPath: 'id',
                autoIncrement: true
              });
              searchResultsStore.createIndex('by-search', 'searchId');
              searchResultsStore.createIndex('by-ml-item', 'mlItemId');

              // Store de historial de sincronización
              const syncHistoryStore = db.createObjectStore('syncHistory', {
                keyPath: 'id',
                autoIncrement: true
              });
              syncHistoryStore.createIndex('by-type', 'type');
              syncHistoryStore.createIndex('by-date', 'syncedAt');

              // Store de acciones pendientes
              db.createObjectStore('pendingActions', {
                keyPath: 'id'
              });
            }
          });

          // Cargar datos desde IndexedDB
          const [products, searches, searchResults, syncHistory, pendingActions] = await Promise.all([
            db.getAll('products'),
            db.getAll('searches'),
            db.getAll('searchResults'),
            db.getAll('syncHistory'),
            db.getAll('pendingActions')
          ]);

          set({
            data: {
              products,
              searches,
              searchResults,
              syncHistory,
              lastSync: null
            },
            pendingActions
          });

          // Configurar listeners de conectividad
          window.addEventListener('online', () => {
            set({ isOnline: true });
            console.log('🌐 Conexión online restaurada');
          });

          window.addEventListener('offline', () => {
            set({ isOnline: false });
            console.log('🌐 Conexión offline');
          });

          console.log('✅ Store offline inicializado correctamente');
        } catch (error) {
          console.error('❌ Error al inicializar store offline:', error);
        }
      },

      // Sincronizar datos
      syncData: async (newData: Partial<OfflineData>) => {
        try {
          const currentData = get().data;
          const updatedData = {
            ...currentData,
            ...newData,
            lastSync: new Date().toISOString()
          };

          set({
            data: updatedData,
            lastSync: updatedData.lastSync
          });

          // Guardar en IndexedDB
          const db = await openDB<MLTrackDB>('mltrack-offline', 1);
          
          if (newData.products) {
            const tx = db.transaction('products', 'readwrite');
            await tx.store.clear();
            await Promise.all(newData.products.map(product => tx.store.add(product)));
            await tx.done;
          }

          if (newData.searches) {
            const tx = db.transaction('searches', 'readwrite');
            await tx.store.clear();
            await Promise.all(newData.searches.map(search => tx.store.add(search)));
            await tx.done;
          }

          if (newData.searchResults) {
            const tx = db.transaction('searchResults', 'readwrite');
            await tx.store.clear();
            await Promise.all(newData.searchResults.map(result => tx.store.add(result)));
            await tx.done;
          }

          if (newData.syncHistory) {
            const tx = db.transaction('syncHistory', 'readwrite');
            await tx.store.clear();
            await Promise.all(newData.syncHistory.map(history => tx.store.add(history)));
            await tx.done;
          }

          console.log('✅ Datos sincronizados en store offline');
        } catch (error) {
          console.error('❌ Error al sincronizar datos:', error);
        }
      },

      // Productos
      addProduct: async (product: Product) => {
        try {
          const db = await openDB<MLTrackDB>('mltrack-offline', 1);
          await db.add('products', product);
          
          set(state => ({
            data: {
              ...state.data,
              products: [...state.data.products, product]
            }
          }));
        } catch (error) {
          console.error('Error al agregar producto:', error);
        }
      },

      updateProduct: async (productId: number, updates: Partial<Product>) => {
        try {
          const db = await openDB<MLTrackDB>('mltrack-offline', 1);
          const existing = await db.get('products', productId);
          
          if (existing) {
            const updated = { ...existing, ...updates };
            await db.put('products', updated);
            
            set(state => ({
              data: {
                ...state.data,
                products: state.data.products.map(p => 
                  p.id === productId ? updated : p
                )
              }
            }));
          }
        } catch (error) {
          console.error('Error al actualizar producto:', error);
        }
      },

      removeProduct: async (productId: number) => {
        try {
          const db = await openDB<MLTrackDB>('mltrack-offline', 1);
          await db.delete('products', productId);
          
          set(state => ({
            data: {
              ...state.data,
              products: state.data.products.filter(p => p.id !== productId)
            }
          }));
        } catch (error) {
          console.error('Error al eliminar producto:', error);
        }
      },

      // Búsquedas
      addSearch: async (search: Search) => {
        try {
          const db = await openDB<MLTrackDB>('mltrack-offline', 1);
          await db.add('searches', search);
          
          set(state => ({
            data: {
              ...state.data,
              searches: [...state.data.searches, search]
            }
          }));
        } catch (error) {
          console.error('Error al agregar búsqueda:', error);
        }
      },

      updateSearch: async (searchId: number, updates: Partial<Search>) => {
        try {
          const db = await openDB<MLTrackDB>('mltrack-offline', 1);
          const existing = await db.get('searches', searchId);
          
          if (existing) {
            const updated = { ...existing, ...updates };
            await db.put('searches', updated);
            
            set(state => ({
              data: {
                ...state.data,
                searches: state.data.searches.map(s => 
                  s.id === searchId ? updated : s
                )
              }
            }));
          }
        } catch (error) {
          console.error('Error al actualizar búsqueda:', error);
        }
      },

      removeSearch: async (searchId: number) => {
        try {
          const db = await openDB<MLTrackDB>('mltrack-offline', 1);
          await db.delete('searches', searchId);
          
          set(state => ({
            data: {
              ...state.data,
              searches: state.data.searches.filter(s => s.id !== searchId)
            }
          }));
        } catch (error) {
          console.error('Error al eliminar búsqueda:', error);
        }
      },

      // Resultados de búsqueda
      addSearchResult: async (result: SearchResult) => {
        try {
          const db = await openDB<MLTrackDB>('mltrack-offline', 1);
          await db.add('searchResults', result);
          
          set(state => ({
            data: {
              ...state.data,
              searchResults: [...state.data.searchResults, result]
            }
          }));
        } catch (error) {
          console.error('Error al agregar resultado de búsqueda:', error);
        }
      },

      updateSearchResult: async (resultId: number, updates: Partial<SearchResult>) => {
        try {
          const db = await openDB<MLTrackDB>('mltrack-offline', 1);
          const existing = await db.get('searchResults', resultId);
          
          if (existing) {
            const updated = { ...existing, ...updates };
            await db.put('searchResults', updated);
            
            set(state => ({
              data: {
                ...state.data,
                searchResults: state.data.searchResults.map(r => 
                  r.id === resultId ? updated : r
                )
              }
            }));
          }
        } catch (error) {
          console.error('Error al actualizar resultado de búsqueda:', error);
        }
      },

      removeSearchResult: async (resultId: number) => {
        try {
          const db = await openDB<MLTrackDB>('mltrack-offline', 1);
          await db.delete('searchResults', resultId);
          
          set(state => ({
            data: {
              ...state.data,
              searchResults: state.data.searchResults.filter(r => r.id !== resultId)
            }
          }));
        } catch (error) {
          console.error('Error al eliminar resultado de búsqueda:', error);
        }
      },

      // Historial de sincronización
      addSyncHistory: async (history: SyncHistory) => {
        try {
          const db = await openDB<MLTrackDB>('mltrack-offline', 1);
          await db.add('syncHistory', history);
          
          set(state => ({
            data: {
              ...state.data,
              syncHistory: [...state.data.syncHistory, history]
            }
          }));
        } catch (error) {
          console.error('Error al agregar historial de sincronización:', error);
        }
      },

      // Limpiar todos los datos
      clearAllData: async () => {
        try {
          const db = await openDB<MLTrackDB>('mltrack-offline', 1);
          
          await Promise.all([
            db.clear('products'),
            db.clear('searches'),
            db.clear('searchResults'),
            db.clear('syncHistory'),
            db.clear('pendingActions')
          ]);

          set({
            data: {
              products: [],
              searches: [],
              searchResults: [],
              syncHistory: [],
              lastSync: null
            },
            pendingActions: [],
            lastSync: null
          });

          console.log('✅ Todos los datos offline eliminados');
        } catch (error) {
          console.error('❌ Error al limpiar datos offline:', error);
        }
      },

      // Acciones pendientes
      addPendingAction: async (action: OfflineStore['pendingActions'][0]) => {
        try {
          const db = await openDB<MLTrackDB>('mltrack-offline', 1);
          await db.add('pendingActions', action);
          
          set(state => ({
            pendingActions: [...state.pendingActions, action]
          }));
        } catch (error) {
          console.error('Error al agregar acción pendiente:', error);
        }
      },

      removePendingAction: async (actionId: string) => {
        try {
          const db = await openDB<MLTrackDB>('mltrack-offline', 1);
          await db.delete('pendingActions', actionId);
          
          set(state => ({
            pendingActions: state.pendingActions.filter(a => a.id !== actionId)
          }));
        } catch (error) {
          console.error('Error al eliminar acción pendiente:', error);
        }
      },

      clearPendingActions: async () => {
        try {
          const db = await openDB<MLTrackDB>('mltrack-offline', 1);
          await db.clear('pendingActions');
          
          set({ pendingActions: [] });
        } catch (error) {
          console.error('Error al limpiar acciones pendientes:', error);
        }
      }
    }),
    {
      name: 'mltrack-offline',
      partialize: (state) => ({
        isOnline: state.isOnline,
        lastSync: state.lastSync,
        pendingActions: state.pendingActions
      })
    }
  )
);
