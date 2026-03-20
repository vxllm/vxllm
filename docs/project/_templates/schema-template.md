---
Status: Draft | In Review | Approved | Implemented
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
---

# Database Schema: <Feature Name>

## Overview

<Brief description of the data model for this feature.>

---

## Tables

### `<table_name>`

<Description of what this table stores.>

#### Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | No | `gen_random_uuid()` | Primary key |
| `field1` | `varchar(100)` | No | — | Description |
| `field2` | `text` | Yes | `null` | Description |
| `status` | `enum` | No | `'pending'` | Status enum |
| `amount` | `decimal(10,2)` | No | `0.00` | Amount |
| `is_active` | `boolean` | No | `true` | Active flag |
| `metadata` | `jsonb` | Yes | `null` | Additional data |
| `created_at` | `timestamptz` | No | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | No | `now()` | Last update timestamp |
| `deleted_at` | `timestamptz` | Yes | `null` | Soft delete timestamp |

#### Primary Key

- `id`

#### Foreign Keys

| Column | References | On Delete |
|--------|------------|-----------|
| `<column>` | `<table>.id` | CASCADE |

#### Indexes

| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| `idx_<table>_<column>` | `<column>` | btree | Filter by <column> |

#### Constraints

| Name | Type | Columns | Condition |
|------|------|---------|-----------|
| `chk_<table>_amount` | CHECK | `amount` | `amount >= 0` |
| `uq_<table>_name` | UNIQUE | `name` | Unique name |

---

## Enums

### `<enum_name>`

| Value | Description |
|-------|-------------|
| `value1` | Description |
| `value2` | Description |
| `value3` | Description |

```sql
CREATE TYPE <enum_name> AS ENUM ('value1', 'value2', 'value3');
```

---

## Relationships

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐
│   table_a   │       │   table_b   │
├─────────────┤       ├─────────────┤
│ id (PK)     │       │ id (PK)     │
│ name        │       │ email       │
└──────┬──────┘       └──────┬──────┘
       │                     │
       │ 1:N                 │ 1:N
       │                     │
       ▼                     ▼
┌─────────────────────────────────┐
│          <table_name>           │
├─────────────────────────────────┤
│ id (PK)                         │
│ table_a_id (FK → table_a.id)    │
│ table_b_id (FK → table_b.id)    │
│ ...                             │
└─────────────────────────────────┘
```

### Relationship Summary

| From | To | Type | Description |
|------|----|------|-------------|
| `<table>` | `<parent>` | N:1 | Each item belongs to one parent |
| `<table>` | `<child>` | 1:N | One item has many children |

---

## Drizzle Schema

```typescript
import { pgTable, uuid, varchar, text, timestamp, boolean, decimal, pgEnum, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum
export const <enumName>Enum = pgEnum('<enum_name>', ['value1', 'value2', 'value3']);

// Table
export const <tableName> = pgTable('<table_name>', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Foreign keys
  parentId: uuid('parent_id').notNull().references(() => parent.id, { onDelete: 'cascade' }),

  // Fields
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  status: <enumName>Enum('status').notNull().default('value1'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  isActive: boolean('is_active').notNull().default(true),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  parentIdx: index('idx_<table>_parent').on(table.parentId),
  statusIdx: index('idx_<table>_status').on(table.status),
  uniqueName: unique('uq_<table>_name').on(table.name, table.parentId),
}));

// Relations
export const <tableName>Relations = relations(<tableName>, ({ one, many }) => ({
  parent: one(parent, {
    fields: [<tableName>.parentId],
    references: [parent.id],
  }),
  children: many(child),
}));

// Types
export type <TypeName> = typeof <tableName>.$inferSelect;
export type New<TypeName> = typeof <tableName>.$inferInsert;
```

---

## Query Patterns

### Common Queries

```typescript
// Get all active items
const items = await db.query.<tableName>.findMany({
  where: and(
    eq(<tableName>.parentId, parentId),
    isNull(<tableName>.deletedAt)
  ),
  orderBy: desc(<tableName>.createdAt),
});

// Get with relations
const itemWithRelations = await db.query.<tableName>.findFirst({
  where: eq(<tableName>.id, id),
  with: {
    parent: true,
    children: true,
  },
});
```

---

## Migration Notes

### Initial Migration

```sql
-- Create enum
CREATE TYPE <enum_name> AS ENUM ('value1', 'value2', 'value3');

-- Create table
CREATE TABLE <table_name> (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES parent(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  status <enum_name> NOT NULL DEFAULT 'value1',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT uq_<table>_name UNIQUE (name, parent_id),
  CONSTRAINT chk_<table>_amount CHECK (amount >= 0)
);

-- Create indexes
CREATE INDEX idx_<table>_parent ON <table_name>(parent_id);
CREATE INDEX idx_<table>_status ON <table_name>(status);

-- Create updated_at trigger
CREATE TRIGGER set_<table>_updated_at
  BEFORE UPDATE ON <table_name>
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Related Documentation

- **Feature:** [feature-<name>](../features/feature-<name>.md)
- **API:** [api-<name>](../api/api-<name>.md)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial draft |
