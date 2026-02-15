import { createClient } from "@libsql/client";
import type { InStatement } from "@libsql/client";
import { embedMany } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY });
const embeddingModel = google.embedding("gemini-embedding-001");

// Free tier: 100 embed requests/min. Each text in a batch counts as 1 request.
// Batch of 80 texts = 80 requests, leaving headroom. Wait 60s between batches.
const EMBED_BATCH = parseInt(process.env.EMBED_BATCH || "80");
const BATCH_DELAY_MS = parseInt(process.env.EMBED_DELAY || "60000");

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isRetryable =
        (err as { statusCode?: number }).statusCode === 429 ||
        (err as { reason?: string }).reason === "maxRetriesExceeded";
      if (isRetryable && attempt < maxRetries) {
        const delay = Math.max(30, Math.pow(2, attempt) * 15) * 1000;
        console.log(`  Rate limited, retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

async function seedEmbeddings() {
  console.log("Seeding icon embeddings...");
  console.log(`  Batch size: ${EMBED_BATCH}, delay: ${BATCH_DELAY_MS / 1000}s`);
  const startTime = Date.now();

  // Fetch all icons without embeddings
  const result = await client.execute(
    "SELECT id, name, tags, category FROM icons WHERE embedding IS NULL",
  );
  const icons = result.rows;
  console.log(`Found ${icons.length} icons to embed`);

  if (icons.length === 0) {
    console.log("All icons already have embeddings.");
    // Still ensure vector index exists
    await ensureVectorIndex();
    return;
  }

  let processed = 0;

  for (let i = 0; i < icons.length; i += EMBED_BATCH) {
    const chunk = icons.slice(i, i + EMBED_BATCH);
    const texts = chunk.map((icon) =>
      `${icon.name} ${icon.tags || ""} ${icon.category || ""}`.trim(),
    );

    const { embeddings } = await withRetry(() =>
      embedMany({
        model: embeddingModel,
        values: texts,
        maxRetries: 0, // We handle retries ourselves
        providerOptions: {
          google: {
            outputDimensionality: 256,
            taskType: "RETRIEVAL_DOCUMENT",
          },
        },
      }),
    );

    // Update each icon with its embedding
    const updateStmts: InStatement[] = chunk.map((icon, j) => ({
      sql: "UPDATE icons SET embedding = vector32(?) WHERE id = ?",
      args: [`[${embeddings[j].join(",")}]`, icon.id as number],
    }));
    await client.batch(updateStmts, "write");

    processed += chunk.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = (processed / parseInt(elapsed || "1")).toFixed(1);
    console.log(`  ${processed}/${icons.length} embedded (${elapsed}s, ${rate}/s)`);

    // Rate limit delay between batches
    if (i + EMBED_BATCH < icons.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  await ensureVectorIndex();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Done! ${processed} embeddings seeded in ${elapsed}s`);
}

async function ensureVectorIndex() {
  console.log("Ensuring vector index exists...");
  await client.execute(
    "CREATE INDEX IF NOT EXISTS icons_embedding_idx ON icons(libsql_vector_idx(embedding))",
  );
}

seedEmbeddings().catch((err) => {
  console.error("Embedding seed failed:", err);
  process.exit(1);
});
