import { sql, eq, inArray } from "drizzle-orm";
import { db } from "../db/connection";
import { collections, icons } from "../db/schema";
import { buildFtsQuery } from "./search";
import { cacheLife, cacheTag } from "next/cache";

export type CollectionRow = {
  prefix: string;
  name: string;
  total: number;
  author: { name: string; url?: string } | null;
  license: { title: string; spdx?: string; url?: string } | null;
  category: string | null;
  palette: boolean | null;
  height: number | null;
  version: string | null;
  samples: string[] | null;
};

export type CollectionWithSamples = CollectionRow & {
  sampleIcons: { name: string; body: string; width: number; height: number }[];
};

export type IconRow = {
  id: number;
  prefix: string;
  name: string;
  fullName: string;
  body: string;
  width: number;
  height: number;
  category: string | null;
  tags: string | null;
};

export type WebSearchResult = {
  fullName: string;
  name: string;
  prefix: string;
  collection: string;
  body: string;
  width: number;
  height: number;
  category: string | null;
  tags: string | null;
};

export async function getCollections(): Promise<CollectionWithSamples[]> {
  "use cache";
  cacheLife("max");

  const rows = await db.select().from(collections).orderBy(collections.prefix).all();

  const parsed: CollectionRow[] = rows.map((r) => ({
    ...r,
    author: r.author ? JSON.parse(r.author) : null,
    license: r.license ? JSON.parse(r.license) : null,
    samples: r.samples ? JSON.parse(r.samples) : null,
  }));

  // Build list of sample icon full_names to batch-fetch
  const sampleFullNames: string[] = [];
  for (const c of parsed) {
    if (c.samples) {
      for (const s of c.samples.slice(0, 3)) {
        sampleFullNames.push(`${c.prefix}:${s}`);
      }
    }
  }

  // Batch fetch sample icons
  const sampleIcons =
    sampleFullNames.length > 0
      ? await db
          .select({
            fullName: icons.fullName,
            name: icons.name,
            body: icons.body,
            width: icons.width,
            height: icons.height,
          })
          .from(icons)
          .where(inArray(icons.fullName, sampleFullNames))
          .all()
      : [];

  const sampleMap = new Map(sampleIcons.map((i) => [i.fullName, i]));

  return parsed.map((c) => ({
    ...c,
    sampleIcons: (c.samples || [])
      .slice(0, 3)
      .map((s) => sampleMap.get(`${c.prefix}:${s}`))
      .filter(
        (i): i is { fullName: string; name: string; body: string; width: number; height: number } =>
          i != null
      )
      .map((i) => ({
        name: i.name,
        body: i.body,
        width: i.width ?? 24,
        height: i.height ?? 24,
      })),
  }));
}

export async function getCategories(): Promise<string[]> {
  "use cache";
  cacheLife("max");

  const rows = await db.all<{ category: string }>(
    sql`SELECT DISTINCT category FROM icons WHERE category IS NOT NULL AND category != '' ORDER BY category`
  );
  return rows.map((r) => r.category);
}

export async function getCategoriesForCollection(prefix: string): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(prefix);

  const rows = await db.all<{ category: string }>(
    sql`SELECT DISTINCT category FROM icons WHERE prefix = ${prefix} AND category IS NOT NULL AND category != '' ORDER BY category`
  );
  return rows.map((r) => r.category);
}

export async function getCollectionPrefixesForCategory(
  category: string
): Promise<string[]> {
  "use cache";
  cacheLife("hours");

  const rows = await db.all<{ prefix: string }>(
    sql`SELECT DISTINCT prefix FROM icons WHERE category = ${category}`
  );
  return rows.map((r) => r.prefix);
}

export async function getLicenses(): Promise<string[]> {
  "use cache";
  cacheLife("max");

  const rows = await db.all<{ title: string }>(
    sql`SELECT DISTINCT json_extract(license, '$.title') AS title FROM collections WHERE license IS NOT NULL ORDER BY title`
  );
  return rows.map((r) => r.title);
}

export async function searchIconsWeb(
  query: string,
  collection?: string,
  category?: string,
  limit = 60,
  offset = 0,
  license?: string,
): Promise<{ results: WebSearchResult[]; hasMore: boolean }> {
  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) return { results: [], hasMore: false };

  const collectionFilter = collection
    ? sql` AND i.prefix = ${collection}`
    : sql``;
  const categoryFilter = category
    ? sql` AND i.category = ${category}`
    : sql``;
  const licenseFilter = license
    ? sql` AND json_extract(c.license, '$.title') = ${license}`
    : sql``;

  const rows = await db.all<WebSearchResult>(sql`
    SELECT
      i.full_name AS fullName,
      i.name,
      i.prefix,
      c.name AS collection,
      i.body,
      COALESCE(i.width, 24) AS width,
      COALESCE(i.height, 24) AS height,
      i.category,
      i.tags
    FROM icons_fts fts
    JOIN icons i ON i.id = fts.rowid
    JOIN collections c ON c.prefix = i.prefix
    WHERE icons_fts MATCH ${ftsQuery} ${collectionFilter} ${categoryFilter} ${licenseFilter}
    ORDER BY bm25(icons_fts, 2.0, 10.0, 1.0, 1.0, 0.5)
    LIMIT ${limit + 1} OFFSET ${offset}
  `);

  return {
    results: rows.slice(0, limit),
    hasMore: rows.length > limit,
  };
}

