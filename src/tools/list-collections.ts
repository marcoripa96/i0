import { z } from "zod";
import { like, eq, and, type SQL } from "drizzle-orm";
import { type ToolMetadata, type InferSchema } from "xmcp";
import { db } from "../lib/db/connection";
import { collections } from "../lib/db/schema";

export const schema = {
  category: z.string().optional().describe(
    'Filter by category. Available categories: "Emoji", "Flags / Maps", "Logos", "Material", ' +
    '"Programming", "Thematic", "UI 16px / 32px", "UI 24px", "UI Multicolor", "UI Other / Mixed Grid".'
  ),
  search: z.string().optional().describe("Search collection names (case-insensitive substring match, e.g. 'material', 'fluent')"),
};

export const metadata: ToolMetadata = {
  name: "list-collections",
  description:
    "List available icon collections with metadata. Use this to discover collection prefixes " +
    "for filtering search-icons, or to find the right icon set for a project's style.",
  annotations: {
    title: "List Icon Collections",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
};

export default async function listCollections({
  category,
  search,
}: InferSchema<typeof schema>) {
  const conditions: SQL[] = [];
  if (category) conditions.push(eq(collections.category, category));
  if (search) conditions.push(like(collections.name, `%${search}%`));

  const rows = await db
    .select({
      prefix: collections.prefix,
      name: collections.name,
      total: collections.total,
      category: collections.category,
      license: collections.license,
      author: collections.author,
      palette: collections.palette,
      samples: collections.samples,
    })
    .from(collections)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .all();

  const result = rows.map((row) => ({
    prefix: row.prefix,
    name: row.name,
    total: row.total,
    category: row.category,
    license: row.license ? JSON.parse(row.license) : null,
    author: row.author ? JSON.parse(row.author) : null,
    palette: row.palette,
    samples: row.samples ? JSON.parse(row.samples) : [],
  }));

  const data = { total: result.length, collections: result };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}
