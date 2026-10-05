import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey(),
    // Stored normalized (trimmed, lowercase), so a plain unique index is case-insensitive.
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    businessName: text('business_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex('accounts_email_unique').on(table.email)],
);

export type AccountRow = typeof accounts.$inferSelect;
