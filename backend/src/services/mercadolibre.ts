import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { db } from '../db';
import { sellers } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Servicio para manejar todas las interacciones con la API de MercadoLibre
 * Incluye manejo automático de tokens, renovación y llamadas a la API
 */
export class MercadoLibreService {
  private baseURL = 'https://api.mercadolibre.com';
  private authURL = 'https://auth.mercadolibre.com.ar';
  private httpClient: AxiosInstance;

  constructor() {
    // Configurar cliente HTTP base para MercadoLibre
    this.httpClient = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 segundos de timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MLTrack/1.0.0'
      }
    });

    // Interceptor para manejar automáticamente la renovación de tokens
    this.httpClient.interceptors.request.use(async (config) => {
      if (config.headers?.Authorization && config.headers.Authorization.toString().startsWith('Bearer ')) {
        const token = config.headers.Authorization.toString().replace('Bearer ', '');
        const refreshedToken = await this.ensureValidToken(token);
        config.headers.Authorization = `Bearer ${refreshedToken}`;
      }
      return config;
    });
  }

  /**
   * Genera la URL de autorización OAuth2 para MercadoLibre
   * @param state - Estado opcional para seguridad
   * @returns URL completa de autorización
   */
  generateAuthURL(state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.ML_CLIENT_ID!,
      redirect_uri: process.env.ML_REDIRECT_URI!
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.authURL}/authorization?${params.toString()}`;
  }

  /**
   * Intercambia el código de autorización por tokens de acceso
   * @param code - Código de autorización recibido del callback
   * @returns Tokens y información del usuario
   */
  async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user_id: string;
    nickname: string;
  }> {
    try {
      const response = await axios.post(`${this.baseURL}/oauth/token`, null, {
        params: {
          grant_type: 'authorization_code',
          client_id: process.env.ML_CLIENT_ID,
          client_secret: process.env.ML_CLIENT_SECRET,
          code,
          redirect_uri: process.env.ML_REDIRECT_URI
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token, refresh_token, expires_in, user_id } = response.data;

      // Obtener información adicional del usuario
      const userInfo = await this.getUserInfo(access_token);
      
      return {
        access_token,
        refresh_token,
        expires_in,
        user_id,
        nickname: userInfo.nickname
      };
    } catch (error) {
      console.error('Error al intercambiar código por tokens:', error);
      throw new Error('Error al obtener tokens de MercadoLibre');
    }
  }

  /**
   * Renueva un token de acceso usando el refresh token
   * @param refreshToken - Token de renovación
   * @returns Nuevos tokens de acceso
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    try {
      const response = await axios.post(`${this.baseURL}/oauth/token`, null, {
        params: {
          grant_type: 'refresh_token',
          client_id: process.env.ML_CLIENT_ID,
          client_secret: process.env.ML_CLIENT_SECRET,
          refresh_token: refreshToken
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error al renovar token:', error);
      throw new Error('Error al renovar token de acceso');
    }
  }

  /**
   * Obtiene información del usuario autenticado
   * @param accessToken - Token de acceso
   * @returns Información del usuario
   */
  async getUserInfo(accessToken: string): Promise<any> {
    try {
      const response = await this.httpClient.get('/users/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error al obtener información del usuario:', error);
      throw new Error('Error al obtener información del usuario');
    }
  }

  /**
   * Verifica si un token es válido y lo renueva si es necesario
   * @param accessToken - Token a verificar
   * @returns Token válido (puede ser el mismo o uno nuevo)
   */
  private async ensureValidToken(accessToken: string): Promise<string> {
    try {
      // Buscar el vendedor por su token actual
      const seller = await db.select()
        .from(sellers)
        .where(eq(sellers.accessToken, accessToken))
        .limit(1);

      if (seller.length === 0) {
        throw new Error('Vendedor no encontrado');
      }

      const sellerData = seller[0];

      // Verificar si el token ha expirado
      if (new Date() >= sellerData.tokenExpiresAt) {
        console.log(`🔄 Token expirado para vendedor ${sellerData.mlUserId}, renovando...`);
        
        // Renovar el token
        const newTokens = await this.refreshAccessToken(sellerData.refreshToken);
        
        // Actualizar en la base de datos
        const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
        await db.update(sellers)
          .set({
            accessToken: newTokens.access_token,
            refreshToken: newTokens.refresh_token,
            tokenExpiresAt: expiresAt,
            updatedAt: new Date()
          })
          .where(eq(sellers.id, sellerData.id));

        console.log(`✅ Token renovado para vendedor ${sellerData.mlUserId}`);
        return newTokens.access_token;
      }

      return accessToken;
    } catch (error) {
      console.error('Error al verificar/renovar token:', error);
      throw error;
    }
  }

  /**
   * Obtiene los items de un vendedor específico
   * @param sellerId - ID del vendedor en MercadoLibre
   * @param accessToken - Token de acceso
   * @param offset - Desplazamiento para paginación
   * @param limit - Límite de items por página
   * @returns Lista de IDs de items
   */
  async getSellerItems(
    sellerId: string, 
    accessToken: string, 
    offset: number = 0, 
    limit: number = 50
  ): Promise<{
    results: string[];
    paging: {
      total: number;
      offset: number;
      limit: number;
    };
  }> {
    try {
      const response = await this.httpClient.get(`/users/${sellerId}/items/search`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        params: {
          offset,
          limit
        }
      });

      return response.data;
    } catch (error) {
      console.error(`Error al obtener items del vendedor ${sellerId}:`, error);
      throw new Error(`Error al obtener items del vendedor ${sellerId}`);
    }
  }

  /**
   * Obtiene detalles de múltiples items por sus IDs
   * @param itemIds - Array de IDs de items (máximo 20 por llamada)
   * @param accessToken - Token de acceso
   * @returns Array con detalles de los items
   */
  async getItemsDetails(itemIds: string[], accessToken: string): Promise<any[]> {
    try {
      // MercadoLibre permite máximo 20 items por llamada
      const batchSize = 20;
      const batches: string[][] = [];
      
      for (let i = 0; i < itemIds.length; i += batchSize) {
        batches.push(itemIds.slice(i, i + batchSize));
      }

      const allItems: any[] = [];

      for (const batch of batches) {
        const response = await this.httpClient.get('/items', {
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          params: {
            ids: batch.join(',')
          }
        });

        // La respuesta puede incluir errores para algunos items
        if (Array.isArray(response.data)) {
          allItems.push(...response.data.filter(item => !item.error));
        }
      }

      return allItems;
    } catch (error) {
      console.error('Error al obtener detalles de items:', error);
      throw new Error('Error al obtener detalles de items');
    }
  }

  /**
   * Realiza una búsqueda en MercadoLibre
   * @param query - Término de búsqueda
   * @param accessToken - Token de acceso
   * @param siteId - ID del sitio (MLA para Argentina)
   * @param limit - Límite de resultados
   * @param sort - Tipo de ordenamiento
   * @returns Resultados de la búsqueda
   */
  async searchItems(
    query: string,
    accessToken: string,
    siteId: string = 'MLA',
    limit: number = 50,
    sort: string = 'date_desc'
  ): Promise<{
    results: any[];
    paging: {
      total: number;
      offset: number;
      limit: number;
    };
  }> {
    try {
      const response = await this.httpClient.get(`/sites/${siteId}/search`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        params: {
          q: query,
          limit,
          sort
        }
      });

      return response.data;
    } catch (error) {
      console.error(`Error al buscar items con query "${query}":`, error);
      throw new Error(`Error al buscar items con query "${query}"`);
    }
  }

  /**
   * Verifica la salud de la API de MercadoLibre
   * @returns Estado de la API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/sites/MLA');
      return response.status === 200;
    } catch (error) {
      console.error('Error en health check de MercadoLibre:', error);
      return false;
    }
  }
}

// Instancia singleton del servicio
export const mercadoLibreService = new MercadoLibreService();
