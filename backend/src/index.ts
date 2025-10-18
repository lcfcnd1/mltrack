import Fastify from 'fastify';
import cors from '@fastify/cors';
import env from '@fastify/env';
import jwt from '@fastify/jwt';
import redis from '@fastify/redis';
import { Server as SocketIOServer } from 'socket.io';
import { z } from 'zod';

// Importar configuración y servicios
import { db, testConnection, closeConnections } from './db';
import { createRedisClient, connectRedis, disconnectRedis, testRedisConnection } from './utils/redis';
import { createScheduler } from './utils/scheduler';
import { mercadoLibreService } from './services/mercadolibre';

// Importar rutas
import { authRoutes } from './routes/auth';
import { syncRoutes } from './routes/sync';
import { searchRoutes } from './routes/searches';

/**
 * Servidor principal de MLTrack
 * Configura Fastify con todas las extensiones necesarias y maneja el ciclo de vida de la aplicación
 */

// Esquema de validación para variables de entorno
const envSchema = z.object({
  ML_CLIENT_ID: z.string().min(1, 'ML_CLIENT_ID es requerido'),
  ML_CLIENT_SECRET: z.string().min(1, 'ML_CLIENT_SECRET es requerido'),
  ML_REDIRECT_URI: z.string().url('ML_REDIRECT_URI debe ser una URL válida'),
  ML_ACCESS_TOKEN: z.string().optional(),
  ML_REFRESH_TOKEN: z.string().optional(),
  DB_URL: z.string().url('DB_URL debe ser una URL de conexión válida'),
  REDIS_URL: z.string().url('REDIS_URL debe ser una URL de Redis válida'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  PORT: z.string().transform(Number).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SCHEDULER_INTERVAL: z.string().transform(Number).default('300000'), // 5 minutos
  MAX_CONCURRENT_SYNCS: z.string().transform(Number).default('3'),
  SCHEDULER_RETRY_DELAY: z.string().transform(Number).default('60000'), // 1 minuto
  FRONTEND_URL: z.string().url().optional()
});

// Crear instancia de Fastify
const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV === 'production' ? undefined : {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    }
  }
});

// Variables globales para servicios
let scheduler: ReturnType<typeof createScheduler> | null = null;
let io: SocketIOServer | null = null;

/**
 * Función para registrar plugins y configuración
 */
async function registerPlugins() {
  // Registrar plugin de variables de entorno
  await fastify.register(env, {
    schema: envSchema,
    dotenv: true
  });

  // Registrar CORS
  await fastify.register(cors, {
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.FRONTEND_URL || 'https://sqsoft.top']
      : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
  });

  // Registrar JWT
  await fastify.register(jwt, {
    secret: fastify.config.JWT_SECRET
  });

  // Registrar Redis
  await fastify.register(redis, {
    url: fastify.config.REDIS_URL
  });
}

/**
 * Función para configurar Socket.IO
 */
