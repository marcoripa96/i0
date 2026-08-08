import { z } from "zod";
import { eq, and, sql, type SQL } from "drizzle-orm";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../lib/db/connection";
import { icons, collections, user } from "../lib/db/schema";
import { hybridSearch } from "../lib/icons/search";
import { fail, ok, type ToolResult } from "../lib/mcp/response";
import { recordEvents } from "../lib/analytics/events";
import { mcpCaller } from "../lib/analytics/mcp-caller";

const MAX_OFFSET = 1000;

async function collectionExists(prefix: string): Promise<boolean> {
  const [row] = await db
    .select({ prefix: collections.prefix })
    .from(collections)
    .where(eq(collections.prefix, prefix))
    .limit(1);
  return !!row;
}

/**
 * One id per line, with a single trailing line carrying the pagination cursor.
 * The prefix in each id is the collection, so nothing else needs repeating per row.
 */
function render(rows: { fullName: string }[], limit: number, offset: number): ToolResult {
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  if (page.length === 0) {
    return ok("No matches. Broaden the query or drop a filter.");
  }

  const cursor = hasMore ? `\n\nMore available: offset ${offset + limit}` : "";
  return ok(page.map((r) => r.fullName).join("\n") + cursor);
}

type UsageError = { code: "AUTH_INVALID" | "RATE_LIMIT"; message: string };

async function checkAndIncrementUsage(userId: string): Promise<UsageError | null> {
  const [userData] = await db
    .select({ searchLimit: user.searchLimit })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!userData) {
    return { code: "AUTH_INVALID", message: "User not found for this token. Reauthenticate." };
  }

  const limitReached = {
    code: "RATE_LIMIT" as const,
    message: `Daily search limit of ${userData.searchLimit} reached. Resets at the next UTC day.`,
  };

  if (userData.searchLimit <= 0) return limitReached;

  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.execute<{ searchCount: number }>(sql`
    INSERT INTO daily_usage (user_id, date, search_count)
    VALUES (${userId}, ${today}, 1)
    ON CONFLICT (user_id, date)
    DO UPDATE SET search_count = daily_usage.search_count + 1
    WHERE daily_usage.search_count < ${userData.searchLimit}
    RETURNING search_count AS "searchCount"
  `);

  return (rows as { searchCount: number }[]).length === 0 ? limitReached : null;
}

export function registerSearchIcons(server: McpServer) {
  server.registerTool(
    "search-icons",
    {
      title: "Search Icons",
      description:
        "Find icons across 200k+ icons in 150+ open-source sets. Returns one `prefix:name` id per line, ready to pass to get-icon. " +
        "Give a query to search, or omit it and pass a collection to list that set's icons.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("What the icon should depict, e.g. 'shopping cart'. Omit to browse a collection."),
        collection: z.string().optional().describe("Restrict to one set by prefix, e.g. 'lucide'."),
        category: z.string().optional().describe("Restrict to a category within a set, e.g. 'Arrows'."),
        license: z.string().optional().describe("Restrict by license title, e.g. 'MIT'."),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).max(MAX_OFFSET).default(0),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ query, collection, category, license, limit, offset }, extra) => {
      try {
        const q = query?.trim();
        const prefix = collection?.trim().toLowerCase();
        const cat = category?.trim();
        const lic = license?.trim();

        if (!q && !prefix && !lic) {
          return fail(
            "INVALID_PARAMS",
            "Pass a query, a collection, or a license. Use list-collections to see prefixes.",
          );
        }

        if (prefix && !(await collectionExists(prefix))) {
          return fail("NOT_FOUND", `No collection "${prefix}". Use list-collections for valid prefixes.`);
        }

        const caller = mcpCaller(extra);
        if (caller.userId) {
          const usageError = await checkAndIncrementUsage(caller.userId);
          if (usageError) return fail(usageError.code, usageError.message);
        }

        if (!q) {
          const conditions: SQL[] = [];
          if (prefix) conditions.push(eq(icons.prefix, prefix));
          if (cat) conditions.push(sql`LOWER(${icons.category}) = LOWER(${cat})`);
          if (lic) {
            conditions.push(
              sql`${icons.prefix} IN (SELECT prefix FROM collections WHERE LOWER((license::jsonb)->>'title') = LOWER(${lic}))`,
            );
          }

          const rows = await db
            .select({ fullName: icons.fullName })
            .from(icons)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(icons.prefix, icons.name)
            .limit(limit + 1)
            .offset(offset);

          return render(rows, limit, offset);
        }

        const rows = await hybridSearch(q, prefix, cat, limit, offset, lic);
        if (rows === null) {
          return fail("INVALID_PARAMS", "Query has no searchable terms. Try words like 'home' or 'arrow'.");
        }

        // Logged on the first page only: paging through one search is still
        // one search, and counting the pages would inflate every query.
        if (offset === 0) {
          recordEvents([
            {
              eventType: "search",
              query: q,
              resultCount: Math.min(rows.length, limit),
              ...caller,
            },
          ]);
        }

        return render(rows, limit, offset);
      } catch {
        return fail("INTERNAL", "Search failed. Retry once.");
      }
    },
  );
}
