# i0 — Icon Search MCP Server

MCP server that serves 200k+ icons from 150+ open-source collections. Built with xmcp framework, bun:sqlite, Drizzle ORM, and FTS5 full-text search.

## Commands

```bash
bun run seed          # Seed SQLite from @iconify/json (required before first run)
bun run build         # Build for production (rspack via xmcp)
bun run dev           # Dev server on :3001 (uses bun --bun to force Bun runtime)
bun run start         # Run production build (bun dist/http.js)
```

## Architecture

**Runtime has zero dependency on `@iconify/json`** (395MB). Icon SVG bodies are stored in SQLite at seed time. At runtime, `@iconify/utils` renders SVGs from DB data. `@iconify/json` is a devDependency only.

### Key files

- `xmcp.config.ts` — Externalizes `bun:sqlite` from rspack bundling
- `src/lib/db/schema.ts` — Drizzle table definitions (`collections`, `icons`)
- `src/lib/db/connection.ts` — Singleton readonly bun:sqlite connection via Drizzle
- `src/lib/db/seed.ts` — Seeds DB from @iconify/json, builds FTS5 index with porter stemmer
- `src/lib/icons/svg.ts` — Renders SVG from DB body/width/height using @iconify/utils
- `src/lib/icons/react.ts` — Converts SVG to typed React component string (regex-based, following icones project pattern)
- `src/tools/` — MCP tools (search-icons, get-icon, list-collections)
- `src/prompts/` — Agent guidance prompts
- `src/resources/` — MCP resources (currently empty)

### Database

SQLite at `data/icons.db` (gitignored). ~303k icons, 223 collections, ~474MB.

- `collections` table — prefix (PK), name, total, author (JSON), license (JSON), category, palette, height, version, samples (JSON)
- `icons` table — id (PK), prefix, name, full_name (unique idx), body (SVG), width, height, category, tags
- `icons_fts` — FTS5 virtual table (content-synced to icons, `tokenize='porter ascii'`)

JSON columns (`author`, `license`, `samples`) are stored as strings and parsed at query time.

### xmcp conventions

Tools, prompts, and resources are file-system discovered from `src/tools/`, `src/prompts/`, `src/resources/`. Each file exports:
- `schema` — Zod object for tool params
- `metadata` — Name, description, annotations
- `default function` — Handler

Tool handlers return `{ content: [{ type: "text", text }], structuredContent?, isError? }`.

### Querying

- Tools use Drizzle ORM: `db.select().from(table).where(eq(...)).get()`
- FTS5 queries use Drizzle's raw SQL: `db.all<T>(sql\`SELECT ... FROM icons_fts WHERE icons_fts MATCH ...\`)`
- FTS5 can't be expressed in Drizzle's query builder — raw `sql` template is the correct pattern
- BM25 ranking weights: `bm25(icons_fts, 2.0, 10.0, 1.0, 1.0, 0.5)` — name weighted highest

## Gotchas

- **Bun-only runtime**: Uses `bun:sqlite` — won't run on Node.js. `bun --bun` in dev script forces Bun for xmcp's child process (xmcp internally spawns `node`).
- **DB path is `process.cwd()/data/icons.db`**: Must run from project root.
- **Re-seeding deletes the existing DB**: `seed.ts` removes `data/icons.db` before recreating. No incremental updates.
- **FTS5 porter stemmer**: "arrows" matches "arrow", "deleting" matches "delete". Query sanitizer strips FTS5 special chars and appends `*` to last token for prefix matching.
- **Icon names vary by collection version**: e.g. Lucide uses `house` not `home` in current @iconify/json.
