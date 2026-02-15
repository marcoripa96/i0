# icons0 — Icon Search MCP Server

Next.js app with xmcp MCP server. Serves 200k+ icons from 150+ open-source collections. Built with xmcp (Next.js adapter), Turso (libSQL), Drizzle ORM, FTS5 full-text search, and Gemini semantic embeddings.

## Commands

```bash
bun run seed              # Seed Turso DB from @iconify/json (required before first run)
bun run seed:embeddings   # Generate vector embeddings for all icons (requires GOOGLE_API_KEY)
bun run build             # Build for production (xmcp build → next build)
bun run dev               # Dev server on :3000 (xmcp dev + next dev --turbopack)
bun run start             # Run production build (next start)
```

## Architecture

Next.js App Router with xmcp running as a route handler at `/mcp`. The xmcp adapter is built to `.xmcp/adapter/` and imported by `src/app/mcp/route.ts`.

**Runtime has zero dependency on `@iconify/json`** (395MB). Icon SVG bodies are stored in Turso at seed time. At runtime, `@iconify/utils` renders SVGs from DB data. `@iconify/json` is a devDependency only.

### Key files

- `xmcp.config.ts` — xmcp config with `experimental: { adapter: "nextjs" }`
- `next.config.ts` — Next.js config (externalizes `@libsql/client`)
- `src/app/mcp/route.ts` — MCP endpoint (imports `xmcpHandler` from `@xmcp/adapter`)
- `src/app/page.tsx` — Landing page
- `src/lib/db/schema.ts` — Drizzle table definitions (`collections`, `icons`)
- `src/lib/db/connection.ts` — Turso libSQL client + Drizzle ORM connection
- `src/lib/db/seed.ts` — Seeds DB from @iconify/json, builds FTS5 index with porter stemmer
- `src/lib/db/seed-embeddings.ts` — Generates Gemini embeddings for all icons, creates DiskANN vector index
- `src/lib/icons/svg.ts` — Renders SVG from DB body/width/height using @iconify/utils
- `src/lib/icons/react.ts` — Converts SVG to typed React component string (regex-based, following icones project pattern)
- `src/lib/icons/search.ts` — Hybrid FTS5 + semantic vector search
- `src/tools/` — MCP tools (search-icons, get-icon, list-collections)
- `src/prompts/` — Agent guidance prompts
- `src/resources/` — MCP resources (currently empty)

### Database

Hosted on Turso (libSQL). ~303k icons, 223 collections.

- `collections` table — prefix (PK), name, total, author (JSON), license (JSON), category, palette, height, version, samples (JSON)
- `icons` table — id (PK), prefix, name, full_name (unique idx), body (SVG), width, height, category, tags, embedding (F32_BLOB(256))
- `icons_fts` — FTS5 virtual table (content-synced to icons, `tokenize='porter ascii'`)
- `icons_embedding_idx` — DiskANN vector index on embedding column

JSON columns (`author`, `license`, `samples`) are stored as strings and parsed at query time.

### Search

Hybrid search combining FTS5 keyword matching and semantic vector search:

1. **FTS5** — BM25-ranked keyword matches with porter stemming
2. **Semantic** — Gemini `gemini-embedding-001` embeddings (256d) with Turso's native `vector_top_k` DiskANN search
3. **Merge** — RRF (Reciprocal Rank Fusion) combining both result sets

FTS and semantic search run in parallel. Semantic search gracefully degrades if embeddings aren't seeded or the API is unavailable.

### xmcp conventions

Tools, prompts, and resources are file-system discovered from `src/tools/`, `src/prompts/`, `src/resources/`. Each file exports:
- `schema` — Zod object for tool params
- `metadata` — Name, description, annotations
- `default function` — Handler (async)

Tool handlers return `{ content: [{ type: "text", text }], structuredContent?, isError? }`.

### Querying

- Tools use Drizzle ORM: `await db.select().from(table).where(eq(...)).get()`
- FTS5 queries use Drizzle's raw SQL: `await db.all<T>(sql\`SELECT ... FROM icons_fts WHERE icons_fts MATCH ...\`)`
- Vector queries use Turso's `vector_top_k`: `await db.all<T>(sql\`SELECT ... FROM vector_top_k('icons_embedding_idx', vector32(...), k)\`)`
- All DB operations are async (libSQL client is promise-based)
- BM25 ranking weights: `bm25(icons_fts, 2.0, 10.0, 1.0, 1.0, 0.5)` — name weighted highest

## Environment Variables

- `TURSO_DATABASE_URL` — Turso database URL (libsql://...)
- `TURSO_AUTH_TOKEN` — Turso auth token
- `GOOGLE_API_KEY` — Google API key for Gemini embeddings

## Gotchas

- **xmcp adapter dir bug**: `xmcp build` doesn't create `.xmcp/adapter/` before writing to it. The build script works around this with `mkdir -p .xmcp/adapter && xmcp build`.
- **`@libsql/client` must be externalized**: Added to `serverExternalPackages` in `next.config.ts` (native bindings can't be webpack-bundled).
- **Re-seeding drops all tables**: `seed.ts` drops and recreates tables. No incremental updates. Must re-run `seed:embeddings` after re-seeding.
- **Embedding seeding is slow**: ~50 min for 303k icons on free tier (100 icons/batch, 1s delay). Skips already-embedded icons.
- **FTS5 porter stemmer**: "arrows" matches "arrow", "deleting" matches "delete". Query sanitizer strips FTS5 special chars and appends `*` to last token for prefix matching.
- **Icon names vary by collection version**: e.g. Lucide uses `house` not `home` in current @iconify/json.
- **Vector search needs embeddings**: If `seed:embeddings` hasn't run, semantic search silently returns no results and search falls back to FTS-only.
