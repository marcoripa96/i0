import { sql } from "drizzle-orm";
import { embed } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { db } from "../db/connection";

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY });
const queryEmbeddingModel = google.embedding("gemini-embedding-001");

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

export function buildFtsQuery(query: string): string {
  const sanitized = sanitizeQuery(query);
  const tokens = sanitized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";
  const parts = tokens.map((t, i) => (i === tokens.length - 1 ? `${t}*` : t));
  return parts.join(" ");
}

export async function hybridSearch(
  query: string,
  collection: string | undefined,
  category: string | undefined,
  limit: number,
  offset: number,
): Promise<SearchResult[] | null> {
  const ftsQuery = buildFtsQuery(query);

  let vectorQuery: string | null = null;
  try {
    const { embedding } = await embed({
      model: queryEmbeddingModel,
      value: query,
      providerOptions: {
        google: { outputDimensionality: 256, taskType: "RETRIEVAL_QUERY" },
      },
    });
    vectorQuery = JSON.stringify(embedding);
  } catch {
    // Embedding API or vector index unavailable — fall back to FTS only
  }

  if (!ftsQuery && !vectorQuery) return null;

  const k = Math.max(limit + offset + 20, 60);
  const filters = sql`${collection ? sql` AND i.prefix = ${collection}` : sql``}${category ? sql` AND i.category = ${category}` : sql``}`;

  if (ftsQuery && vectorQuery) {
    return db.all<SearchResult>(sql`
      WITH fts_matches AS (
        SELECT
          fts.rowid AS icon_id,
          row_number() OVER (ORDER BY bm25(icons_fts, 2.0, 10.0, 1.0, 1.0, 0.5)) AS rank_number
        FROM icons_fts fts
        WHERE icons_fts MATCH ${ftsQuery}
        LIMIT ${k}
      ),
      vec_matches AS (
        SELECT
          v.id AS icon_id,
          row_number() OVER () AS rank_number
        FROM vector_top_k('icons_embedding_idx', vector32(${vectorQuery}), ${k}) AS v
      ),
      rrf AS (
        SELECT
          COALESCE(fts.icon_id, vec.icon_id) AS icon_id,
          COALESCE(1.0 / (60 + fts.rank_number), 0.0) +
          COALESCE(1.0 / (60 + vec.rank_number), 0.0)
            AS score
        FROM fts_matches fts
        FULL OUTER JOIN vec_matches vec ON fts.icon_id = vec.icon_id
      )
      SELECT
        i.full_name AS fullName,
        i.name,
        i.prefix,
        c.name AS collection,
        i.category,
        i.tags
      FROM rrf
      JOIN icons i ON i.id = rrf.icon_id
      JOIN collections c ON c.prefix = i.prefix
      WHERE 1=1 ${filters}
      ORDER BY rrf.score DESC
      LIMIT ${limit + 1} OFFSET ${offset}
    `);
  }

  if (ftsQuery) {
    return db.all<SearchResult>(sql`
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
      WHERE icons_fts MATCH ${ftsQuery} ${filters}
      ORDER BY bm25(icons_fts, 2.0, 10.0, 1.0, 1.0, 0.5)
      LIMIT ${limit + 1} OFFSET ${offset}
    `);
  }

  return db.all<SearchResult>(sql`
    SELECT
      i.full_name AS fullName,
      i.name,
      i.prefix,
      c.name AS collection,
      i.category,
      i.tags
    FROM vector_top_k('icons_embedding_idx', vector32(${vectorQuery!}), ${k}) AS v
    JOIN icons i ON i.id = v.id
    JOIN collections c ON c.prefix = i.prefix
    WHERE 1=1 ${filters}
    LIMIT ${limit + 1} OFFSET ${offset}
  `);
}
