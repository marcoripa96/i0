import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, uniqueIndex, index, customType } from "drizzle-orm/sqlite-core";

const float32Array = customType<{
  data: number[];
  config: { dimensions: number };
  configRequired: true;
  driverData: Buffer;
}>({
  dataType(config) {
    return `F32_BLOB(${config.dimensions})`;
  },
  fromDriver(value: Buffer) {
    return Array.from(new Float32Array(value.buffer));
  },
  toDriver(value: number[]) {
    return sql`vector32(${JSON.stringify(value)})`;
  },
});

export const collections = sqliteTable("collections", {
  prefix: text("prefix").primaryKey(),
  name: text("name").notNull(),
  total: integer("total").notNull(),
  author: text("author"),
  license: text("license"),
  category: text("category"),
  palette: integer("palette", { mode: "boolean" }),
  height: integer("height"),
  version: text("version"),
  samples: text("samples"),
});

export const icons = sqliteTable(
  "icons",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    prefix: text("prefix").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    body: text("body").notNull(),
    width: integer("width"),
    height: integer("height"),
    category: text("category"),
    tags: text("tags"),
    embedding: float32Array("embedding", { dimensions: 256 }),
  },
  (table) => [
    uniqueIndex("icons_full_name_idx").on(table.fullName),
    index("icons_prefix_idx").on(table.prefix),
    index("icons_category_idx").on(table.category),
  ]
);
