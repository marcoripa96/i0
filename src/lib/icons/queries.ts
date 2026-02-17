import { sql, eq, and, inArray, isNotNull, ne, asc } from "drizzle-orm";
import { db } from "../db/connection";
import { collections, icons } from "../db/schema";
import { buildBm25Query } from "./search";
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

  const rows = await db.select().from(collections).orderBy(collections.prefix);

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

export async function getCollectionCount(
  license?: string,
): Promise<number> {
  "use cache";
  cacheLife("max");

  if (license) {
    const rows = await db.execute<{ count: string }>(sql`
      SELECT count(*)::text AS count FROM collections
      WHERE (license::jsonb)->>'title' = ${license}
    `);
    return parseInt((rows as { count: string }[])[0].count, 10);
  }

  const rows = await db.execute<{ count: string }>(sql`
    SELECT count(*)::text AS count FROM collections
  `);
  return parseInt((rows as { count: string }[])[0].count, 10);
}

export async function getCollectionsPaginated(
  limit = 48,
  offset = 0,
  license?: string,
): Promise<{ results: CollectionWithSamples[]; hasMore: boolean }> {
  "use cache";
  cacheLife("max");

  const licenseFilter = license
    ? sql` WHERE (license::jsonb)->>'title' = ${license}`
    : sql``;

  const rows = await db.execute<{
    prefix: string;
    name: string;
    total: number;
    author: string | null;
    license: string | null;
    category: string | null;
    palette: boolean | null;
    height: number | null;
    version: string | null;
    samples: string | null;
  }>(sql`
    SELECT * FROM collections ${licenseFilter}
    ORDER BY prefix ASC
    LIMIT ${limit + 1} OFFSET ${offset}
  `);

  const typedRows = rows as {
    prefix: string;
    name: string;
    total: number;
    author: string | null;
    license: string | null;
    category: string | null;
    palette: boolean | null;
    height: number | null;
    version: string | null;
    samples: string | null;
  }[];

  const parsed: CollectionRow[] = typedRows.slice(0, limit).map((r) => ({
    ...r,
    author: r.author ? JSON.parse(r.author) : null,
    license: r.license ? JSON.parse(r.license) : null,
    samples: r.samples ? JSON.parse(r.samples) : null,
  }));

  // Only fetch sample icons for this page of collections
  const sampleFullNames: string[] = [];
  for (const c of parsed) {
    if (c.samples) {
      for (const s of c.samples.slice(0, 3)) {
        sampleFullNames.push(`${c.prefix}:${s}`);
      }
    }
  }

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
      : [];

  const sampleMap = new Map(sampleIcons.map((i) => [i.fullName, i]));

  return {
    results: parsed.map((c) => ({
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
    })),
    hasMore: typedRows.length > limit,
  };
}

export async function getCategories(): Promise<string[]> {
  "use cache";
  cacheLife("max");

  const rows = await db
    .selectDistinct({ category: icons.category })
    .from(icons)
    .where(and(isNotNull(icons.category), ne(icons.category, "")))
    .orderBy(asc(icons.category));
  return rows.map((r) => r.category!);
}

export async function getCategoriesForCollection(prefix: string): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(prefix);

  // Use raw SQL to leverage icons_prefix_category_idx for Index Only Scan
  const rows = await db.execute<{ category: string }>(sql`
    SELECT DISTINCT category
    FROM icons
    WHERE prefix = ${prefix} AND category IS NOT NULL AND category != ''
    ORDER BY category ASC
  `);
  return (rows as { category: string }[]).map((r) => r.category);
}

export async function getCollectionPrefixesForCategory(
  category: string
): Promise<string[]> {
  "use cache";
  cacheLife("hours");

  // Use raw SQL to leverage icons_category_prefix_name_idx for Index Only Scan
  const rows = await db.execute<{ prefix: string }>(sql`
    SELECT DISTINCT prefix
    FROM icons
    WHERE category = ${category}
  `);
  return (rows as { prefix: string }[]).map((r) => r.prefix);
}

export async function getLicenses(): Promise<string[]> {
  "use cache";
  cacheLife("max");

  const rows = await db.execute<{ title: string }>(
    sql`SELECT DISTINCT (license::jsonb)->>'title' AS title FROM collections WHERE license IS NOT NULL ORDER BY title`
  );
  return (rows as { title: string }[]).map((r) => r.title);
}

