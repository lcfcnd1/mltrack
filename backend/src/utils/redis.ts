import { createClient, RedisClientType } from 'redis';

/**
 * Cliente Redis para cache y colas
 * Configurado para trabajar con BullMQ y cache de sesiones
 */

let redisClient: RedisClientType | null = null;

/**
 * Crea y configura el cliente Redis
 */
export function createRedisClient(): RedisClientType {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  redisClient = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 10000,
      lazyConnect: true,
      reconnectStrategy: (retries) => {
        if (retries > 20) {
          console.error('❌ Máximo número de reintentos de conexión a Redis alcanzado');
          return new Error('Máximo número de reintentos alcanzado');
        }
        return Math.min(retries * 100, 3000);
      }
    }
  });

  // Manejar eventos de conexión
  redisClient.on('error', (error) => {
    console.error('❌ Error en cliente Redis:', error);
  });

  redisClient.on('connect', () => {
    console.log('🔗 Conectando a Redis...');
  });

  redisClient.on('ready', () => {
    console.log('✅ Redis conectado y listo');
  });

  redisClient.on('end', () => {
    console.log('🔌 Conexión a Redis cerrada');
  });

  redisClient.on('reconnecting', () => {
    console.log('🔄 Reconectando a Redis...');
  });

  return redisClient;
}

/**
 * Conecta el cliente Redis
 */
export async function connectRedis(): Promise<void> {
  const client = createRedisClient();
  
  if (!client.isOpen) {
    await client.connect();
  }
}

/**
 * Desconecta el cliente Redis
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Verifica la salud de la conexión Redis
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    const client = createRedisClient();
    
    if (!client.isOpen) {
      await client.connect();
    }
    
    await client.ping();
    return true;
  } catch (error) {
    console.error('❌ Error al verificar conexión Redis:', error);
    return false;
  }
}

/**
 * Utilidades de cache
 */
export class CacheService {
  private client: RedisClientType;

  constructor() {
    this.client = createRedisClient();
  }

  /**
   * Establece un valor en cache con TTL
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);
    
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, serializedValue);
    } else {
      await this.client.set(key, serializedValue);
    }
  }

  /**
   * Obtiene un valor del cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Error al obtener valor de cache para key ${key}:`, error);
      return null;
    }
  }

  /**
   * Elimina un valor del cache
   */
  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Verifica si una key existe en cache
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Establece múltiples valores en cache
   */
  async mset(keyValuePairs: Record<string, any>): Promise<void> {
    const serializedPairs: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(keyValuePairs)) {
      serializedPairs[key] = JSON.stringify(value);
    }
    
    await this.client.mSet(serializedPairs);
  }

  /**
   * Obtiene múltiples valores del cache
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.client.mGet(keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error('Error al obtener múltiples valores de cache:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Incrementa un valor numérico en cache
   */
  async increment(key: string, value: number = 1): Promise<number> {
    return await this.client.incrBy(key, value);
  }

  /**
   * Decrementa un valor numérico en cache
   */
  async decrement(key: string, value: number = 1): Promise<number> {
    return await this.client.decrBy(key, value);
  }

  /**
   * Obtiene todas las keys que coinciden con un patrón
   */
  async keys(pattern: string): Promise<string[]> {
    return await this.client.keys(pattern);
  }

  /**
   * Elimina todas las keys que coinciden con un patrón
   */
  async deletePattern(pattern: string): Promise<number> {
    const keys = await this.keys(pattern);
    if (keys.length === 0) return 0;
    
    return await this.client.del(keys);
  }

  /**
   * Obtiene información del servidor Redis
   */
  async getInfo(): Promise<any> {
    const info = await this.client.info();
    const lines = info.split('\r\n');
    const result: any = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    }
    
    return result;
  }
}

// Instancia singleton del servicio de cache
export const cacheService = new CacheService();
