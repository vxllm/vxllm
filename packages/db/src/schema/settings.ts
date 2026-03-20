import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Settings table — key-value store for application settings
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// API Keys table — server-mode authentication with permissions and rate limiting
export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull().unique(),
    label: text("label").notNull(),
    permissions: text("permissions").notNull().default("*"),
    rateLimit: integer("rate_limit"),
    lastUsedAt: integer("last_used_at"),
    expiresAt: integer("expires_at"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    idxApiKeysHash: uniqueIndex("idx_api_keys_hash").on(table.keyHash),
    idxApiKeysPrefix: uniqueIndex("idx_api_keys_prefix").on(table.keyPrefix),
  }),
);
