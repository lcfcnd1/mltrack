import { pgTable, serial, text, timestamp, integer, decimal, boolean, json, varchar, bigint } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Tabla de vendedores/sellers de MercadoLibre
export const sellers = pgTable('sellers', {
  id: serial('id').primaryKey(),
  mlUserId: varchar('ml_user_id', { length: 50 }).unique().notNull(), // ID del usuario en MercadoLibre
  mlNickname: varchar('ml_nickname', { length: 100 }), // Nickname del vendedor
  accessToken: text('access_token').notNull(), // Token de acceso OAuth2
  refreshToken: text('refresh_token').notNull(), // Token de renovación
  tokenExpiresAt: timestamp('token_expires_at').notNull(), // Fecha de expiración del token
  isActive: boolean('is_active').default(true).notNull(), // Si el vendedor está activo para sincronización
  lastSyncAt: timestamp('last_sync_at'), // Última sincronización exitosa
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Tabla de productos sincronizados
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  mlItemId: varchar('ml_item_id', { length: 50 }).unique().notNull(), // ID del item en MercadoLibre
  sellerId: integer('seller_id').references(() => sellers.id).notNull(), // Referencia al vendedor
  title: text('title').notNull(), // Título del producto
  price: decimal('price', { precision: 10, scale: 2 }).notNull(), // Precio actual
  originalPrice: decimal('original_price', { precision: 10, scale: 2 }), // Precio original (para descuentos)
  pictureUrl: text('picture_url'), // URL de la imagen principal
  logisticType: varchar('logistic_type', { length: 50 }), // Tipo de logística (fulfillment, etc.)
  dateCreatedMl: timestamp('date_created_ml').notNull(), // Fecha de creación en ML
  dateUpdatedMl: timestamp('date_updated_ml').notNull(), // Fecha de última actualización en ML
  lastSyncedAt: timestamp('last_synced_at').defaultNow().notNull(), // Última vez que se sincronizó
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Tabla de búsquedas guardadas
export const searches = pgTable('searches', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id').references(() => sellers.id), // Opcional: búsqueda específica de un vendedor
  query: text('query').notNull(), // Término de búsqueda
  limitItems: integer('limit_items').default(50).notNull(), // Límite de items a buscar
  isActive: boolean('is_active').default(true).notNull(), // Si la búsqueda está activa
  lastExecutedAt: timestamp('last_executed_at'), // Última vez que se ejecutó
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Tabla de resultados de búsquedas
export const searchResults = pgTable('search_results', {
  id: serial('id').primaryKey(),
  searchId: integer('search_id').references(() => searches.id).notNull(),
  mlItemId: varchar('ml_item_id', { length: 50 }).notNull(), // ID del item encontrado
  title: text('title').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal('original_price', { precision: 10, scale: 2 }),
  pictureUrl: text('picture_url'),
  sellerId: integer('seller_id'), // ID del vendedor del item
  sellerNickname: varchar('seller_nickname', { length: 100 }),
  position: integer('position').notNull(), // Posición en los resultados
  foundAt: timestamp('found_at').defaultNow().notNull(), // Cuándo se encontró
  isNew: boolean('is_new').default(true).notNull(), // Si es un resultado nuevo
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Tabla de historial de sincronizaciones
export const syncHistory = pgTable('sync_history', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id').references(() => sellers.id), // Opcional: si es sincronización de vendedor
  searchId: integer('search_id').references(() => searches.id), // Opcional: si es sincronización de búsqueda
  type: varchar('type', { length: 20 }).notNull(), // 'seller' o 'search'
  newItems: integer('new_items').default(0).notNull(), // Cantidad de items nuevos
  updatedItems: integer('updated_items').default(0).notNull(), // Cantidad de items actualizados
  deletedItems: integer('deleted_items').default(0).notNull(), // Cantidad de items eliminados
  errorsCount: integer('errors_count').default(0).notNull(), // Cantidad de errores
  durationMs: integer('duration_ms'), // Duración en milisegundos
  status: varchar('status', { length: 20 }).default('completed').notNull(), // 'completed', 'failed', 'partial'
  errorMessage: text('error_message'), // Mensaje de error si falló
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Tabla de configuraciones del sistema
export const systemConfig = pgTable('system_config', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).unique().notNull(),
  value: json('value'), // Valor de la configuración (puede ser string, number, object, etc.)
  description: text('description'), // Descripción de la configuración
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Definición de relaciones
export const sellersRelations = relations(sellers, ({ many }) => ({
  products: many(products),
  searches: many(searches),
  syncHistory: many(syncHistory)
}));

export const productsRelations = relations(products, ({ one }) => ({
  seller: one(sellers, {
    fields: [products.sellerId],
    references: [sellers.id]
  })
}));

export const searchesRelations = relations(searches, ({ one, many }) => ({
  seller: one(sellers, {
    fields: [searches.sellerId],
    references: [sellers.id]
  }),
  searchResults: many(searchResults),
  syncHistory: many(syncHistory)
}));

export const searchResultsRelations = relations(searchResults, ({ one }) => ({
  search: one(searches, {
    fields: [searchResults.searchId],
    references: [searches.id]
  })
}));

export const syncHistoryRelations = relations(syncHistory, ({ one }) => ({
  seller: one(sellers, {
    fields: [syncHistory.sellerId],
    references: [sellers.id]
  }),
  search: one(searches, {
    fields: [syncHistory.searchId],
    references: [searches.id]
  })
}));

// Tipos TypeScript para las tablas
export type Seller = typeof sellers.$inferSelect;
export type NewSeller = typeof sellers.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type Search = typeof searches.$inferSelect;
export type NewSearch = typeof searches.$inferInsert;

export type SearchResult = typeof searchResults.$inferSelect;
export type NewSearchResult = typeof searchResults.$inferInsert;

export type SyncHistory = typeof syncHistory.$inferSelect;
export type NewSyncHistory = typeof syncHistory.$inferInsert;

export type SystemConfig = typeof systemConfig.$inferSelect;
export type NewSystemConfig = typeof systemConfig.$inferInsert;
