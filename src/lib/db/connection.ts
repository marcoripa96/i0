import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  // postgres.js otherwise falls back to localhost as the OS user and fails much
  // later, on the first query, as an authentication error that says nothing
  // about the real cause.
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(url, {
  // The app and Postgres run on the same host (see docker-compose.prod.yml;
  // the production DATABASE_URL points at localhost) with max_connections=100
  // and nothing pooling in front, so these are the pool's real bounds rather
  // than one share of a shared budget.

  // Matches postgres.js's own default. Stated rather than inherited: a page
  // render fans out to a handful of parallel queries, so this is roughly two
  // concurrent renders' worth, and it leaves the other 90 connections for
  // psql, drizzle-kit and the seed scripts.
  max: 10,
  // Default is null — idle connections are held forever, so the pool sits at
  // its high-water mark for the life of the process after a single spike.
  //
  // Five minutes, not the more obvious 60s, because reopening is not free: a
  // fresh connection costs a measured ~14ms to first result (TCP, auth, and
  // postgres.js's fetch_types catalog query) against ~0.5ms on a pooled one.
  // At ~2k requests/day the mean gap between requests is ~43s, so a 60s
  // timeout would have handed that 14ms to a quarter of all requests to
  // reclaim a few idle backends. At 300s the steady-state connection stays
  // warm and only the tail a burst opened is reaped.
  idle_timeout: 300,
  // Default is 30s, long enough that a request hangs on a database that is
  // down rather than failing. 10s still absorbs a restart.
  connect_timeout: 10,
  // Default, and correct only because nothing pools in front of Postgres.
  // Behind a transaction-mode pooler (pgbouncer et al.) consecutive queries can
  // land on different backends, where the prepared statement does not exist —
  // set this to false at the same time as introducing one.
  prepare: true,
});

export const db = drizzle({ client, schema });
