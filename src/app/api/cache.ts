/**
 * Cache headers for the two paging endpoints.
 *
 * Both are pure functions of their query string: no cookies, no auth, no
 * middleware, and the icon corpus only changes when the database is re-seeded
 * by hand. `public` is therefore safe — nothing here is per-user.
 *
 * The five minutes is aimed at the browser, which is the only thing these
 * responses currently pass through. A reader who runs the same search twice,
 * or scrolls a collection they were just looking at, re-requests the identical
 * offset URLs; without a header every one of those is a full round trip for a
 * page of SVG bodies. `stale-while-revalidate` then covers the long tail, so a
 * day-old entry still paints immediately and refreshes behind the reader.
 *
 * Deliberately short of the underlying `"use cache"` lifetimes: those live in
 * one process that a deploy replaces, while a header sends the response into
 * caches nothing here can purge. Five minutes bounds how long a re-seed can be
 * invisible.
 *
 * Errors must never carry this — a cached 500 outlives the outage that caused
 * it. Only the success paths set it.
 */
export const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
} as const;
