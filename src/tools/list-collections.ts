import { z } from "zod";
import { ilike, eq, and, type SQL } from "drizzle-orm";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../lib/db/connection";
import { collections } from "../lib/db/schema";
import { fail, ok, table } from "../lib/mcp/response";

export function registerListCollections(server: McpServer) {
  server.registerTool(
    "list-collections",
    {
      title: "List Icon Collections",
      description:
        "Discover icon sets and their prefixes, to filter search-icons or to match a project's existing style. " +
        "Returns prefix, name and icon count as TSV.",
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe(
            'One of: Emoji, Flags / Maps, Logos, Material, Programming, Thematic, "UI 16px / 32px", "UI 24px", "UI Multicolor", "UI Other / Mixed Grid".',
          ),
        search: z.string().optional().describe("Substring match on the set name, e.g. 'material'."),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ category, search }) => {
      try {
        const conditions: SQL[] = [];
        if (category?.trim()) conditions.push(eq(collections.category, category.trim()));
        if (search?.trim()) conditions.push(ilike(collections.name, `%${search.trim()}%`));

        // license/author/palette/samples are deliberately not returned: at ~223 rows
        // they dominated the response, and get-icon already reports the license of
        // the icon actually chosen.
        const rows = await db
          .select({
            prefix: collections.prefix,
            name: collections.name,
            total: collections.total,
          })
          .from(collections)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(collections.prefix);

        if (rows.length === 0) return ok("No collections matched.");

        return ok(table(["prefix", "name", "icons"], rows.map((r) => [r.prefix, r.name, r.total])));
      } catch {
        return fail("INTERNAL", "Could not list collections. Retry once.");
      }
    },
  );
}
