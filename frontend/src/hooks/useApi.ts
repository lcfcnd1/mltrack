import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { apiClient } from '@/services/api';
import toast from 'react-hot-toast';
import type { AsyncState, LoadingState } from '@/types';

/**
 * Hook personalizado para manejar llamadas a la API con React Query
 * Proporciona estado de carga, errores y métodos para operaciones CRUD
 */

export function useApi<T = any>(
  queryKey: string | string[],
  queryFn: () => Promise<T>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
    refetchOnWindowFocus?: boolean;
    retry?: boolean | number;
  }
) {
  const {
    data,
    isLoading,
    error,
    refetch,
    isError,
    isSuccess,
    isFetching,
    isStale,
    dataUpdatedAt
  } = useQuery({
    queryKey,
    queryFn,
    ...options
  });

  const state: AsyncState<T> = {
    data: data || null,
    loading: isLoading,
    error: error ? (error as Error).message : null
  };

  return {
    ...state,
    refetch,
    isError,
    isSuccess,
    isFetching,
    isStale,
    dataUpdatedAt,
    // Alias para compatibilidad
    isLoading
  };
}

/**
 * Hook para mutaciones (POST, PUT, DELETE)
 */
export function useApiMutation<TData = any, TVariables = any>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
    invalidateQueries?: string | string[];
    showToast?: boolean;
    successMessage?: string;
    errorMessage?: string;
  }
) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn,
    onMutate: () => {
      setLoading(true);
      setError(null);
    },
    onSuccess: (data, variables) => {
      setLoading(false);
      
      if (options?.showToast && options?.successMessage) {
        toast.success(options.successMessage);
      }
      
      // Invalidar queries relacionadas
      if (options?.invalidateQueries) {
        const queries = Array.isArray(options.invalidateQueries) 
          ? options.invalidateQueries 
          : [options.invalidateQueries];
        
        queries.forEach(queryKey => {
          queryClient.invalidateQueries(queryKey);
        });
      }
      
      options?.onSuccess?.(data, variables);
    },
    onError: (error: Error, variables) => {
      setLoading(false);
      setError(error.message);
      
      const errorMsg = options?.errorMessage || error.message;
      
      if (options?.showToast !== false) {
        toast.error(errorMsg);
      }
      
      options?.onError?.(error, variables);
    }
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    loading,
    error,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    data: mutation.data,
    reset: mutation.reset
  };
}

/**
 * Hook para operaciones CRUD específicas
 */
export function useCrudOperations<T extends { id: number }>(
  entityName: string,
  queryKey: string
) {
  const queryClient = useQueryClient();

  // Crear
  const create = useApiMutation(
    async (data: Omit<T, 'id'>) => {
      // Implementar según la entidad específica
      throw new Error(`Create operation not implemented for ${entityName}`);
    },
    {
      invalidateQueries: queryKey,
      successMessage: `${entityName} creado correctamente`,
      errorMessage: `Error al crear ${entityName}`
    }
  );

  // Actualizar
  const update = useApiMutation(
    async ({ id, ...data }: Partial<T> & { id: number }) => {
      // Implementar según la entidad específica
      throw new Error(`Update operation not implemented for ${entityName}`);
    },
    {
      invalidateQueries: queryKey,
      successMessage: `${entityName} actualizado correctamente`,
      errorMessage: `Error al actualizar ${entityName}`
    }
  );

  // Eliminar
  const remove = useApiMutation(
    async (id: number) => {
      // Implementar según la entidad específica
      throw new Error(`Delete operation not implemented for ${entityName}`);
    },
    {
      invalidateQueries: queryKey,
      successMessage: `${entityName} eliminado correctamente`,
      errorMessage: `Error al eliminar ${entityName}`
    }
  );

  // Refrescar datos
  const refresh = useCallback(() => {
    queryClient.invalidateQueries(queryKey);
  }, [queryClient, queryKey]);

  return {
    create,
    update,
    remove,
    refresh,
    isLoading: create.loading || update.loading || remove.loading
  };
}

/**
 * Hook para manejar estado de carga local
 */
export function useLoadingState(initialState: LoadingState = 'idle') {
  const [state, setState] = useState<LoadingState>(initialState);

  const setLoading = useCallback(() => setState('loading'), []);
  const setSuccess = useCallback(() => setState('success'), []);
  const setError = useCallback(() => setState('error'), []);
  const setIdle = useCallback(() => setState('idle'), []);

  const isLoading = state === 'loading';
  const isSuccess = state === 'success';
  const isError = state === 'error';
  const isIdle = state === 'idle';

  return {
    state,
    setState,
    setLoading,
    setSuccess,
    setError,
    setIdle,
    isLoading,
    isSuccess,
    isError,
    isIdle
  };
}

/**
 * Hook para manejar operaciones asíncronas con estado local
 */
export function useAsyncOperation<T = any>(
  operation: () => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
    showToast?: boolean;
    successMessage?: string;
    errorMessage?: string;
  }
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await operation();
      setData(result);
      
      if (options?.showToast && options?.successMessage) {
        toast.success(options.successMessage);
      }
      
      options?.onSuccess?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      
      if (options?.showToast !== false) {
        const msg = options?.errorMessage || errorMessage;
        toast.error(msg);
      }
      
      options?.onError?.(err as Error);
    } finally {
      setLoading(false);
    }
  }, [operation, options]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return {
    execute,
    loading,
    error,
    data,
    reset,
    isError: !!error,
    isSuccess: !!data && !error
  };
}

/**
 * Hook para manejar paginación
 */
export function usePagination(initialLimit = 20) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [total, setTotal] = useState(0);

  const offset = (page - 1) * limit;
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  const goToPage = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setPage(prev => prev + 1);
    }
  }, [hasNextPage]);

  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      setPage(prev => prev - 1);
    }
  }, [hasPreviousPage]);

  const reset = useCallback(() => {
    setPage(1);
  }, []);

  return {
    page,
    limit,
    offset,
    total,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    setPage,
    setLimit,
    setTotal,
    goToPage,
    nextPage,
    previousPage,
    reset
  };
}
