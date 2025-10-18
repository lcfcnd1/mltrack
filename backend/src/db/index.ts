import { drizzle } from 'drizzle-orm/pg-js';
import pg from 'pg';
import * as schema from './schema';

// Configuración de la conexión a PostgreSQL
const pool = new pg.Pool({
  connectionString: process.env.DB_URL,
  max: 20, // Máximo de conexiones en el pool
  idleTimeoutMillis: 30000, // Tiempo antes de cerrar conexiones inactivas
  connectionTimeoutMillis: 2000, // Tiempo máximo para establecer conexión
});

// Crear instancia de Drizzle con el pool de conexiones
export const db = drizzle(pool, { schema });

// Exportar el pool para operaciones directas si es necesario
export { pool };

// Función para verificar la conexión a la base de datos
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✅ Conexión a PostgreSQL establecida correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error al conectar con PostgreSQL:', error);
    return false;
  }
}

// Función para cerrar todas las conexiones
export async function closeConnections(): Promise<void> {
  try {
    await pool.end();
    console.log('✅ Conexiones a PostgreSQL cerradas correctamente');
  } catch (error) {
    console.error('❌ Error al cerrar conexiones PostgreSQL:', error);
  }
}
