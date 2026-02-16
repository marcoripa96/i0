import { relations } from "drizzle-orm";
import { pgTable, text, integer, serial, boolean, timestamp, uniqueIndex, index, vector } from "drizzle-orm/pg-core";

export const collections = pgTable(
  "collections",
  {
    prefix: text("prefix").primaryKey(),
    name: text("name").notNull(),
    total: integer("total").notNull(),
    author: text("author"),
    license: text("license"),
    category: text("category"),
    palette: boolean("palette"),
    height: integer("height"),
    version: text("version"),
    samples: text("samples"),
  },
  (table) => [
    index("collections_category_idx").on(table.category),
  ]
);

export const icons = pgTable(
  "icons",
  {
    id: serial("id").primaryKey(),
    prefix: text("prefix").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    body: text("body").notNull(),
    width: integer("width"),
    height: integer("height"),
    category: text("category"),
    tags: text("tags"),
    searchText: text("search_text"),
    embedding: vector("embedding", { dimensions: 256 }),
  },
  (table) => [
    uniqueIndex("icons_full_name_idx").on(table.fullName),
    index("icons_prefix_name_idx").on(table.prefix, table.name),
    index("icons_category_idx").on(table.category),
    index("icons_category_prefix_name_idx").on(table.category, table.prefix, table.name),
    index("icons_prefix_category_idx").on(table.prefix, table.category),
    index("icons_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
  ]
);

// Better Auth tables

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .default(false)
    .notNull(),
  image: text("image"),
  searchLimit: integer("search_limit").default(100).notNull(),
  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const dailyUsage = pgTable(
  "daily_usage",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    searchCount: integer("search_count").default(0).notNull(),
  },
  (table) => [
    uniqueIndex("daily_usage_user_date_idx").on(table.userId, table.date),
  ],
);

export const dailyUsageRelations = relations(dailyUsage, ({ one }) => ({
  user: one(user, {
    fields: [dailyUsage.userId],
    references: [user.id],
  }),
}));

export const apiToken = pgTable(
  "api_token",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    tokenPrefix: text("token_prefix").notNull().unique(),
    tokenHash: text("token_hash").notNull().unique(),
    scopes: text("scopes").notNull().default('["icons:read"]'),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("api_token_userId_idx").on(table.userId),
    index("api_token_revokedAt_idx").on(table.revokedAt),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  apiTokens: many(apiToken),
  dailyUsage: many(dailyUsage),
}));

export const apiTokenRelations = relations(apiToken, ({ one }) => ({
  user: one(user, {
    fields: [apiToken.userId],
    references: [user.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
