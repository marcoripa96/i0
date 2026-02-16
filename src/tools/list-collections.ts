import { z } from "zod";
import { ilike, eq, and, type SQL } from "drizzle-orm";
import { type ToolMetadata, type InferSchema } from "xmcp";
import { db } from "../lib/db/connection";
import { collections } from "../lib/db/schema";
import { failure, parseJsonSafe, success } from "../lib/mcp/response";

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
  try {
    const normalizedCategory = category?.trim();
    const normalizedSearch = search?.trim();

    const conditions: SQL[] = [];
    if (normalizedCategory) {
      conditions.push(eq(collections.category, normalizedCategory));
    }
    if (normalizedSearch) {
      conditions.push(ilike(collections.name, `%${normalizedSearch}%`));
    }

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
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const result = rows.map((row) => ({
      prefix: row.prefix,
      name: row.name,
      total: row.total,
      category: row.category,
      license: parseJsonSafe<Record<string, unknown>>(row.license),
      author: parseJsonSafe<Record<string, unknown>>(row.author),
      palette: row.palette,
      samples: parseJsonSafe<string[]>(row.samples) ?? [],
    }));

    return success({ total: result.length, collections: result });
  } catch {
    return failure({
      code: "INTERNAL",
      message: "Failed to list icon collections.",
      retryable: true,
      hint: "Retry the request. If the issue persists, check database connectivity.",
    });
  }
}