export async function searchIconsWeb(
  query: string,
  collection?: string,
  category?: string,
  limit = 60,
  offset = 0,
  license?: string,
): Promise<{ results: WebSearchResult[]; hasMore: boolean }> {
  const bm25Query = buildBm25Query(query);
  if (!bm25Query) return { results: [], hasMore: false };

  const collectionFilter = collection
    ? sql` AND i.prefix = ${collection}`
    : sql``;
  const categoryFilter = category
    ? sql` AND i.category = ${category}`
    : sql``;
  // Optimized: use IN(subquery) instead of JOIN filter to avoid JSON parsing per-row
  const licenseFilter = license
    ? sql` AND i.prefix IN (SELECT prefix FROM collections WHERE (license::jsonb)->>'title' = ${license})`
    : sql``;

  const rows = await db.execute<WebSearchResult>(sql`
    SELECT
      i.full_name AS "fullName",
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
    WHERE i.search_text IS NOT NULL ${collectionFilter} ${categoryFilter} ${licenseFilter}
    ORDER BY i.search_text <@> to_bm25query(${bm25Query}, 'icons_bm25_idx')
    LIMIT ${limit + 1} OFFSET ${offset}
  `);

  const typedRows = rows as WebSearchResult[];
  return {
    results: typedRows.slice(0, limit),
    hasMore: typedRows.length > limit,
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

  const conditions = category
    ? and(eq(icons.prefix, prefix), eq(icons.category, category))
    : eq(icons.prefix, prefix);

  const iconsQuery = db
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
    .offset(offset);

  const collectionQuery = db
    .select()
    .from(collections)
    .where(eq(collections.prefix, prefix))
    .limit(1);

  const [rows, [collectionRow]] = await Promise.all([iconsQuery, collectionQuery]);

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

  if (license) {
    // Two-query approach for license filter: first get matching prefixes, then filter icons
    const licensePrefixes = await db.execute<{ prefix: string; name: string }>(sql`
      SELECT prefix, name FROM collections WHERE (license::jsonb)->>'title' = ${license}
    `);
    const prefixList = (licensePrefixes as { prefix: string; name: string }[]).map(r => r.prefix);
    if (prefixList.length === 0) {
      return { results: [], hasMore: false };
    }
    const prefixNameMap = new Map((licensePrefixes as { prefix: string; name: string }[]).map(r => [r.prefix, r.name]));

    const rows = await db.execute<Omit<WebSearchResult, "collection">>(sql`
      SELECT
        i.full_name AS "fullName",
        i.name,
        i.prefix,
        i.body,
        COALESCE(i.width, 24) AS width,
        COALESCE(i.height, 24) AS height,
        i.category,
        i.tags
      FROM icons i
      WHERE i.category = ${category} AND i.prefix = ANY(${prefixList})
      ORDER BY i.prefix ASC, i.name ASC
      LIMIT ${limit + 1} OFFSET ${offset}
    `);
    const typedRows = (rows as (Omit<WebSearchResult, "collection">)[]).map(r => ({
      ...r,
      collection: prefixNameMap.get(r.prefix) || r.prefix,
    }));
    return {
      results: typedRows.slice(0, limit),
      hasMore: typedRows.length > limit,
    };
  }

  // No license filter: use composite index icons_category_prefix_name_idx for sorted scan
  const rows = await db.execute<WebSearchResult>(sql`
    SELECT
      i.full_name AS "fullName",
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
    WHERE i.category = ${category}
    ORDER BY i.prefix ASC, i.name ASC
    LIMIT ${limit + 1} OFFSET ${offset}
  `);

  const typedRows = rows as WebSearchResult[];
  return {
    results: typedRows.slice(0, limit),
    hasMore: typedRows.length > limit,
  };
}

export async function browseAllIcons(
  limit = 60,
  offset = 0,
  license?: string,
): Promise<{ results: WebSearchResult[]; hasMore: boolean }> {
  "use cache";
  cacheLife("hours");

  if (license) {
    // Optimized two-query approach: first get matching prefixes from collections (small table),
    // then use ANY(array) on icons which leverages icons_prefix_name_idx for sorted index scan.
    // This avoids scanning 100k+ rows and sorting -- PG produces sorted results directly from the index.
    const licensePrefixes = await db.execute<{ prefix: string; name: string }>(sql`
      SELECT prefix, name FROM collections WHERE (license::jsonb)->>'title' = ${license}
    `);
    const prefixList = (licensePrefixes as { prefix: string; name: string }[]).map(r => r.prefix);
    if (prefixList.length === 0) {
      return { results: [], hasMore: false };
    }
    const prefixNameMap = new Map((licensePrefixes as { prefix: string; name: string }[]).map(r => [r.prefix, r.name]));

    const rows = await db.execute<Omit<WebSearchResult, "collection">>(sql`
      SELECT
        i.full_name AS "fullName",
        i.name,
        i.prefix,
        i.body,
        COALESCE(i.width, 24) AS width,
        COALESCE(i.height, 24) AS height,
        i.category,
        i.tags
      FROM icons i
      WHERE i.prefix = ANY(${prefixList})
      ORDER BY i.prefix ASC, i.name ASC
      LIMIT ${limit + 1} OFFSET ${offset}
    `);
    const typedRows = (rows as (Omit<WebSearchResult, "collection">)[]).map(r => ({
      ...r,
      collection: prefixNameMap.get(r.prefix) || r.prefix,
    }));
    return {
      results: typedRows.slice(0, limit),
      hasMore: typedRows.length > limit,
    };
  }

  const rows = await db
    .select({
      fullName: icons.fullName,
      name: icons.name,
      prefix: icons.prefix,
      collection: collections.name,
      body: icons.body,
      width: sql<number>`COALESCE(${icons.width}, 24)`,
      height: sql<number>`COALESCE(${icons.height}, 24)`,
      category: icons.category,
      tags: icons.tags,
    })
    .from(icons)
    .innerJoin(collections, eq(collections.prefix, icons.prefix))
    .orderBy(asc(icons.prefix), asc(icons.name))
    .limit(limit + 1)
    .offset(offset);

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
    .limit(1);

  if (!row) return null;

  return {
    ...row,
    width: row.width ?? 24,
    height: row.height ?? 24,
  };
}
