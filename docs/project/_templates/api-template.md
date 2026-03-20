---
Status: Draft | In Review | Approved | Implemented
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
---

# API: <Feature Name> (oRPC)

## Overview

<Brief description of what this API handles.>

**Router:** `<feature>Router`

**Authentication:** Required (unless noted)

---

## Procedures Summary

| Type | Procedure | Description | Auth |
|------|-----------|-------------|------|
| Query | `<feature>.list` | List all items | <Role> |
| Query | `<feature>.get` | Get single item | <Role> |
| Mutation | `<feature>.create` | Create new item | <Role> |
| Mutation | `<feature>.update` | Update item | <Role> |
| Mutation | `<feature>.delete` | Delete item | <Role> |

---

## Procedures Detail

### Query: `<feature>.list`

**Description:** Retrieve a list of items.

**Authentication:** <Role>

**Input Parameters:**

```typescript
{
  page?: number;          // Default: 1
  limit?: number;         // Default: 20, max: 100
  search?: string;        // Search term
  sortBy?: string;        // Sort field
  sortOrder?: 'asc' | 'desc';
}
```

**Output:**

```typescript
{
  items: Array<{
    id: string;
    // ... fields
    createdAt: Date;
    updatedAt: Date;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

---

### Query: `<feature>.get`

**Description:** Retrieve a single item by ID.

**Authentication:** <Role>

**Input Parameters:**

```typescript
{
  id: string;         // Item ID
}
```

**Output:**

```typescript
{
  id: string;
  // ... fields
  createdAt: Date;
  updatedAt: Date;
}
```

---

### Mutation: `<feature>.create`

**Description:** Create a new item.

**Authentication:** <Role>

**Input:**

```typescript
{
  field1: string;     // Min 1, Max 100 characters
  field2?: string;    // Optional field
}
```

**Output:**

```typescript
{
  id: string;
  field1: string;
  field2: string | null;
  createdAt: Date;
}
```

---

### Mutation: `<feature>.update`

**Description:** Update an existing item.

**Authentication:** <Role>

**Input:**

```typescript
{
  id: string;
  field1?: string;    // Partial update supported
  field2?: string;
}
```

**Output:**

```typescript
{
  id: string;
  field1: string;
  field2: string | null;
  updatedAt: Date;
}
```

---

### Mutation: `<feature>.delete`

**Description:** Delete an item (soft delete where applicable).

**Authentication:** <Role>

**Input:**

```typescript
{
  id: string;
}
```

**Output:**

```typescript
{
  success: true;
}
```

---

## Error Responses

All procedures may return these errors:

### `VALIDATION_ERROR`

```typescript
{
  code: "VALIDATION_ERROR",
  message: "Validation failed",
  details: [
    { field: "field1", message: "Field is required" }
  ]
}
```

### `UNAUTHORIZED`

```typescript
{
  code: "UNAUTHORIZED",
  message: "Authentication required"
}
```

### `FORBIDDEN`

```typescript
{
  code: "FORBIDDEN",
  message: "You don't have permission to perform this action"
}
```

### `NOT_FOUND`

```typescript
{
  code: "NOT_FOUND",
  message: "Resource not found"
}
```

### `CONFLICT`

```typescript
{
  code: "CONFLICT",
  message: "Resource already exists"
}
```

---

## Zod Schemas

```typescript
import { z } from 'zod';

// Create schema
export const create<Feature>Schema = z.object({
  field1: z.string().min(1).max(100),
  field2: z.string().optional(),
});

// Update schema
export const update<Feature>Schema = z.object({
  id: z.string().uuid(),
  field1: z.string().min(1).max(100).optional(),
  field2: z.string().optional(),
});

// List query schema
export const list<Feature>Schema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
```

---

## Related Documentation

- **Feature:** [feature-<name>](../features/feature-<name>.md)
- **Workflows:** [workflow-<name>-<action>](../workflows/workflow-<name>-<action>.md)
- **Database:** [schema-<name>](../database/schema-<name>.md)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial draft |