export async function browseIcons(
  prefix: string,
  category?: string,
  limit = 60,
  offset = 0,
  license?: string,
): Promise<{ results: IconRow[]; hasMore: boolean; collection: CollectionRow | null }> {
  "use cache";
  cacheLife("hours");
  cacheTag(prefix);

  const [collectionRow] = await db
    .select()
    .from(collections)
    .where(eq(collections.prefix, prefix))
    .limit(1)
    .all();

  const parsedCollection: CollectionRow | null = collectionRow
    ? {
        ...collectionRow,
        author: collectionRow.author ? JSON.parse(collectionRow.author) : null,
        license: collectionRow.license ? JSON.parse(collectionRow.license) : null,
        samples: collectionRow.samples ? JSON.parse(collectionRow.samples) : null,
      }
    : null;

  if (license && (!parsedCollection?.license || parsedCollection.license.title !== license)) {
    return { results: [], hasMore: false, collection: parsedCollection };
  }

  const conditions = category
    ? sql`${icons.prefix} = ${prefix} AND ${icons.category} = ${category}`
    : sql`${icons.prefix} = ${prefix}`;

  const rows = await db
    .select({
      id: icons.id,
      prefix: icons.prefix,
      name: icons.name,
      fullName: icons.fullName,
      body: icons.body,
      width: icons.width,
      height: icons.height,
      category: icons.category,
      tags: icons.tags,
    })
    .from(icons)
    .where(conditions)
    .limit(limit + 1)
    .offset(offset)
    .all();

  return {
    results: rows.slice(0, limit).map((r) => ({
      ...r,
      width: r.width ?? 24,
      height: r.height ?? 24,
    })),
    hasMore: rows.length > limit,
    collection: parsedCollection,
  };
}

export async function browseByCategory(
  category: string,
  limit = 60,
  offset = 0,
  license?: string,
): Promise<{ results: WebSearchResult[]; hasMore: boolean }> {
  "use cache";
  cacheLife("hours");
  cacheTag(category);

  const licenseFilter = license
    ? sql` AND json_extract(c.license, '$.title') = ${license}`
    : sql``;

  const rows = await db.all<WebSearchResult>(sql`
    SELECT
      i.full_name AS fullName,
      i.name,
      i.prefix,
      c.name AS collection,
      i.body,
      COALESCE(i.width, 24) AS width,
      COALESCE(i.height, 24) AS height,
      i.category,
      i.tags
    FROM icons i
    JOIN collections c ON c.prefix = i.prefix
    WHERE i.category = ${category} ${licenseFilter}
    ORDER BY i.prefix, i.name
    LIMIT ${limit + 1} OFFSET ${offset}
  `);

  return {
    results: rows.slice(0, limit),
    hasMore: rows.length > limit,
  };
}

export async function browseAllIcons(
  limit = 60,
  offset = 0,
  license?: string,
): Promise<{ results: WebSearchResult[]; hasMore: boolean }> {
  "use cache";
  cacheLife("hours");

  const licenseFilter = license
    ? sql` WHERE json_extract(c.license, '$.title') = ${license}`
    : sql``;

  const rows = await db.all<WebSearchResult>(sql`
    SELECT
      i.full_name AS fullName,
      i.name,
      i.prefix,
      c.name AS collection,
      i.body,
      COALESCE(i.width, 24) AS width,
      COALESCE(i.height, 24) AS height,
      i.category,
      i.tags
    FROM icons i
    JOIN collections c ON c.prefix = i.prefix
    ${licenseFilter}
    ORDER BY i.prefix, i.name
    LIMIT ${limit + 1} OFFSET ${offset}
  `);

  return {
    results: rows.slice(0, limit),
    hasMore: rows.length > limit,
  };
}

export async function searchCollections(
  query: string
): Promise<CollectionWithSamples[]> {
  const allCollections = await getCollections();
  const q = query.toLowerCase();
  return allCollections.filter(
    (c) =>
      c.prefix.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q)
  );
}

export async function getIconByFullName(
  fullName: string
): Promise<IconRow | null> {
  "use cache";
  cacheLife("max");

  const [row] = await db
    .select({
      id: icons.id,
      prefix: icons.prefix,
      name: icons.name,
      fullName: icons.fullName,
      body: icons.body,
      width: icons.width,
      height: icons.height,
      category: icons.category,
      tags: icons.tags,
    })
    .from(icons)
    .where(eq(icons.fullName, fullName))
    .limit(1)
    .all();

  if (!row) return null;

  return {
    ...row,
    width: row.width ?? 24,
    height: row.height ?? 24,
  };
}
