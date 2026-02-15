import { Suspense } from "react";
import {
  getCollections,
  searchIconsWeb,
  browseIcons,
} from "@/lib/icons/queries";
import { ThemeToggle } from "./components/theme-toggle";
import { SearchInput } from "./components/search-input";
import { IconGrid } from "./components/icon-grid";
import { CollectionsGrid } from "./components/collections-grid";

async function SearchHeader() {
  const allCollections = await getCollections();
  const collectionsForFilter = allCollections.map((c) => ({
    prefix: c.prefix,
    name: c.name,
    total: c.total,
  }));
  return <SearchInput collections={collectionsForFilter} />;
}

async function SearchResults({
  q,
  collection,
}: {
  q: string;
  collection?: string;
}) {
  const data = await searchIconsWeb(q, collection);
  const results = data.results.map((r) => ({
    fullName: r.fullName,
    name: r.name,
    prefix: r.prefix,
    collection: r.collection,
    body: r.body,
    width: r.width,
    height: r.height,
  }));

  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-xs text-muted-foreground">
        {data.results.length}
        {data.hasMore ? "+" : ""} results for &quot;{q}&quot;
        {collection ? ` in ${collection}` : ""}
      </p>
      <IconGrid
        key={`search-${q}-${collection ?? ""}`}
        initialResults={results}
        initialHasMore={data.hasMore}
        query={q}
        collection={collection}
      />
    </div>
  );
}

async function BrowseCollection({ collection }: { collection: string }) {
  const data = await browseIcons(collection);
  const results = data.results.map((r) => ({
    fullName: r.fullName,
    name: r.name,
    prefix: r.prefix,
    body: r.body,
    width: r.width,
    height: r.height,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <h2 className="font-mono text-sm font-medium">
          {data.collection?.name ?? collection}
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {data.collection?.prefix}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/60 tabular-nums">
          {data.collection?.total.toLocaleString()} icons
        </span>
      </div>
      <IconGrid
        key={`browse-${collection}`}
        initialResults={results}
        initialHasMore={data.hasMore}
        collection={collection}
      />
    </div>
  );
}

async function CollectionsView() {
  "use cache";
  const allCollections = await getCollections();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-xs text-muted-foreground">
          {allCollections.length} collections
        </p>
      </div>
      <CollectionsGrid collections={allCollections} />
    </div>
  );
}

async function Content({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; collection?: string }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const collection = params.collection ?? "";

  if (q) {
    return <SearchResults q={q} collection={collection || undefined} />;
  }
  if (collection) {
    return <BrowseCollection collection={collection} />;
  }
  return <CollectionsView />;
}

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; collection?: string }>;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-10 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <a href="/" className="group flex items-baseline gap-1">
            <pre className="text-lg font-bold leading-none tracking-tighter text-foreground">
              i0
            </pre>
            <span className="font-mono text-[10px] text-muted-foreground/50 transition-colors group-hover:text-muted-foreground">
              icon search
            </span>
          </a>
          <div className="flex items-center gap-2">
            <a
              href="/mcp"
              className="font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              [mcp]
            </a>
            <a
              href="https://github.com/marcoripa96/i0"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              [github]
            </a>
            <ThemeToggle />
          </div>
        </div>

        <Suspense>
          <SearchHeader />
        </Suspense>
      </header>

      <main className="flex-1">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <p className="font-mono text-xs text-muted-foreground animate-pulse">
                loading...
              </p>
            </div>
          }
        >
          <Content searchParams={searchParams} />
        </Suspense>
      </main>

      <footer className="mt-12 border-t border-border pt-6 pb-8">
        <p className="font-mono text-[10px] text-muted-foreground/40 text-center">
          200k+ icons from 150+ open-source collections
        </p>
      </footer>
    </div>
  );
}
