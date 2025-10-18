import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DB_URL || 'postgresql://localhost:5432/mltrack'
  },
  verbose: true,
  strict: true
} satisfies Config;
