import { z } from "zod";
import { sql, eq, and, type SQL } from "drizzle-orm";
import { type ToolMetadata, type InferSchema } from "xmcp";
import { embed } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { db } from "../lib/db/connection";
import { icons, collections } from "../lib/db/schema";

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY });
const queryEmbeddingModel = google.embedding("gemini-embedding-001");

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

function sanitizeQuery(query: string): string {
  return query.replace(/['"*(){}[\]:^~!@#$%&\\|<>+=;,./?]/g, " ").trim();
}

function buildFtsQuery(query: string): string {
  const sanitized = sanitizeQuery(query);
  const tokens = sanitized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  const parts = tokens.map((t, i) => (i === tokens.length - 1 ? `${t}*` : t));
  return parts.join(" ");
}

type SearchResult = {
  fullName: string;
  name: string;
  prefix: string;
  collection: string;
  category: string | null;
  tags: string | null;
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

async function semanticSearch(
  query: string,
  collection: string | undefined,
  category: string | undefined,
): Promise<SearchResult[]> {
  try {
    const { embedding } = await embed({
      model: queryEmbeddingModel,
      value: query,
      providerOptions: {
        google: {
          outputDimensionality: 256,
          taskType: "RETRIEVAL_QUERY",
        },
      },
    });

    const vectorQuery = JSON.stringify(embedding);

    const rows = await db.all<SearchResult>(sql`
      SELECT
        i.full_name AS fullName,
        i.name,
        i.prefix,
        c.name AS collection,
        i.category,
        i.tags
      FROM vector_top_k('icons_embedding_idx', vector32(${vectorQuery}), 40) AS v
      JOIN icons i ON i.rowid = v.id
      JOIN collections c ON c.prefix = i.prefix
    `);

    return rows
      .filter((r) => !collection || r.prefix === collection)
      .filter((r) => !category || r.category === category);
  } catch {
    // Embedding API or vector index unavailable — fall back to FTS only
    return [];
  }
}

export default async function searchIcons({
  query,
  collection,
  category,
  limit,
  offset,
}: InferSchema<typeof schema>) {
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
    if (!collection) {
      return {
        content: [{ type: "text" as const, text: "Provide a search query, or pass a collection prefix to browse its icons." }],
        isError: true,
      };
    }

    const conditions: SQL[] = [eq(icons.prefix, collection)];
    if (category) conditions.push(eq(icons.category, category));

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
  const ftsQuery = buildFtsQuery(query);

  // Run FTS and semantic search in parallel
  const [ftsRows, semanticRows] = await Promise.all([
    ftsQuery
      ? (collection
          ? db.all<SearchResult>(sql`
              SELECT
                i.full_name AS fullName,
                i.name,
                i.prefix,
                c.name AS collection,
                i.category,
                i.tags
              FROM icons_fts fts
              JOIN icons i ON i.id = fts.rowid
              JOIN collections c ON c.prefix = i.prefix
              WHERE icons_fts MATCH ${ftsQuery}
                AND i.prefix = ${collection}
              ORDER BY bm25(icons_fts, 2.0, 10.0, 1.0, 1.0, 0.5)
              LIMIT ${maxResults + 1} OFFSET ${skip}
            `)
          : db.all<SearchResult>(sql`
              SELECT
                i.full_name AS fullName,
                i.name,
                i.prefix,
                c.name AS collection,
                i.category,
                i.tags
              FROM icons_fts fts
              JOIN icons i ON i.id = fts.rowid
              JOIN collections c ON c.prefix = i.prefix
              WHERE icons_fts MATCH ${ftsQuery}
              ORDER BY bm25(icons_fts, 2.0, 10.0, 1.0, 1.0, 0.5)
              LIMIT ${maxResults + 1} OFFSET ${skip}
            `))
      : Promise.resolve([] as SearchResult[]),
    semanticSearch(query, collection, category),
  ]);

  // Reciprocal Rank Fusion (k=60)
  const RRF_K = 60;
  const scores = new Map<string, { score: number; result: SearchResult }>();

  for (let rank = 0; rank < ftsRows.length; rank++) {
    const r = ftsRows[rank];
    const rrf = 1 / (RRF_K + rank + 1);
    const existing = scores.get(r.fullName);
    if (existing) {
      existing.score += rrf;
    } else {
      scores.set(r.fullName, { score: rrf, result: r });
    }
  }

  for (let rank = 0; rank < semanticRows.length; rank++) {
    const r = semanticRows[rank];
    const rrf = 1 / (RRF_K + rank + 1);
    const existing = scores.get(r.fullName);
    if (existing) {
      existing.score += rrf;
    } else {
      scores.set(r.fullName, { score: rrf, result: r });
    }
  }

  const merged = Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults + 1)
    .map((s) => s.result);

  if (merged.length === 0 && !ftsQuery) {
    return {
      content: [{ type: "text" as const, text: "Query contained no searchable terms. Try keywords like 'home', 'arrow', 'user'." }],
      isError: true,
    };
  }

  return buildResponse(merged, maxResults, skip);
}
