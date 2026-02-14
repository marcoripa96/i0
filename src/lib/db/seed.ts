import { createClient } from "@libsql/client";
import type { InStatement } from "@libsql/client";
import { lookupCollections, locate } from "@iconify/json";
import type { IconifyJSON } from "@iconify/types";
import fs from "fs";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const COLLECTION_LIMIT = parseInt(process.env.SEED_LIMIT || "0") || 0;

function buildTags(
  name: string,
  prefix: string,
  category: string | null,
  aliasNames: string[] | undefined,
): string {
  const words = new Set<string>();
  for (const part of name.split("-")) {
    if (part) words.add(part.toLowerCase());
  }
  words.add(prefix.toLowerCase());
  if (category) {
    for (const part of category.split(/[\s/]+/)) {
      if (part) words.add(part.toLowerCase());
    }
  }
  if (aliasNames) {
    for (const alias of aliasNames) {
      for (const part of alias.split("-")) {
        if (part) words.add(part.toLowerCase());
      }
    }
  }
  return Array.from(words).join(" ");
}

async function seed() {
  console.log(
    COLLECTION_LIMIT
      ? `Seeding icon database (limit: ${COLLECTION_LIMIT} collections)...`
      : "Seeding icon database...",
  );
  const startTime = Date.now();

  // Clear existing data (tables managed by Drizzle migrations)
  await client.batch(
    [
      "DROP TABLE IF EXISTS icons_fts",
      "DROP INDEX IF EXISTS icons_embedding_idx",
      "DELETE FROM icons",
      "DELETE FROM collections",
    ],
    "write",
  );

  // Load collection data from @iconify/json
  const allCollections = await lookupCollections();
  let prefixes = Object.keys(allCollections);
  if (COLLECTION_LIMIT > 0) {
    prefixes = prefixes.slice(0, COLLECTION_LIMIT);
  }
  console.log(`Found ${prefixes.length} collections`);

  const collectionData: Array<{
    prefix: string;
    info: (typeof allCollections)[string];
    data: IconifyJSON;
  }> = [];

  for (const prefix of prefixes) {
    try {
      const jsonPath = locate(prefix);
      const raw = fs.readFileSync(jsonPath.toString(), "utf-8");
      const data: IconifyJSON = JSON.parse(raw);
      collectionData.push({ prefix, info: allCollections[prefix], data });
    } catch (err) {
      console.warn(
        `  Skipping ${prefix}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
  console.log(
    `Loaded ${collectionData.length}/${prefixes.length} collections`,
  );

  // Insert collections in a single batch
  const collectionStmts: InStatement[] = collectionData.map(
    ({ prefix, info, data }) => {
      const defaultHeight =
        data.height ||
        (data.info?.height as number | undefined) ||
        null;
      return {
        sql: "INSERT INTO collections (prefix, name, total, author, license, category, palette, height, version, samples) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          prefix,
          info.name || prefix,
          info.total || Object.keys(data.icons).length,
          info.author ? JSON.stringify(info.author) : null,
          info.license ? JSON.stringify(info.license) : null,
          info.category || null,
          info.palette ? 1 : 0,
          typeof defaultHeight === "number" ? defaultHeight : null,
          info.version || null,
          info.samples ? JSON.stringify(info.samples) : null,
        ],
      };
    },
  );
  await client.batch(collectionStmts, "write");
  console.log(`Inserted ${collectionStmts.length} collections`);

  // Insert icons in batches
  let totalIcons = 0;
  const BATCH_SIZE = 200;
  let iconBatch: InStatement[] = [];

  for (const { prefix, data } of collectionData) {
    const categoryMap: Record<string, string> = {};
    if (data.categories) {
      for (const [catName, iconNames] of Object.entries(data.categories)) {
        for (const iconName of iconNames) {
          categoryMap[iconName] = catName;
        }
      }
    }

    const aliasMap = new Map<string, string[]>();
    if (data.aliases) {
      for (const [aliasName, aliasData] of Object.entries(data.aliases)) {
        const parent = aliasData.parent;
        let arr = aliasMap.get(parent);
        if (!arr) {
          arr = [];
          aliasMap.set(parent, arr);
        }
        arr.push(aliasName);
      }
    }

    const setWidth = data.width || 24;
    const setHeight = data.height || 24;

    for (const [iconName, iconData] of Object.entries(data.icons)) {
      const category = categoryMap[iconName] || null;
      const tags = buildTags(iconName, prefix, category, aliasMap.get(iconName));
      const width = iconData.width || setWidth;
      const height = iconData.height || setHeight;

      iconBatch.push({
        sql: "INSERT INTO icons (prefix, name, full_name, body, width, height, category, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          prefix,
          iconName,
          `${prefix}:${iconName}`,
          iconData.body,
          width,
          height,
          category,
          tags,
        ],
      });
      totalIcons++;

      if (iconBatch.length >= BATCH_SIZE) {
        await client.batch(iconBatch, "write");
        iconBatch = [];
        if (totalIcons % 10000 === 0) {
          console.log(`  ...${totalIcons} icons processed`);
        }
      }
    }
  }

  // Flush remaining icons
  if (iconBatch.length > 0) {
    await client.batch(iconBatch, "write");
  }
  console.log(`Inserted ${totalIcons} icons`);

  // Build FTS5 index
  console.log("Building FTS5 index...");
  await client.execute(`
    CREATE VIRTUAL TABLE IF NOT EXISTS icons_fts USING fts5(
      full_name, name, prefix, category, tags,
      content='icons', content_rowid='id',
      tokenize='porter ascii'
    )
  `);
  await client.execute("INSERT INTO icons_fts(icons_fts) VALUES('rebuild')");

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Done! ${totalIcons} icons seeded in ${elapsed}s`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
