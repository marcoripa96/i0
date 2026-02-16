import { z } from "zod";
import { eq, and, sql, type SQL } from "drizzle-orm";
import { type ToolMetadata, type InferSchema, type ToolExtraArguments } from "xmcp";
import { db } from "../lib/db/connection";
import { icons, collections, user } from "../lib/db/schema";
import { hybridSearch, type SearchResult } from "../lib/icons/search";
import { failure, success } from "../lib/mcp/response";

const MAX_OFFSET = 1000;

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
  limit: z.coerce.number().int().min(1).max(100).default(20).describe(
    "Max results to return (default 20, max 100)"
  ),
  offset: z.coerce.number().int().min(0).max(MAX_OFFSET).default(0).describe(
    `Skip first N results for pagination. Use 'nextOffset' from previous response. Max ${MAX_OFFSET}.`
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
  const [result] = await db
    .select({ prefix: collections.prefix })
    .from(collections)
    .where(eq(collections.prefix, prefix))
    .limit(1);
  return !!result;
}

function buildResponse(rows: SearchResult[], maxResults: number, skip: number) {
  const hasMore = rows.length > maxResults;
  const results = rows.slice(0, maxResults);

  return success({
    results,
    pagination: {
      count: results.length,
      limit: maxResults,
      offset: skip,
      hasMore,
      ...(hasMore ? { nextOffset: skip + maxResults } : {}),
    },
  });
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

type UsageError = {
  code: "AUTH_INVALID" | "RATE_LIMIT";
  message: string;
  hint: string;
};

async function checkAndIncrementUsage(userId: string): Promise<UsageError | null> {
  const [userData] = await db
    .select({ searchLimit: user.searchLimit })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!userData) {
    return {
      code: "AUTH_INVALID",
      message: "User not found for current token.",
      hint: "Reauthenticate and retry with a valid token.",
    };
  }

  const today = todayDate();

  if (userData.searchLimit <= 0) {
    return {
      code: "RATE_LIMIT",
      message: `Daily search limit reached (${userData.searchLimit}). Resets tomorrow.`,
      hint: "Wait until the next UTC day reset, or increase the user's search limit.",
    };
  }

  const rows = await db.execute<{ searchCount: number }>(sql`
    INSERT INTO daily_usage (user_id, date, search_count)
    VALUES (${userId}, ${today}, 1)
    ON CONFLICT (user_id, date)
    DO UPDATE SET search_count = daily_usage.search_count + 1
    WHERE daily_usage.search_count < ${userData.searchLimit}
    RETURNING search_count AS "searchCount"
  `);

  if ((rows as { searchCount: number }[]).length === 0) {
    return {
      code: "RATE_LIMIT",
      message: `Daily search limit reached (${userData.searchLimit}). Resets tomorrow.`,
      hint: "Wait until the next UTC day reset, or increase the user's search limit.",
    };
  }

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
  try {
    const normalizedQuery = query?.trim();
    const normalizedCollection = collection?.trim().toLowerCase();
    const normalizedCategory = category?.trim();
    const normalizedLicense = license?.trim();

    if (query !== undefined && !normalizedQuery) {
      return failure({
        code: "INVALID_PARAMS",
        message: "Query cannot be blank.",
        hint: "Try keywords like 'home', 'arrow', or 'user'.",
      });
    }

    if (!normalizedQuery && !normalizedCollection && !normalizedLicense) {
      return failure({
        code: "INVALID_PARAMS",
        message: "Provide a search query, a collection prefix, or a license filter.",
        hint: "Use list-collections or list-licenses to discover valid filter values.",
      });
    }

    if (normalizedCollection && !(await collectionExists(normalizedCollection))) {
      return failure({
        code: "NOT_FOUND",
        message: `Unknown collection "${normalizedCollection}".`,
        hint: "Use list-collections to discover valid prefixes.",
      });
    }

    const userId = extra.authInfo?.extra?.userId as string | undefined;
    if (userId) {
      const usageError = await checkAndIncrementUsage(userId);
      if (usageError) {
        return failure({
          code: usageError.code,
          message: usageError.message,
          hint: usageError.hint,
        });
      }
    }

    const maxResults = limit;
    const skip = offset;

    if (!normalizedQuery) {
      const conditions: SQL[] = [];
      if (normalizedCollection) {
        conditions.push(eq(icons.prefix, normalizedCollection));
      }
      if (normalizedCategory) {
        conditions.push(sql`LOWER(${icons.category}) = LOWER(${normalizedCategory})`);
      }
      if (normalizedLicense) {
        conditions.push(
          sql`${icons.prefix} IN (SELECT prefix FROM collections WHERE LOWER((license::jsonb)->>'title') = LOWER(${normalizedLicense}))`
        );
      }

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
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(icons.prefix, icons.name)
          .limit(maxResults + 1)
          .offset(skip)
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

    const rows = await hybridSearch(
      normalizedQuery,
      normalizedCollection,
      normalizedCategory,
      maxResults,
      skip,
      normalizedLicense,
    );

    if (rows === null) {
      return failure({
        code: "INVALID_PARAMS",
        message: "Query contained no searchable terms.",
        hint: "Try keywords like 'home', 'arrow', or 'user'.",
      });
    }

    return buildResponse(rows, maxResults, skip);
  } catch {
    return failure({
      code: "INTERNAL",
      message: "Icon search failed due to an internal error.",
      retryable: true,
      hint: "Retry the request. If the issue persists, check database and embedding service health.",
    });
  }
}
