import { z } from "zod";
import { eq, and, sql, type SQL } from "drizzle-orm";
import { type ToolMetadata, type InferSchema, type ToolExtraArguments } from "xmcp";
import { db } from "../lib/db/connection";
import { icons, collections, user, dailyUsage } from "../lib/db/schema";
import { hybridSearch, type SearchResult } from "../lib/icons/search";

export const schema = {
  query: z.string().optional().describe(
    "Search keywords. Supports natural language like 'arrow left', 'user circle', 'shopping cart'. " +
    "Words are matched against icon names, tags, and categories. Omit to browse a collection's icons."
  ),
  collection: z.string().optional().describe(
    "Filter by collection prefix (e.g. 'mdi', 'lucide', 'tabler'). " +
    "Use list-collections to discover available prefixes. Required when query is omitted."
  ),
  category: z.string().optional().describe(
    "Filter by icon category within a collection (e.g. 'Arrows', 'Navigation'). " +
    "Categories vary by collection."
  ),
  license: z.string().optional().describe(
    "Filter by license title (e.g. 'MIT', 'Apache 2.0', 'CC BY 4.0'). " +
    "Use list-licenses to discover available license titles."
  ),
  limit: z.number().min(1).max(100).default(20).optional().describe(
    "Max results to return (default 20, max 100)"
  ),
  offset: z.number().min(0).default(0).optional().describe(
    "Skip first N results for pagination. Use 'nextOffset' from previous response."
  ),
};

export const metadata: ToolMetadata = {
  name: "search-icons",
  description:
    "Search 200k+ icons across 150+ open-source icon sets, or browse icons in a specific collection. " +
    "Returns icon identifiers you can pass directly to get-icon. " +
    "Use broad terms first ('home', 'arrow'), then narrow with collection filter if needed. " +
    "Omit query and pass collection to browse all icons in a set.",
  annotations: {
    title: "Search Icons",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
};

async function collectionExists(prefix: string): Promise<boolean> {
  const result = await db
    .select({ prefix: collections.prefix })
    .from(collections)
    .where(eq(collections.prefix, prefix))
    .get();
  return !!result;
}

function buildResponse(rows: SearchResult[], maxResults: number, skip: number) {
  const hasMore = rows.length > maxResults;
  const results = rows.slice(0, maxResults);

  const data = {
    count: results.length,
    offset: skip,
    hasMore,
    ...(hasMore ? { nextOffset: skip + maxResults } : {}),
    results,
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

async function checkAndIncrementUsage(userId: string): Promise<string | null> {
  const userData = await db
    .select({ searchLimit: user.searchLimit })
    .from(user)
    .where(eq(user.id, userId))
    .get();

  if (!userData) return "User not found.";

  const today = todayDate();

  const usage = await db
    .select({ searchCount: dailyUsage.searchCount })
    .from(dailyUsage)
    .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.date, today)))
    .get();

  const currentCount = usage?.searchCount ?? 0;

  if (currentCount >= userData.searchLimit) {
    return `Daily search limit reached (${userData.searchLimit}). Resets tomorrow.`;
  }

  await db
    .insert(dailyUsage)
    .values({ userId, date: today, searchCount: 1 })
    .onConflictDoUpdate({
      target: [dailyUsage.userId, dailyUsage.date],
      set: { searchCount: sql`${dailyUsage.searchCount} + 1` },
    });

  return null;
}

export default async function searchIcons(
  {
    query,
    collection,
    category,
    license,
    limit,
    offset,
  }: InferSchema<typeof schema>,
  extra: ToolExtraArguments,
) {
  const userId = extra.authInfo?.extra?.userId as string | undefined;
  if (userId) {
    const error = await checkAndIncrementUsage(userId);
    if (error) {
      return {
        content: [{ type: "text" as const, text: error }],
        isError: true,
      };
    }
  }

  const maxResults = limit ?? 20;
  const skip = offset ?? 0;

  if (collection && !(await collectionExists(collection))) {
    return {
      content: [{ type: "text" as const, text: `Unknown collection "${collection}". Use list-collections to discover valid prefixes.` }],
      isError: true,
    };
  }

  // Browse mode: no query, list icons from a collection
  if (!query) {
    if (!collection && !license) {
      return {
        content: [{ type: "text" as const, text: "Provide a search query, a collection prefix, or a license filter to browse icons." }],
        isError: true,
      };
    }

    const conditions: SQL[] = [];
    if (collection) conditions.push(eq(icons.prefix, collection));
    if (category) conditions.push(eq(icons.category, category));
    if (license) conditions.push(sql`json_extract(${collections.license}, '$.title') = ${license}`);

    const rows = (
      await db
        .select({
          fullName: icons.fullName,
          name: icons.name,
          prefix: icons.prefix,
          collectionName: collections.name,
          category: icons.category,
          tags: icons.tags,
        })
        .from(icons)
        .innerJoin(collections, eq(icons.prefix, collections.prefix))
        .where(and(...conditions))
        .limit(maxResults + 1)
        .offset(skip)
        .all()
    ).map((r) => ({
      fullName: r.fullName,
      name: r.name,
      prefix: r.prefix,
      collection: r.collectionName,
      category: r.category,
      tags: r.tags,
    }));

    return buildResponse(rows, maxResults, skip);
  }

  // Search mode: hybrid FTS + semantic
  const rows = await hybridSearch(query, collection, category, maxResults, skip, license);

  if (rows === null) {
    return {
      content: [{ type: "text" as const, text: "Query contained no searchable terms. Try keywords like 'home', 'arrow', 'user'." }],
      isError: true,
    };
  }

  return buildResponse(rows, maxResults, skip);
}
