import { after } from "next/server";
import { db } from "../db/connection";
import { iconEvents } from "../db/schema";

export type IconEvent = {
  eventType: "get" | "copy" | "search" | "registry";
  source: "mcp" | "web";
  fullName?: string | null;
  /** Only worth passing for a whole-collection event, which has no icon id. */
  prefix?: string | null;
  client?: string | null;
  clientVersion?: string | null;
  query?: string | null;
  resultCount?: number | null;
  format?: string | null;
  userId?: string | null;
};

const MAX_QUERY_LEN = 200;

/** "lucide:arrow-right" → "lucide". Null for anything not in that shape. */
function prefixOf(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const i = fullName.indexOf(":");
  return i > 0 ? fullName.slice(0, i) : null;
}

/**
 * Write usage events without ever making them the caller's problem.
 *
 * Nothing here is awaited by the request that triggered it: an icon must still
 * be delivered when the stats table is unreachable, and the copy button must
 * not wait on a round trip.
 *
 * That deferral has to be `after()` rather than a floating promise. A bare
 * `void db.insert(...)` works on a long-lived server and silently loses every
 * row on Vercel, where the invocation suspends the moment the response is
 * returned and the query is abandoned before Postgres sees it — which is
 * exactly how this shipped, passing locally and recording nothing in
 * production. `after()` is the platform's contract for post-response work: the
 * response goes out first, and the invocation is kept alive to finish this.
 */
export function recordEvents(events: IconEvent[]): void {
  if (events.length === 0) return;

  const rows = events.map((e) => ({
    eventType: e.eventType,
    source: e.source,
    fullName: e.fullName ?? null,
    prefix: e.prefix ?? prefixOf(e.fullName),
    client: e.client ?? null,
    clientVersion: e.clientVersion ?? null,
    query: e.query ? e.query.slice(0, MAX_QUERY_LEN) : null,
    resultCount: e.resultCount ?? null,
    format: e.format ?? null,
    userId: e.userId ?? null,
  }));

  const write = async () => {
    try {
      await db.insert(iconEvents).values(rows);
    } catch {
      // Analytics are never worth failing a request over.
    }
  };

  try {
    after(write);
  } catch {
    // after() requires a request scope. Every caller here has one, but a
    // script or a test importing this should degrade rather than throw.
    void write();
  }
}
