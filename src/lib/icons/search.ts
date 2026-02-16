import { sql } from "drizzle-orm";
import { embed } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { db } from "../db/connection";

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY });
const queryEmbeddingModel = google.embedding("gemini-embedding-001");
const MAX_HYBRID_WINDOW = 1500;


export type SearchResult = {
  fullName: string;
  name: string;
  prefix: string;
  collection: string;
  category: string | null;
  tags: string | null;
};

function sanitizeQuery(query: string): string {
  return query.replace(/['"*(){}[\]:^~!@#$%&\\|<>+=;,./?]/g, " ").trim();
}

export function buildBm25Query(query: string): string {
  const sanitized = sanitizeQuery(query);
  const tokens = sanitized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  return tokens.join(" ");
}

export async function hybridSearch(
  query: string,
  collection: string | undefined,
  category: string | undefined,
  limit: number,
  offset: number,
  license?: string,
): Promise<SearchResult[] | null> {
  const normalizedQuery = query.trim();
  const normalizedCollection = collection?.trim().toLowerCase();
  const normalizedCategory = category?.trim();
  const normalizedLicense = license?.trim();

  const bm25Query = buildBm25Query(normalizedQuery);

  let vectorQuery: number[] | null = null;
  if (normalizedQuery) {
    try {
      const { embedding } = await embed({
        model: queryEmbeddingModel,
        value: normalizedQuery,
        providerOptions: {
          google: { outputDimensionality: 256, taskType: "RETRIEVAL_QUERY" },
        },
      });
      vectorQuery = embedding;
    } catch {
      // Embedding API unavailable — fall back to FTS only
    }
  }

  if (!bm25Query && !vectorQuery) return null;

  const k = Math.min(Math.max(limit + offset + 20, 60), MAX_HYBRID_WINDOW);
  const filters = sql`${normalizedCollection ? sql` AND i.prefix = ${normalizedCollection}` : sql``}${normalizedCategory ? sql` AND LOWER(i.category) = LOWER(${normalizedCategory})` : sql``}${normalizedLicense ? sql` AND i.prefix IN (SELECT prefix FROM collections WHERE LOWER((license::jsonb)->>'title') = LOWER(${normalizedLicense}))` : sql``}`;

  if (bm25Query && vectorQuery) {
    const vectorStr = `[${vectorQuery.join(",")}]`;
    try {
      const rows = await db.execute<SearchResult>(sql`
        WITH bm25_matches AS (
          SELECT
            i.id AS icon_id,
            row_number() OVER (ORDER BY i.search_text <@> to_bm25query(${bm25Query}, 'icons_bm25_idx')) AS rank_number
          FROM icons i
          WHERE i.search_text IS NOT NULL ${filters}
          ORDER BY i.search_text <@> to_bm25query(${bm25Query}, 'icons_bm25_idx')
          LIMIT ${k}
        ),
        vec_matches AS (
          SELECT
            i.id AS icon_id,
            row_number() OVER (ORDER BY i.embedding <=> ${vectorStr}::vector) AS rank_number
          FROM icons i
          WHERE i.embedding IS NOT NULL ${filters}
          ORDER BY i.embedding <=> ${vectorStr}::vector
          LIMIT ${k}
        ),
        rrf AS (
          SELECT
            COALESCE(bm25.icon_id, vec.icon_id) AS icon_id,
            COALESCE(1.0 / (60 + bm25.rank_number), 0.0) +
            COALESCE(1.0 / (60 + vec.rank_number), 0.0)
              AS score
          FROM bm25_matches bm25
          FULL OUTER JOIN vec_matches vec ON bm25.icon_id = vec.icon_id
        )
        SELECT
          i.full_name AS "fullName",
          i.name,
          i.prefix,
          c.name AS collection,
          i.category,
          i.tags
        FROM rrf
        JOIN icons i ON i.id = rrf.icon_id
        JOIN collections c ON c.prefix = i.prefix
        WHERE 1=1 ${filters}
        ORDER BY rrf.score DESC, i.id ASC
        LIMIT ${limit + 1} OFFSET ${offset}
      `);
      return rows as SearchResult[];
    } catch {
      // Vector index unavailable — fall through to BM25-only
    }
  }

  if (bm25Query) {
    const rows = await db.execute<SearchResult>(sql`
      SELECT
        i.full_name AS "fullName",
        i.name,
        i.prefix,
        c.name AS collection,
        i.category,
        i.tags
      FROM icons i
      JOIN collections c ON c.prefix = i.prefix
      WHERE i.search_text IS NOT NULL ${filters}
      ORDER BY i.search_text <@> to_bm25query(${bm25Query}, 'icons_bm25_idx'), i.id ASC
      LIMIT ${limit + 1} OFFSET ${offset}
    `);
    return rows as SearchResult[];
  }

  try {
    const vectorStr = `[${vectorQuery!.join(",")}]`;
    const rows = await db.execute<SearchResult>(sql`
      SELECT
        i.full_name AS "fullName",
        i.name,
        i.prefix,
        c.name AS collection,
        i.category,
        i.tags
      FROM icons i
      JOIN collections c ON c.prefix = i.prefix
      WHERE i.embedding IS NOT NULL ${filters}
      ORDER BY i.embedding <=> ${vectorStr}::vector, i.id ASC
      LIMIT ${limit + 1} OFFSET ${offset}
    `);
    return rows as SearchResult[];
  } catch {
    // Vector index unavailable and no BM25 query
    return null;
  }
}
