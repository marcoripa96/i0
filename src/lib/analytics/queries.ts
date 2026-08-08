import { sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "../db/connection";

/**
 * Everything /stats reads. All of it is `group by` over `icon_events`, so all
 * of it is cached — a public page cannot afford a full scan per visitor. The
 * "minutes" profile is the trade: the numbers are a few minutes stale, which
 * for a leaderboard nobody can see moving is free.
 */

/** The events that mean "somebody took this icon away with them". */
const PICKS = sql`event_type in ('get', 'copy', 'registry')`;

export type Overview = {
  picks: number;
  human: number;
  agent: number;
  searches: number;
  distinctIcons: number;
  distinctAgents: number;
  since: Date | null;
};

export async function getOverview(): Promise<Overview> {
  "use cache";
  cacheLife("minutes");

  const [row] = await db.execute<{
    picks: string;
    human: string;
    agent: string;
    searches: string;
    distinctIcons: string;
    distinctAgents: string;
    // Raw SQL comes back unparsed, so this is a string however much the
    // column says timestamp — hence the explicit Date below.
    since: string | null;
  }>(sql`
    SELECT
      count(*) FILTER (WHERE ${PICKS})                                AS picks,
      count(*) FILTER (WHERE ${PICKS} AND source = 'web')             AS human,
      count(*) FILTER (WHERE ${PICKS} AND source = 'mcp')             AS agent,
      count(*) FILTER (WHERE event_type = 'search')                   AS searches,
      count(DISTINCT full_name) FILTER (WHERE ${PICKS})               AS "distinctIcons",
      count(DISTINCT client)                                          AS "distinctAgents",
      min(created_at)                                                 AS since
    FROM icon_events
  `);

  return {
    picks: Number(row?.picks ?? 0),
    human: Number(row?.human ?? 0),
    agent: Number(row?.agent ?? 0),
    searches: Number(row?.searches ?? 0),
    distinctIcons: Number(row?.distinctIcons ?? 0),
    distinctAgents: Number(row?.distinctAgents ?? 0),
    since: row?.since ? new Date(row.since) : null,
  };
}

export type RankedIcon = {
  fullName: string;
  picks: number;
  body: string;
  width: number;
  height: number;
};

/**
 * The leaderboard. `source` narrows it to one audience — that comparison is
 * the whole point of the page, so the same query serves all three columns.
 *
 * Inner join to `icons`: an id that no longer exists (a collection dropped a
 * name between seeds) has nothing to render, so it drops out rather than
 * leaving a hole in the grid.
 */
export async function getTopIcons(
  source: "web" | "mcp" | null,
  limit = 12,
): Promise<RankedIcon[]> {
  "use cache";
  cacheLife("minutes");

  const rows = await db.execute<{
    fullName: string;
    picks: string;
    body: string;
    width: number | null;
    height: number | null;
  }>(sql`
    SELECT e.full_name AS "fullName", count(*) AS picks, i.body, i.width, i.height
    FROM icon_events e
    JOIN icons i ON i.full_name = e.full_name
    WHERE ${PICKS}
      ${source ? sql`AND e.source = ${source}` : sql``}
    GROUP BY e.full_name, i.body, i.width, i.height
    ORDER BY picks DESC, e.full_name
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    fullName: r.fullName,
    picks: Number(r.picks),
    body: r.body,
    width: r.width ?? 24,
    height: r.height ?? 24,
  }));
}

export type RankedCollection = { prefix: string; name: string; picks: number };

export async function getTopCollections(
  source: "web" | "mcp" | null,
  limit = 8,
): Promise<RankedCollection[]> {
  "use cache";
  cacheLife("minutes");

  const rows = await db.execute<{ prefix: string; name: string | null; picks: string }>(sql`
    SELECT e.prefix, c.name, count(*) AS picks
    FROM icon_events e
    LEFT JOIN collections c ON c.prefix = e.prefix
    WHERE ${PICKS} AND e.prefix IS NOT NULL
      ${source ? sql`AND e.source = ${source}` : sql``}
    GROUP BY e.prefix, c.name
    ORDER BY picks DESC, e.prefix
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    prefix: r.prefix,
    name: r.name ?? r.prefix,
    picks: Number(r.picks),
  }));
}

export type RankedAgent = { client: string; calls: number; icons: number };

/**
 * Which MCP clients are out there. `client` is what the agent called itself in
 * `initialize`, falling back to its User-Agent — see lib/analytics/mcp-caller.
 */
