import { db } from "./connection";
import { collections } from "./schema";
import { sql } from "drizzle-orm";
import { lookupCollections, locate } from "@iconify/json";
import type { IconifyJSON } from "@iconify/types";
import fs from "fs";

const COLLECTION_LIMIT = parseInt(process.env.SEED_LIMIT || "0") || 0;

/**
 * Re-seed a database that already holds icons.
 *
 * Off by default because this script starts by deleting every row: it runs
 * unattended as a deploy step, and a `docker compose up` that quietly wiped
 * production would be the worst possible failure mode. An empty database is
 * seeded without asking; a populated one is left alone unless this is set.
 */
const FORCE = process.env.SEED_FORCE === "1";

/**
 * Escape one value for COPY's text format.
 *
 * The rows go to the server as a tab-separated stream, so anything that could
 * be read as a delimiter has to be escaped: backslash first (or it would
 * double-escape the sequences added after it), then the three characters that
 * would otherwise end a field or a row. SVG bodies are the ones that actually
 * contain them.
 */
function copyEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function copyField(value: string | number | null): string {
  if (value === null) return "\\N";
  if (typeof value === "number") return String(value);
  return copyEscape(value);
}

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
  // Checked before anything is deleted, so an accidental run against a
  // populated database is a no-op rather than a rebuild.
  const [{ count }] = await db.execute<{ count: number }>(
    sql`SELECT count(*)::int AS count FROM icons`,
  );
  if (count > 0 && !FORCE) {
    console.log(
      `Database already has ${count} icons — nothing to do. Set SEED_FORCE=1 to re-seed from scratch.`,
    );
    return;
  }
  if (count > 0) {
    console.log(`SEED_FORCE=1: replacing ${count} existing icons.`);
  }

  console.log(
    COLLECTION_LIMIT
      ? `Seeding icon database (limit: ${COLLECTION_LIMIT} collections)...`
      : "Seeding icon database...",
  );
  const startTime = Date.now();

  // TRUNCATE rather than DELETE: it reclaims the space immediately instead of
  // leaving 341k dead tuples for autovacuum, and it resets the `icons.id`
  // sequence, so a re-seed produces the same ids as a first seed.
  await db.execute(sql`TRUNCATE icons, collections RESTART IDENTITY`);

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

  // One statement for all 223 rows rather than 223 round trips.
  await db.insert(collections).values(
    collectionData.map(({ prefix, info, data }) => {
      const defaultHeight =
        data.height ||
        (data.info?.height as number | undefined) ||
        null;
      return {
        prefix,
        name: info.name || prefix,
        total: info.total || Object.keys(data.icons).length,
        author: info.author ? JSON.stringify(info.author) : null,
        license: info.license ? JSON.stringify(info.license) : null,
        category: info.category || null,
        palette: info.palette ? true : false,
        height:
          typeof defaultHeight === "number" ? Math.round(defaultHeight) : null,
        version: info.version || null,
        samples: info.samples ? JSON.stringify(info.samples) : null,
      };
    }),
  );
  console.log(`Inserted ${collectionData.length} collections`);

  // Icons go in through COPY, not INSERT.
  //
  // The rows are known-good generated data with no conflict handling to do, so
  // the per-statement work INSERT pays for — parse, plan, round trip, one
  // transaction per batch — is pure overhead repeated 1,700 times. COPY streams
  // the whole table in one statement and one transaction.
  //
  // Written as a tab-separated text stream: `body` is the only field that
  // regularly contains characters needing escaping, and copyEscape handles it.
  //
  // Worth ~2.7x on the full 341k rows (67-73s -> 23-28s, interleaved runs on
  // one container). What is left is almost all index maintenance, measured by
  // COPYing the same file into a table carrying one index at a time: 5.7s with
  // none, +1s for each of the six btrees, +0.3s for the HNSW (every embedding
  // is null at seed time), +8.6s for the BM25. Dropping the BM25 index around
  // the load is not the win it looks like — rebuilding it afterwards costs ~7s
  // of the 8.6 back, and it would leave the table unqueryable in the middle of
  // a deploy.
  const stream = await db.$client`
    COPY icons (prefix, name, full_name, body, width, height, category, tags, search_text)
    FROM STDIN
  `.writable();

  let totalIcons = 0;
  const CHUNK_ROWS = 2000;
  let rows: string[] = [];

  async function flushBatch() {
    if (rows.length === 0) return;
    const chunk = rows.join("");
    rows = [];
    // Respect backpressure — without this the whole 500MB of SVG bodies is
    // buffered in the process while the socket drains at its own pace.
    if (!stream.write(chunk)) {
      await new Promise((resolve) => stream.once("drain", resolve));
    }
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

      rows.push(
        [
          copyField(prefix),
          copyField(iconName),
          copyField(fullName),
          copyField(iconData.body),
          copyField(width),
          copyField(height),
          copyField(category),
          copyField(tags),
          copyField(searchText),
        ].join("\t") + "\n",
      );
      totalIcons++;

      if (rows.length >= CHUNK_ROWS) {
        await flushBatch();
        if (totalIcons % 50000 < CHUNK_ROWS) {
          console.log(`  ...${totalIcons} icons processed`);
        }
      }
    }
  }

  await flushBatch();
  stream.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
  console.log(`Inserted ${totalIcons} icons`);

  // A no-op against a database built from `drizzle/`, which creates this index
  // before the seeder ever runs. Kept for the one case it still covers: a
  // developer database brought up some other way, where losing this index makes
  // every query against `icons` fail rather than just search.
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS icons_bm25_idx ON icons USING bm25(search_text) WITH (text_config='english')`
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Done! ${totalIcons} icons seeded in ${elapsed}s`);
}

// The pool has to be closed explicitly or the process lingers until
// `idle_timeout` (300s) expires with its work already done — which made a
// no-op guarded run look like a five-minute hang, and would stall the deploy,
// since compose waits for this container to exit before continuing.
seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
