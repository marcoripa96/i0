# icons0 — Icon Search MCP Server

Next.js app with xmcp MCP server. Serves 200k+ icons from 150+ open-source collections. Built with xmcp (Next.js adapter), PostgreSQL 18 (pgvector + pg_textsearch), Drizzle ORM, BM25 full-text search, and Gemini semantic embeddings.

## Commands

```bash
docker compose up -d       # Start PostgreSQL 18 (pgvector + pg_textsearch)
bunx drizzle-kit push      # Push schema to PG (creates tables + HNSW index)
bun run seed               # Seed PG from @iconify/json (required before first run)
bun run seed:embeddings    # Generate vector embeddings for all icons (requires GOOGLE_API_KEY)
bun run build              # Build for production (xmcp build → next build)
bun run dev                # Dev server on :3000 (xmcp dev + next dev --turbopack)
bun run start              # Run production build (next start)
```

## Architecture

Next.js App Router with xmcp running as a route handler at `/mcp`. The xmcp adapter is built to `.xmcp/adapter/` and imported by `src/app/mcp/route.ts`.

**Runtime has zero dependency on `@iconify/json`** (395MB). Icon SVG bodies are stored in PostgreSQL at seed time. At runtime, `@iconify/utils` renders SVGs from DB data. `@iconify/json` is a devDependency only.

**Driver**: Uses `postgres` (postgres.js) via `drizzle-orm/postgres-js`. Seed scripts use `postgres` directly.

### Key files

- `xmcp.config.ts` — xmcp config with `experimental: { adapter: "nextjs" }`
- `next.config.ts` — Next.js config
- `Dockerfile.pg` — PostgreSQL 18 image with pgvector + pg_textsearch
- `docker-compose.yml` — Docker Compose for local PostgreSQL
- `docker/init.sql` — Creates pgvector and pg_textsearch extensions
- `src/app/mcp/route.ts` — MCP endpoint (imports `xmcpHandler` from `@xmcp/adapter`)
- `src/app/page.tsx` — Landing page
- `src/lib/db/schema.ts` — Drizzle table definitions (`collections`, `icons`) with pgvector and HNSW index
- `src/lib/db/connection.ts` — postgres.js + Drizzle ORM connection
- `src/lib/db/seed.ts` — Seeds DB from @iconify/json, builds BM25 index with pg_textsearch
- `src/lib/db/seed-embeddings.ts` — Generates Gemini embeddings for all icons
- `src/lib/icons/svg.ts` — Renders SVG from DB body/width/height using @iconify/utils
- `src/lib/icons/react.ts` — Converts SVG to typed React component string (regex-based, following icones project pattern)
- `src/lib/icons/search.ts` — Hybrid BM25 + semantic vector search
- `src/tools/` — MCP tools (search-icons, get-icon, list-collections, list-licenses)
- `src/prompts/` — Agent guidance prompts
- `src/resources/` — MCP resources (currently empty)

### Database

Local PostgreSQL 18 with pgvector and pg_textsearch extensions. ~303k icons, 223 collections.

- `collections` table — prefix (PK), name, total, author (JSON text), license (JSON text), category, palette, height, version, samples (JSON text)
- `icons` table — id (serial PK), prefix, name, full_name (unique idx), body (SVG), width, height, category, tags, search_text, embedding (vector(256))
- `icons_bm25_idx` — BM25 index on `search_text` column (`text_config='english'`)
- `icons_embedding_idx` — HNSW vector index on `embedding` column (`vector_cosine_ops`)

JSON columns (`author`, `license`, `samples`) are stored as text strings and parsed at query time. Use `(col::jsonb)->>'key'` for JSON access in raw SQL.

### Search

Hybrid search combining BM25 keyword matching and semantic vector search:

1. **BM25** — pg_textsearch BM25-ranked keyword matches with English text config. Uses `<@>` operator with `to_bm25query()`. Name is double-weighted in `search_text` column.
2. **Semantic** — Gemini `gemini-embedding-001` embeddings (256d) with pgvector HNSW cosine distance (`<=>` operator)
3. **Merge** — RRF (Reciprocal Rank Fusion) combining both result sets

BM25 and semantic search run in parallel. Semantic search gracefully degrades if embeddings aren't seeded or the API is unavailable.

### xmcp conventions

Tools, prompts, and resources are file-system discovered from `src/tools/`, `src/prompts/`, `src/resources/`. Each file exports:
- `schema` — Zod object for tool params
- `metadata` — Name, description, annotations
- `default function` — Handler (async)

Tool handlers return `{ content: [{ type: "text", text }], structuredContent?, isError? }`.

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

- **xmcp adapter dir bug**: `xmcp build` doesn't create `.xmcp/adapter/` before writing to it. The build script works around this with `mkdir -p .xmcp/adapter && xmcp build`.
- **Re-seeding clears all data**: `seed.ts` deletes and re-inserts all rows. No incremental updates. Must re-run `seed:embeddings` after re-seeding.
- **Embedding seeding is slow**: ~50 min for 303k icons on free tier (250 icons/batch, 0.2s delay). Skips already-embedded icons.
- **BM25 English text config**: pg_textsearch handles stemming via English text config. "arrows" matches "arrow", "deleting" matches "delete".
- **Icon names vary by collection version**: e.g. Lucide uses `house` not `home` in current @iconify/json.
- **Vector search needs embeddings**: If `seed:embeddings` hasn't run, semantic search silently returns no results and search falls back to BM25-only.
- **Column aliases in PG**: Use double quotes for camelCase aliases in raw SQL (e.g. `AS "fullName"`) — PG folds unquoted identifiers to lowercase.
