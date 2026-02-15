# icons0

Search 200k+ icons from 150+ open-source collections. Use the web UI or connect your AI agent via MCP.

Built with [Next.js](https://nextjs.org), [xmcp](https://github.com/nichochar/xmcp), [Turso](https://turso.tech) (libSQL), [Drizzle ORM](https://orm.drizzle.team), and [Gemini](https://ai.google.dev) embeddings.

## Features

- **Hybrid search** — FTS5 keyword matching + semantic vector search, combined with Reciprocal Rank Fusion
- **MCP server** — Four tools (`search-icons`, `get-icon`, `list-collections`, `list-licenses`) for AI agents
- **shadcn registry** — Install any icon as a standalone React component via `npx shadcn add`
- **Zero runtime dependency on icon packages** — All 200k+ icon SVGs are stored in the database at seed time; `@iconify/json` (395 MB) is a devDependency only
- **React component output** — Get typed, copy-paste-ready React components from any icon
- **Batch retrieval** — Fetch up to 20 icons in a single request

## Getting started

### Prerequisites

- [Bun](https://bun.sh) (v1.1+)
- A [Turso](https://turso.tech) database
- (Optional) A [Google AI](https://ai.google.dev) API key for semantic search embeddings

### Environment variables

```bash
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
GOOGLE_API_KEY=your-key          # optional, for semantic search
```

### Install and seed

```bash
# Install dependencies
bun install

# Seed the database with icons from @iconify/json
bun run seed

# (Optional) Generate vector embeddings for semantic search
bun run seed:embeddings
```

### Run

```bash
# Development (with Turbopack)
bun run dev

# Production
bun run build && bun run start
```

The app starts at `http://localhost:3000`. The MCP endpoint is at `/mcp`.

## MCP tools

Connect any MCP-compatible client to the `/mcp` endpoint. Four tools are available:

### `search-icons`

Search icons by keyword or browse a collection.

```json
{ "query": "arrow left" }
{ "query": "home", "collection": "lucide" }
{ "collection": "tabler", "category": "Navigation" }
```

### `get-icon`

Retrieve icons as SVG or React components.

```json
{ "name": "lucide:home" }
{ "name": "lucide:home", "format": "react" }
{ "name": ["mdi:home", "lucide:home", "tabler:home"] }
```

### `list-collections`

Discover available icon collections, optionally filtered by category or name.

```json
{ "category": "Emoji" }
{ "search": "material" }
```

### `list-licenses`

List all unique licenses across collections with icon counts.

## shadcn registry

Install any icon directly into your project as a standalone React component — no icon library dependency required:

```bash
# Single icon
npx shadcn@latest add https://i0-phi.vercel.app/r/lucide:home.json

# Multiple icons
npx shadcn@latest add https://i0-phi.vercel.app/r/lucide:home.json https://i0-phi.vercel.app/r/lucide:arrow-right.json

# Entire collection
npx shadcn@latest add https://i0-phi.vercel.app/r/lucide.json
```

```tsx
import { LucideHome } from "@/components/icons/lucide-home";
```

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Landing page with search UI
│   ├── mcp/route.ts          # MCP endpoint (xmcp adapter)
│   ├── r/[name]/route.ts     # shadcn registry endpoint
│   └── components/           # UI components
├── lib/
│   ├── db/
│   │   ├── schema.ts         # Drizzle table definitions
│   │   ├── connection.ts     # Turso client + Drizzle instance
│   │   ├── seed.ts           # Seed DB from @iconify/json
│   │   └── seed-embeddings.ts
│   └── icons/
│       ├── search.ts         # Hybrid FTS5 + semantic search
│       ├── svg.ts            # SVG rendering via @iconify/utils
│       ├── react.ts          # SVG → React component conversion
│       └── queries.ts        # Web UI database queries
├── tools/                    # MCP tool handlers
├── prompts/                  # MCP agent prompts
└── resources/                # MCP resources
```

### Database

Hosted on Turso (libSQL). Two main tables:

- **`collections`** — 223 icon collections with metadata (author, license, category, samples)
- **`icons`** — 303k+ icons with SVG body, dimensions, tags, and optional 256-dimensional embeddings

Search is powered by:

1. **`icons_fts`** — FTS5 virtual table with porter stemming for keyword search
2. **`icons_embedding_idx`** — DiskANN vector index for semantic similarity search

### Search pipeline

1. Query is sanitized and tokenized (porter stemmer, prefix matching)
2. FTS5 and vector search run in parallel
3. Results are merged using Reciprocal Rank Fusion (RRF)
4. Filters (collection, category, license) are applied at query time

If embeddings haven't been seeded, search gracefully falls back to FTS5 only.

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Dev server on :3000 (Turbopack) |
| `bun run build` | Production build |
| `bun run start` | Run production build |
| `bun run seed` | Seed DB from @iconify/json |
| `bun run seed:embeddings` | Generate Gemini embeddings (needs `GOOGLE_API_KEY`) |
| `bun run lint` | Run ESLint |

## Tech stack

- [Next.js](https://nextjs.org) 16 — App Router, React Server Components
- [xmcp](https://github.com/nichochar/xmcp) — MCP server framework with Next.js adapter
- [Turso](https://turso.tech) — libSQL database with vector search
- [Drizzle ORM](https://orm.drizzle.team) — Type-safe SQL
- [Gemini](https://ai.google.dev) — `gemini-embedding-001` for 256-d icon embeddings
- [@iconify/utils](https://github.com/iconify/iconify) — SVG rendering from icon data
- [Tailwind CSS](https://tailwindcss.com) 4 — Styling
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [better-auth](https://www.better-auth.com) — Authentication

## License

[MIT](LICENSE) &copy; Marco Ripa
