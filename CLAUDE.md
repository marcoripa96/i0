# icons0 — Icon Search MCP Server

Next.js app with an MCP server. Serves 200k+ icons from 150+ open-source collections. Built with `mcp-handler` (Vercel's MCP adapter), PostgreSQL 18 (pgvector + pg_textsearch), Drizzle ORM, BM25 full-text search, and Gemini semantic embeddings.

## Commands

```bash
docker compose up -d       # Start PostgreSQL 18 (pgvector + pg_textsearch)
bunx drizzle-kit push      # Push schema to PG (creates tables + HNSW index)
bun run seed               # Seed PG from @iconify/json (required before first run)
bun run seed:embeddings    # Generate vector embeddings for all icons (requires GOOGLE_API_KEY)
bun run build              # Build for production (next build)
bun run dev                # Dev server on :3000 (next dev --turbopack)
bun run start              # Run production build (next start)
```

## Architecture

Next.js App Router with `mcp-handler` running as a route handler at `/mcp`. `src/app/mcp/route.ts` builds the server with `createMcpHandler`, registering each tool and prompt explicitly, and wraps it in `withMcpAuth` for bearer-token auth.

The handler is configured with `basePath: ""`, which resolves its streamable-HTTP endpoint to `/mcp` — matching the route's own path, so the published URL is unchanged. `disableSse: true` because SSE is the only transport that needs Redis.

**Runtime has zero dependency on `@iconify/json`** (395MB). Icon SVG bodies are stored in PostgreSQL at seed time. At runtime, `@iconify/utils` renders SVGs from DB data. `@iconify/json` is a devDependency only.

**Driver**: Uses `postgres` (postgres.js) via `drizzle-orm/postgres-js`. Seed scripts use `postgres` directly.

### Key files

- `next.config.ts` — Next.js config
- `Dockerfile.pg` — PostgreSQL 18 image with pgvector + pg_textsearch
- `docker-compose.yml` — Docker Compose for local PostgreSQL
- `docker/init.sql` — Creates pgvector and pg_textsearch extensions
- `src/app/mcp/route.ts` — MCP endpoint: server construction, tool/prompt registration, and token auth
- `src/app/page.tsx` — Landing page
- `src/lib/db/schema.ts` — Drizzle table definitions (`collections`, `icons`) with pgvector and HNSW index
- `src/lib/db/connection.ts` — postgres.js + Drizzle ORM connection
- `src/lib/db/seed.ts` — Seeds DB from @iconify/json, builds BM25 index with pg_textsearch
- `src/lib/db/seed-embeddings.ts` — Generates Gemini embeddings for all icons
- `src/lib/icons/svg.ts` — Renders SVG from DB body/width/height using @iconify/utils
- `src/lib/icons/react.ts` — Converts SVG to typed React component string (regex-based, following icones project pattern)
- `src/lib/icons/search.ts` — Hybrid BM25 + semantic vector search
- `src/lib/mcp/response.ts` — Tool result helpers (`ok`, `fail`, `table`)
- `src/tools/` — MCP tools (search-icons, get-icon, list-collections, list-licenses)
- `src/prompts/` — Agent guidance prompts

### Database

Local PostgreSQL 18 with pgvector and pg_textsearch extensions. ~303k icons, 223 collections.

- `collections` table — prefix (PK), name, total, author (JSON text), license (JSON text), category, palette, height, version, samples (JSON text)
- `icons` table — id (serial PK), prefix, name, full_name (unique idx), body (SVG), width, height, category, tags, search_text, embedding (vector(256))
- `icons_bm25_idx` — BM25 index on `search_text` column (`text_config='english'`)
- `icons_name_pattern_idx` — btree on `name` with `text_pattern_ops`, serving the `name LIKE 'arro%'` prefix arm of web search
- `icons_embedding_idx` — HNSW vector index on `embedding` column (`vector_cosine_ops`)

JSON columns (`author`, `license`, `samples`) are stored as text strings and parsed at query time. Use `(col::jsonb)->>'key'` for JSON access in raw SQL.

### Search

There are two search paths, and they do not use the same arms.

**MCP** (`hybridSearch`, `src/lib/icons/search.ts`) — BM25 + semantic:

1. **BM25** — pg_textsearch BM25-ranked keyword matches with English text config. Uses `<@>` operator with `to_bm25query()`. Name is double-weighted in `search_text` column.
2. **Semantic** — Gemini `gemini-embedding-001` embeddings (256d) with pgvector HNSW cosine distance (`<=>` operator)
3. **Merge** — RRF (Reciprocal Rank Fusion) combining both result sets

BM25 and semantic search run in parallel. Semantic search gracefully degrades if embeddings aren't seeded or the API is unavailable.

**Web** (`searchIconsWeb`, `src/lib/icons/queries.ts`) — BM25 + name prefix, no semantic arm:

1. **BM25** — as above.
2. **Prefix** — `name LIKE 'arro%'` against `icons_name_pattern_idx`, ordered shortest-name-first. BM25 only matches whole stemmed tokens, so without this arm a half-typed word returns nothing at all.
3. **Merge** — RRF, then `ORDER BY (name = query) DESC` so an exact name always outranks the fused score.

The query is lowercased (all stored names are lowercase) and `%`/`_`/`\` are escaped before being used as a LIKE pattern.

### MCP conventions

Tools and prompts are registered explicitly — there is no filesystem discovery. Each file in `src/tools/` exports a single `registerX(server)` that calls `server.registerTool(name, { title, description, inputSchema, annotations }, handler)`; `src/prompts/` files do the same with `registerPrompt`. `src/app/mcp/route.ts` calls each one. Adding a tool means adding a file and one line in the route.

**Responses are plain text, and deliberately carry no `structuredContent`.** No tool declares an `outputSchema`, so a structured copy adds no validation and doubles the token cost of every response. Build results with `ok(text)` / `fail(code, message)` from `src/lib/mcp/response.ts`; use `table()` for row data, which emits TSV.

Keep responses lean — they are billed to every agent on every call:
- `search-icons` returns bare `prefix:name` ids, one per line. The prefix already identifies the collection.
- `list-collections` returns prefix/name/count only. `get-icon` reports the license of the icon actually chosen.
- Errors are one line, `CODE: message`, with the code kept machine-detectable for the retry rules in the prompts.

### Querying

- Tools use Drizzle ORM: `const [row] = await db.select().from(table).where(eq(...)).limit(1)`
- BM25 queries use raw SQL: `await db.execute(sql\`SELECT ... ORDER BY search_text <@> to_bm25query(...)\`)`
- Vector queries use pgvector: `await db.execute(sql\`SELECT ... ORDER BY embedding <=> ${vec}::vector\`)`
- All DB operations are async
- PG drizzle returns arrays directly (no `.all()` or `.get()` methods)

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection URL (postgresql://icons0:icons0@localhost:5432/icons0)
- `GOOGLE_API_KEY` — Google API key for Gemini embeddings

## Gotchas

- **`mcp-handler` pins the MCP SDK**: it peers `@modelcontextprotocol/sdk` at exactly `1.26.0`, so do not float that dependency to a newer release.
- **`drizzle-kit push` drops indexes it cannot see in `schema.ts`**: every index must be declared there, including `icons_bm25_idx`, which is also created by `seed.ts`. Losing it breaks every query against the `icons` table. Rebuild with `CREATE INDEX icons_bm25_idx ON icons USING bm25(search_text) WITH (text_config='english')` (~7s).
- **`shared_preload_libraries` must include `pg_textsearch`**: without it every query against the `icons` table fails, not just BM25 search — the index makes the extension mandatory for any scan of the table.
- **Re-seeding clears all data**: `seed.ts` deletes and re-inserts all rows. No incremental updates. Must re-run `seed:embeddings` after re-seeding.
- **Embedding seeding is slow**: ~50 min for 303k icons on free tier (250 icons/batch, 0.2s delay). Skips already-embedded icons.
- **BM25 English text config**: pg_textsearch handles stemming via English text config. "arrows" matches "arrow", "deleting" matches "delete".
- **Icon names vary by collection version**: e.g. Lucide uses `house` not `home` in current @iconify/json.
- **Vector search needs embeddings**: If `seed:embeddings` hasn't run, semantic search silently returns no results and search falls back to BM25-only.
- **Column aliases in PG**: Use double quotes for camelCase aliases in raw SQL (e.g. `AS "fullName"`) — PG folds unquoted identifiers to lowercase.
