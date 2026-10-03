import { sql } from 'drizzle-orm';
import { check, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const productStatus = pgEnum('product_status', ['active', 'inactive']);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey(),
    // No foreign key yet: the accounts table arrives with authentication.
    ownerId: uuid('owner_id').notNull(),
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