function setupSocketIO() {
  io = new SocketIOServer(fastify.server, {
    path: '/mltrack/socket.io',
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? [process.env.FRONTEND_URL || 'https://sqsoft.top']
        : ['http://localhost:5173', 'http://localhost:3006'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    fastify.log.info(`🔌 Cliente conectado: ${socket.id}`);

    // Unirse a sala de notificaciones generales
    socket.join('notifications');

    socket.on('join-room', (room: string) => {
      socket.join(room);
      fastify.log.info(`📢 Cliente ${socket.id} se unió a la sala: ${room}`);
    });

    socket.on('leave-room', (room: string) => {
      socket.leave(room);
      fastify.log.info(`📢 Cliente ${socket.id} salió de la sala: ${room}`);
    });

    socket.on('disconnect', () => {
      fastify.log.info(`🔌 Cliente desconectado: ${socket.id}`);
    });
  });

  // Hacer Socket.IO disponible globalmente
  fastify.decorate('io', io);
}

/**
 * Función para registrar rutas
 */
async function registerRoutes() {
  // Rutas de autenticación
  await fastify.register(authRoutes, { prefix: '/api' });
  
  // Rutas de sincronización
  await fastify.register(syncRoutes, { prefix: '/api' });
  
  // Rutas de búsquedas
  await fastify.register(searchRoutes, { prefix: '/api' });

  // Ruta de health check
  fastify.get('/health', async (request, reply) => {
    const dbHealthy = await testConnection();
    const redisHealthy = await testRedisConnection();
    const mlHealthy = await mercadoLibreService.healthCheck();

    const health = {
      status: dbHealthy && redisHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        redis: redisHealthy ? 'healthy' : 'unhealthy',
        mercadoLibre: mlHealthy ? 'healthy' : 'unhealthy'
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV
    };

    reply.status(dbHealthy && redisHealthy ? 200 : 503).send(health);
  });

  // Ruta de información del sistema
  fastify.get('/api/system/info', async (request, reply) => {
    reply.send({
      success: true,
      data: {
        name: 'MLTrack',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        scheduler: scheduler ? await scheduler.getStatus() : { isRunning: false }
      }
    });
  });
}

/**
 * Función para inicializar el scheduler
 */
async function initializeScheduler() {
  try {
    scheduler = createScheduler(fastify);
    
    // Iniciar scheduler automáticamente en producción
    if (process.env.NODE_ENV === 'production') {
      await scheduler.start();
      fastify.log.info('🚀 Scheduler iniciado automáticamente');
    } else {
      fastify.log.info('⏸️  Scheduler listo (no iniciado automáticamente en desarrollo)');
    }
  } catch (error) {
    fastify.log.error('❌ Error al inicializar scheduler:', error);
  }
}

/**
 * Función para manejar el cierre graceful del servidor
 */
async function gracefulShutdown(signal: string) {
  fastify.log.info(`📡 Recibida señal ${signal}, iniciando cierre graceful...`);

  try {
    // Detener scheduler
    if (scheduler) {
      await scheduler.stop();
      fastify.log.info('⏹️  Scheduler detenido');
    }

    // Cerrar Socket.IO
    if (io) {
      io.close();
      fastify.log.info('🔌 Socket.IO cerrado');
    }

    // Cerrar servidor Fastify
    await fastify.close();
    fastify.log.info('🛑 Servidor Fastify cerrado');

    // Cerrar conexiones a base de datos
    await closeConnections();
    fastify.log.info('🗄️  Conexiones a base de datos cerradas');

    // Cerrar conexión a Redis
    await disconnectRedis();
    fastify.log.info('🔴 Conexión a Redis cerrada');

    fastify.log.info('✅ Cierre graceful completado');
    process.exit(0);
  } catch (error) {
    fastify.log.error('❌ Error durante cierre graceful:', error);
    process.exit(1);
  }
}

/**
 * Función principal para iniciar el servidor
 */
async function start() {
  try {
    fastify.log.info('🚀 Iniciando MLTrack Backend...');

    // Registrar plugins
    await registerPlugins();
    fastify.log.info('✅ Plugins registrados');

    // Configurar Socket.IO
    setupSocketIO();
    fastify.log.info('✅ Socket.IO configurado');

    // Registrar rutas
    await registerRoutes();
    fastify.log.info('✅ Rutas registradas');

    // Conectar a Redis
    await connectRedis();
    fastify.log.info('✅ Conexión a Redis establecida');

    // Verificar conexión a base de datos
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('No se pudo conectar a la base de datos');
    }

    // Inicializar scheduler
    await initializeScheduler();

    // Configurar manejo de señales para cierre graceful
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Iniciar servidor
    const address = await fastify.listen({
      port: fastify.config.PORT,
      host: '0.0.0.0'
    });

    fastify.log.info(`🎉 Servidor MLTrack iniciado en ${address}`);
    fastify.log.info(`📊 Entorno: ${fastify.config.NODE_ENV}`);
    fastify.log.info(`🔗 Health check: ${address}/health`);
    fastify.log.info(`📚 API docs: ${address}/docs`);

  } catch (error) {
    fastify.log.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  fastify.log.error('❌ Error no capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  fastify.log.error('❌ Promesa rechazada no manejada:', reason);
  process.exit(1);
});

// Iniciar la aplicación
start();
