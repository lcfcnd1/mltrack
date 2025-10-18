import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';
import type {
  ApiResponse,
  Seller,
  SellerDetail,
  Product,
  ProductFilters,
  Search,
  CreateSearchRequest,
  UpdateSearchRequest,
  SearchResult,
  SearchResultFilters,
  SearchStats,
  SyncHistory,
  SyncStatus,
  SystemInfo,
  DashboardStats,
  PaginationParams,
  PaginationResponse
} from '@/types';

/**
 * Cliente API para comunicación con el backend
 * Maneja autenticación, interceptores y métodos para todas las operaciones
 */

class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || '/api';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Configura interceptores para manejo de errores y autenticación
   */
  private setupInterceptors(): void {
    // Interceptor de request para agregar token de autenticación
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Interceptor de response para manejo global de errores
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        this.handleError(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Maneja errores globales de la API
   */
  private handleError(error: any): void {
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Token expirado o inválido
          localStorage.removeItem('auth_token');
          window.location.href = '/auth/mercadolibre';
          break;
          
        case 403:
          toast.error('No tienes permisos para realizar esta acción');
          break;
          
        case 404:
          toast.error('Recurso no encontrado');
          break;
          
        case 429:
          toast.error('Demasiadas solicitudes. Intenta más tarde');
          break;
          
        case 500:
          toast.error('Error interno del servidor');
          break;
          
        default:
          const message = data?.message || data?.error || 'Error desconocido';
          toast.error(message);
      }
    } else if (error.request) {
      toast.error('Error de conexión. Verifica tu conexión a internet');
    } else {
      toast.error('Error inesperado');
    }
  }

  /**
   * Método genérico para hacer requests
   */
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.request<ApiResponse<T>>(config);
      return response.data.data || response.data as T;
    } catch (error) {
      throw error;
    }
  }

  // ===== AUTENTICACIÓN =====

  /**
   * Inicia el proceso de autenticación con MercadoLibre
   */
  async initiateAuth(): Promise<void> {
    window.location.href = `${this.baseURL}/auth/mercadolibre`;
  }

  /**
   * Obtiene la información del usuario autenticado
   */
  async getCurrentUser(): Promise<any> {
    return this.request({
      method: 'GET',
      url: '/auth/me'
    });
  }

  // ===== VENDEDORES =====

  /**
   * Obtiene lista de vendedores
   */
  async getSellers(params?: PaginationParams): Promise<{ sellers: Seller[]; pagination: PaginationResponse }> {
    return this.request({
      method: 'GET',
      url: '/auth/sellers',
      params
    });
  }

  /**
   * Obtiene un vendedor específico
   */
  async getSeller(sellerId: number): Promise<SellerDetail> {
    return this.request({
      method: 'GET',
      url: `/auth/sellers/${sellerId}`
    });
  }

  /**
   * Activa o desactiva un vendedor
   */
  async toggleSeller(sellerId: number): Promise<{ isActive: boolean }> {
    return this.request({
      method: 'PUT',
      url: `/auth/sellers/${sellerId}/toggle`
    });
  }

  /**
   * Elimina un vendedor
   */
  async deleteSeller(sellerId: number): Promise<void> {
    return this.request({
      method: 'DELETE',
      url: `/auth/sellers/${sellerId}`
    });
  }

  /**
   * Fuerza la renovación del token de un vendedor
   */
  async refreshSellerToken(sellerId: number): Promise<{ expiresAt: string; expiresIn: number }> {
    return this.request({
      method: 'POST',
      url: `/auth/refresh/${sellerId}`
    });
  }

  // ===== PRODUCTOS =====

  /**
   * Obtiene lista de productos con filtros
   */
  async getProducts(
    filters?: ProductFilters & PaginationParams
  ): Promise<{ products: Product[]; pagination: PaginationResponse }> {
    return this.request({
      method: 'GET',
      url: '/products',
      params: filters
    });
  }

  /**
   * Obtiene un producto específico
   */
  async getProduct(productId: number): Promise<Product> {
    return this.request({
      method: 'GET',
      url: `/products/${productId}`
    });
  }

  /**
   * Obtiene estadísticas de productos
   */
  async getProductStats(sellerId?: number): Promise<any> {
    return this.request({
      method: 'GET',
      url: '/products/stats',
      params: { sellerId }
    });
  }

  // ===== BÚSQUEDAS =====

  /**
   * Obtiene lista de búsquedas
   */
  async getSearches(params?: PaginationParams & { isActive?: boolean; sellerId?: number; query?: string }): Promise<{
    searches: Search[];
    pagination: PaginationResponse;
  }> {
    return this.request({
      method: 'GET',
      url: '/searches',
      params
    });
  }

  /**
   * Crea una nueva búsqueda
   */
  async createSearch(data: CreateSearchRequest): Promise<Search> {
    return this.request({
      method: 'POST',
      url: '/searches',
      data
    });
  }

  /**
   * Actualiza una búsqueda existente
   */
  async updateSearch(searchId: number, data: UpdateSearchRequest): Promise<Search> {
    return this.request({
      method: 'PUT',
      url: `/searches/${searchId}`,
      data
    });
  }

  /**
   * Elimina una búsqueda
   */
  async deleteSearch(searchId: number): Promise<void> {
    return this.request({
      method: 'DELETE',
      url: `/searches/${searchId}`
    });
  }

  /**
   * Obtiene una búsqueda específica
   */
  async getSearch(searchId: number): Promise<Search> {
    return this.request({
      method: 'GET',
      url: `/searches/${searchId}`
    });
  }

  /**
   * Obtiene resultados de una búsqueda
   */
  async getSearchResults(
    searchId: number,
    filters?: SearchResultFilters & PaginationParams
  ): Promise<{
    search: Search;
    results: SearchResult[];
    pagination: PaginationResponse;
  }> {
    return this.request({
      method: 'GET',
      url: `/searches/${searchId}/results`,
      params: filters
    });
  }

  /**
   * Obtiene estadísticas de búsquedas
   */
  async getSearchStats(): Promise<SearchStats> {
    return this.request({
      method: 'GET',
      url: '/searches/stats'
    });
  }

  // ===== SINCRONIZACIÓN =====

  /**
   * Obtiene el estado actual de sincronización
   */
  async getSyncStatus(): Promise<SyncStatus> {
    return this.request({
      method: 'GET',
      url: '/sync/status'
    });
  }

  /**
   * Inicia el scheduler de sincronización
   */
  async startScheduler(): Promise<SyncStatus['scheduler']> {
    return this.request({
      method: 'POST',
      url: '/sync/scheduler',
      data: { action: 'start' }
    });
  }

  /**
   * Detiene el scheduler de sincronización
   */
  async stopScheduler(): Promise<void> {
    return this.request({
      method: 'POST',
      url: '/sync/scheduler',
      data: { action: 'stop' }
    });
  }

  /**
   * Obtiene el estado del scheduler
   */
  async getSchedulerStatus(): Promise<SyncStatus['scheduler']> {
    return this.request({
      method: 'POST',
      url: '/sync/scheduler',
      data: { action: 'status' }
    });
  }

  /**
   * Sincroniza un vendedor específico
   */
  async syncSeller(sellerId: number): Promise<{ jobId: string; sellerId: number }> {
    return this.request({
      method: 'POST',
      url: `/sync/seller/${sellerId}`
    });
  }

  /**
   * Ejecuta una búsqueda específica
   */
  async syncSearch(searchId: number): Promise<{ jobId: string; searchId: number }> {
    return this.request({
      method: 'POST',
      url: `/sync/search/${searchId}`
    });
  }

  /**
   * Sincroniza todos los vendedores y búsquedas activos
   */
  async syncAll(): Promise<{
    totalJobs: number;
    sellerJobs: number;
    searchJobs: number;
    jobs: Array<{ type: string; jobId: string; sellerId?: number; searchId?: number }>;
  }> {
    return this.request({
      method: 'POST',
      url: '/sync/all'
    });
  }

  /**
   * Obtiene historial de sincronizaciones
   */
  async getSyncHistory(params?: PaginationParams & { type?: 'seller' | 'search' }): Promise<SyncHistory[]> {
    return this.request({
      method: 'GET',
      url: '/sync/history',
      params
    });
  }

  // ===== SISTEMA =====

  /**
   * Obtiene información del sistema
   */
  async getSystemInfo(): Promise<SystemInfo> {
    return this.request({
      method: 'GET',
      url: '/system/info'
    });
  }

  /**
   * Health check del servidor
   */
  async healthCheck(): Promise<any> {
    return this.request({
      method: 'GET',
      url: '/health'
    });
  }

  // ===== DASHBOARD =====

  /**
   * Obtiene estadísticas del dashboard
   */
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request({
      method: 'GET',
      url: '/dashboard/stats'
    });
  }
}

// Instancia singleton del cliente API
export const apiClient = new ApiClient();

// Exportar también la clase para casos especiales
export { ApiClient };
