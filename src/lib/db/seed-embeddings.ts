import { db } from "./connection";
import { icons } from "./schema";
import { sql, eq, isNull } from "drizzle-orm";
import { embedMany } from "ai";
import { createGateway } from "@ai-sdk/gateway";

const gateway = createGateway({ apiKey: process.env.VERCEL_AI_GATEWAY });
const embeddingModel = gateway.embeddingModel("google/gemini-embedding-001");

const EMBED_BATCH = parseInt(process.env.EMBED_BATCH || "250");
const BATCH_DELAY_MS = parseInt(process.env.EMBED_DELAY || "200");

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
  const rows = await db
    .select({ id: icons.id, name: icons.name, tags: icons.tags, category: icons.category })
    .from(icons)
    .where(isNull(icons.embedding));
  console.log(`Found ${rows.length} icons to embed`);

  if (rows.length === 0) {
    console.log("All icons already have embeddings.");
    return;
  }

  let processed = 0;

  for (let i = 0; i < rows.length; i += EMBED_BATCH) {
    const chunk = rows.slice(i, i + EMBED_BATCH);
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
    for (let j = 0; j < chunk.length; j++) {
      const vectorStr = `[${embeddings[j].join(",")}]`;
      await db.execute(
        sql`UPDATE icons SET embedding = ${vectorStr}::vector WHERE id = ${chunk[j].id}`
      );
    }

    processed += chunk.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = (processed / parseInt(elapsed || "1")).toFixed(1);
    console.log(`  ${processed}/${rows.length} embedded (${elapsed}s, ${rate}/s)`);

    // Rate limit delay between batches
    if (i + EMBED_BATCH < rows.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Done! ${processed} embeddings seeded in ${elapsed}s`);
}

seedEmbeddings().catch((err) => {
  console.error("Embedding seed failed:", err);
  process.exit(1);
});