export async function getAgentLeaderboard(limit = 10): Promise<RankedAgent[]> {
  "use cache";
  cacheLife("minutes");

  const rows = await db.execute<{ client: string; calls: string; icons: string }>(sql`
    SELECT client,
           count(*)                    AS calls,
           count(DISTINCT full_name)   AS icons
    FROM icon_events
    WHERE source = 'mcp' AND client IS NOT NULL
    GROUP BY client
    ORDER BY calls DESC, client
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    client: r.client,
    calls: Number(r.calls),
    icons: Number(r.icons),
  }));
}

export type Mover = {
  fullName: string;
  recent: number;
  previous: number;
  body: string;
  width: number;
  height: number;
};

/**
 * The last seven days against the seven before them.
 *
 * Ordered by absolute change, not by growth rate: 1 → 4 picks is a 300% rise
 * and means nothing, and a rate ranking would put it above everything real.
 */
export async function getMovers(limit = 8): Promise<Mover[]> {
  "use cache";
  cacheLife("minutes");

  const rows = await db.execute<{
    fullName: string;
    recent: string;
    previous: string;
    body: string;
    width: number | null;
    height: number | null;
  }>(sql`
    SELECT e.full_name AS "fullName",
           count(*) FILTER (WHERE e.created_at >= now() - interval '7 days')  AS recent,
           count(*) FILTER (WHERE e.created_at <  now() - interval '7 days')  AS previous,
           i.body, i.width, i.height
    FROM icon_events e
    JOIN icons i ON i.full_name = e.full_name
    WHERE ${PICKS} AND e.created_at >= now() - interval '14 days'
    GROUP BY e.full_name, i.body, i.width, i.height
    HAVING count(*) FILTER (WHERE e.created_at >= now() - interval '7 days')
         <> count(*) FILTER (WHERE e.created_at <  now() - interval '7 days')
    ORDER BY abs(
      count(*) FILTER (WHERE e.created_at >= now() - interval '7 days')
      - count(*) FILTER (WHERE e.created_at < now() - interval '7 days')
    ) DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    fullName: r.fullName,
    recent: Number(r.recent),
    previous: Number(r.previous),
    body: r.body,
    width: r.width ?? 24,
    height: r.height ?? 24,
  }));
}

export type RankedQuery = { query: string; times: number; results: number };

/**
 * What people typed.
 *
 * The web search box navigates on a debounce, so typing "arrow" also logs
 * "arr" and "arro". The NOT EXISTS drops any query that a longer one from the
 * same two-minute window starts with — the keystrokes on the way to a word,
 * without needing a session id to tie them together. MCP queries arrive whole
 * and are unaffected by it.
 */
export async function getTopSearches(limit = 10): Promise<RankedQuery[]> {
  "use cache";
  cacheLife("minutes");

  const rows = await db.execute<{ query: string; times: string; results: string }>(sql`
    SELECT query, count(*) AS times, round(avg(result_count)) AS results
    FROM icon_events e
    WHERE event_type = 'search' AND query <> ''
      AND NOT EXISTS (
        SELECT 1 FROM icon_events later
        WHERE later.event_type = 'search'
          AND later.source = e.source
          AND later.query <> e.query
          AND later.query LIKE e.query || '%'
          AND later.created_at BETWEEN e.created_at AND e.created_at + interval '2 minutes'
      )
    GROUP BY query
    ORDER BY times DESC, query
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    query: r.query,
    times: Number(r.times),
    results: Number(r.results ?? 0),
  }));
}

/** Searches that found nothing — the honest to-do list for search tuning. */
export async function getEmptySearches(limit = 10): Promise<RankedQuery[]> {
  "use cache";
  cacheLife("minutes");

  const rows = await db.execute<{ query: string; times: string }>(sql`
    SELECT query, count(*) AS times
    FROM icon_events e
    WHERE event_type = 'search' AND result_count = 0 AND length(query) >= 3
      AND NOT EXISTS (
        SELECT 1 FROM icon_events later
        WHERE later.event_type = 'search'
          AND later.source = e.source
          AND later.query <> e.query
          AND later.query LIKE e.query || '%'
          AND later.created_at BETWEEN e.created_at AND e.created_at + interval '2 minutes'
      )
    GROUP BY query
    ORDER BY times DESC, query
    LIMIT ${limit}
  `);

  return rows.map((r) => ({ query: r.query, times: Number(r.times), results: 0 }));
}

export type DayBar = { day: string; human: number; agent: number };

/** Fourteen days of picks, split by audience. Gaps are filled, so a quiet day reads as one. */
export async function getDailyActivity(days = 14): Promise<DayBar[]> {
  "use cache";
  cacheLife("minutes");

  const rows = await db.execute<{ day: string; human: string; agent: string }>(sql`
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
           count(e.id) FILTER (WHERE e.source = 'web') AS human,
           count(e.id) FILTER (WHERE e.source = 'mcp') AS agent
    FROM generate_series(
      date_trunc('day', now()) - make_interval(days => ${days - 1}),
      date_trunc('day', now()),
      interval '1 day'
    ) AS d(day)
    LEFT JOIN icon_events e
      ON e.created_at >= d.day AND e.created_at < d.day + interval '1 day' AND ${PICKS}
    GROUP BY d.day
    ORDER BY d.day
  `);

  return rows.map((r) => ({
    day: r.day,
    human: Number(r.human),
    agent: Number(r.agent),
  }));
}
