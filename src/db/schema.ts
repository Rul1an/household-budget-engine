import { pgTable, uuid, text, integer, timestamp, boolean, date, unique } from 'drizzle-orm/pg-core';

// Households
export const households = pgTable('households', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  ownerId: uuid('owner_id').notNull(), // References auth.users(id) in Supabase
});

// Members
export const householdMembers = pgTable('household_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').notNull(), // References auth.users(id)
  role: text('role').default('member'),
  isAccepted: boolean('is_accepted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  unq: unique().on(t.householdId, t.userId),
}));

// Accounts
export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  iban: text('iban'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Categories
export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'cascade' }), // Null = System default
  name: text('name').notNull(),
  type: text('type', { enum: ['INCOME', 'EXPENSE'] }).notNull(),
  isFixed: boolean('is_fixed').default(false),
  isAllowance: boolean('is_allowance').default(false),
});

// Transactions
export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'cascade' }).notNull(),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }).notNull(),
  categoryId: uuid('category_id').references(() => categories.id),

  date: date('date').notNull(),
  amountCents: integer('amount_cents').notNull(),
  description: text('description').notNull(),
  counterpartyName: text('counterparty_name'),
  importHash: text('import_hash').unique(),

  createdAt: timestamp('created_at').defaultNow(),
});
