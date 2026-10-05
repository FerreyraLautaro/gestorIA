import { sql } from 'drizzle-orm';
import { check, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accounts } from '../../accounts/infrastructure/accounts.schema.js';

export const productStatus = pgEnum('product_status', ['active', 'inactive']);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey(),
    // RESTRICT: products are soft-deleted and Phase 2 reservations will reference them,
    // so an account that owns products must never be removable (and never orphan them).
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    description: text('description'),
    price: integer('price').notNull(),
    stock: integer('stock').notNull(),
    status: productStatus('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    check('products_price_non_negative', sql`${table.price} >= 0`),
    check('products_stock_non_negative', sql`${table.stock} >= 0`),
    index('products_owner_id_created_at_idx').on(table.ownerId, table.createdAt),
  ],
);

export type ProductRow = typeof products.$inferSelect;
