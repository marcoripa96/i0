import { db } from "./connection";
import { collections, icons } from "./schema";
import { sql } from "drizzle-orm";
import { lookupCollections, locate } from "@iconify/json";
import type { IconifyJSON } from "@iconify/types";
import fs from "fs";

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

function buildSearchText(
  name: string,
  tags: string,
  category: string | null,
  prefix: string,
  fullName: string,
): string {
  return `${name} ${name} ${tags} ${category || ""} ${prefix} ${fullName}`.trim();
}

async function seed() {
  console.log(
    COLLECTION_LIMIT
      ? `Seeding icon database (limit: ${COLLECTION_LIMIT} collections)...`
      : "Seeding icon database...",
  );
  const startTime = Date.now();

  // Clear existing data
  await db.delete(icons);
  await db.delete(collections);

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

  // Insert collections
  for (const { prefix, info, data } of collectionData) {
    const defaultHeight =
      data.height ||
      (data.info?.height as number | undefined) ||
      null;
    await db.insert(collections).values({
      prefix,
      name: info.name || prefix,
      total: info.total || Object.keys(data.icons).length,
      author: info.author ? JSON.stringify(info.author) : null,
      license: info.license ? JSON.stringify(info.license) : null,
      category: info.category || null,
      palette: info.palette ? true : false,
      height: typeof defaultHeight === "number" ? Math.round(defaultHeight) : null,
      version: info.version || null,
      samples: info.samples ? JSON.stringify(info.samples) : null,
    });
  }
  console.log(`Inserted ${collectionData.length} collections`);

  // Insert icons in batches
  let totalIcons = 0;
  const BATCH_SIZE = 200;
  let iconBatch: Array<typeof icons.$inferInsert> = [];

  async function flushBatch() {
    if (iconBatch.length === 0) return;
    const batch = iconBatch;
    iconBatch = [];
    await db.insert(icons).values(batch);
  }

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
      const width = Math.round(iconData.width || setWidth);
      const height = Math.round(iconData.height || setHeight);
      const fullName = `${prefix}:${iconName}`;
      const searchText = buildSearchText(iconName, tags, category, prefix, fullName);

      iconBatch.push({
        prefix,
        name: iconName,
        fullName,
        body: iconData.body,
        width,
        height,
        category,
        tags,
        searchText,
      });
      totalIcons++;

      if (iconBatch.length >= BATCH_SIZE) {
        await flushBatch();
        if (totalIcons % 10000 === 0) {
          console.log(`  ...${totalIcons} icons processed`);
        }
      }
    }
  }

  // Flush remaining icons
  await flushBatch();
  console.log(`Inserted ${totalIcons} icons`);

  // Build BM25 index
  console.log("Building BM25 index...");
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS icons_bm25_idx ON icons USING bm25(search_text) WITH (text_config='english')`
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Done! ${totalIcons} icons seeded in ${elapsed}s`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
