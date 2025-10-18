/**
 * Tipos TypeScript para la aplicación MLTrack
 * Define todas las interfaces y tipos utilizados en el frontend
 */

// ===== TIPOS BASE =====

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  details?: any;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginationResponse {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ===== AUTENTICACIÓN =====

export interface AuthUser {
  userId: string;
  sellerId: number;
  nickname: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

// ===== VENDEDORES =====

export interface Seller {
  id: number;
  mlUserId: string;
  mlNickname: string | null;
  isActive: boolean;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface SellerDetail extends Seller {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt: string;
  updatedAt: string;
}

export interface CreateSellerRequest {
  mlUserId: string;
  mlNickname: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ===== PRODUCTOS =====

export interface Product {
  id: number;
  mlItemId: string;
  sellerId: number;
  title: string;
  price: string;
  originalPrice: string | null;
  pictureUrl: string | null;
  logisticType: string | null;
  dateCreatedMl: string;
  dateUpdatedMl: string;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFilters {
  sellerId?: number;
  minPrice?: number;
  maxPrice?: number;
  logisticType?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface ProductStats {
  total: number;
  active: number;
  withDiscount: number;
  fulfillment: number;
  averagePrice: number;
  lastSync: string | null;
}

// ===== BÚSQUEDAS =====

export interface Search {
  id: number;
  query: string;
  limitItems: number;
  isActive: boolean;
  lastExecutedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sellerId: number | null;
  sellerNickname: string | null;
}

export interface CreateSearchRequest {
  query: string;
  limitItems?: number;
  sellerId?: number;
}

export interface UpdateSearchRequest {
  query?: string;
  limitItems?: number;
  isActive?: boolean;
}

export interface SearchResult {
  id: number;
  searchId: number;
  mlItemId: string;
  title: string;
  price: string;
  originalPrice: string | null;
  pictureUrl: string | null;
  sellerId: number | null;
  sellerNickname: string | null;
  position: number;
  isNew: boolean;
  foundAt: string;
  createdAt: string;
}

export interface SearchResultFilters {
  isNew?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sellerId?: number;
}

export interface SearchStats {
  total: number;
  active: number;
  recent: Search[];
  popular: Array<{
    searchId: number;
    query: string;
    resultCount: number;
  }>;
}

// ===== SINCRONIZACIÓN =====

export interface SyncHistory {
  id: number;
  sellerId: number | null;
  searchId: number | null;
  type: 'seller' | 'search';
  newItems: number;
  updatedItems: number;
  deletedItems: number;
  errorsCount: number;
  durationMs: number | null;
  status: 'completed' | 'failed' | 'partial';
  errorMessage: string | null;
  syncedAt: string;
  createdAt: string;
}

export interface SyncStatus {
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    total: number;
  };
  scheduler: {
    isRunning: boolean;
    nextExecution: string | null;
    config: {
      intervalMs: number;
      maxConcurrentSyncs: number;
      retryDelayMs: number;
    };
  };
  lastSync: {
    sellers: SyncHistory | null;
    searches: SyncHistory | null;
  };
}

export interface SyncJob {
  id: string;
  type: 'seller' | 'search';
  sellerId?: number;
  searchId?: number;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// ===== SOCKET.IO =====

export interface SocketEvents {
  // Eventos del servidor al cliente
  'sync:started': (data: { type: 'seller' | 'search'; id: number }) => void;
  'sync:progress': (data: { jobId: string; progress: number }) => void;
  'sync:completed': (data: { jobId: string; result: SyncHistory }) => void;
  'sync:failed': (data: { jobId: string; error: string }) => void;
  'scheduler:started': () => void;
  'scheduler:stopped': () => void;
  'notification': (data: { type: 'info' | 'success' | 'warning' | 'error'; message: string; title?: string }) => void;
  
  // Eventos del cliente al servidor
  'join-room': (room: string) => void;
  'leave-room': (room: string) => void;
}

// ===== CONFIGURACIÓN =====

export interface SystemConfig {
  key: string;
  value: any;
  description?: string;
  updatedAt: string;
  createdAt: string;
}

export interface SystemInfo {
  name: string;
  version: string;
  environment: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  scheduler: {
    isRunning: boolean;
    nextExecution: string | null;
  };
}

// ===== NOTIFICACIONES =====

export interface NotificationConfig {
  id: string;
  type: 'price_drop' | 'new_item' | 'stock_change' | 'search_result';
  enabled: boolean;
  conditions: {
    minPrice?: number;
    maxPrice?: number;
    discountPercentage?: number;
    sellerId?: number;
    searchId?: number;
  };
  channels: ('browser' | 'email')[];
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

// ===== OFFLINE STORE =====

export interface OfflineData {
  products: Product[];
  searches: Search[];
  searchResults: SearchResult[];
  syncHistory: SyncHistory[];
  lastSync: string;
}

export interface OfflineStore {
  isOnline: boolean;
  lastSync: string | null;
  data: OfflineData;
  pendingActions: Array<{
    id: string;
    type: 'create' | 'update' | 'delete';
    entity: 'product' | 'search' | 'searchResult';
    data: any;
    timestamp: string;
  }>;
}

// ===== FILTROS Y BÚSQUEDA =====

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
  label: string;
}

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

// ===== DASHBOARD =====

export interface DashboardStats {
  totalSellers: number;
  activeSellers: number;
  totalProducts: number;
  totalSearches: number;
  activeSearches: number;
  lastSync: string | null;
  syncStatus: 'idle' | 'running' | 'error';
  recentActivity: Array<{
    type: 'sync' | 'search' | 'product';
    message: string;
    timestamp: string;
  }>;
}

// ===== ERRORES =====

export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

// ===== UTILIDADES =====

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

// ===== CONSTANTES =====

export const SYNC_TYPES = {
  SELLER: 'seller' as const,
  SEARCH: 'search' as const,
} as const;

export const SYNC_STATUS = {
  COMPLETED: 'completed' as const,
  FAILED: 'failed' as const,
  PARTIAL: 'partial' as const,
} as const;

export const NOTIFICATION_TYPES = {
  INFO: 'info' as const,
  SUCCESS: 'success' as const,
  WARNING: 'warning' as const,
  ERROR: 'error' as const,
} as const;

export const ENTITY_TYPES = {
  PRODUCT: 'product' as const,
  SEARCH: 'search' as const,
  SEARCH_RESULT: 'searchResult' as const,
  SELLER: 'seller' as const,
  SYNC_HISTORY: 'syncHistory' as const,
} as const;
