import { Suspense } from "react";
import {
  getCollections,
  getCategories,
  getCategoriesForCollection,
  getCollectionPrefixesForCategory,
  getLicenses,
  searchIconsWeb,
  searchCollections,
  browseIcons,
  browseByCategory,
  browseAllIcons,
} from "@/lib/icons/queries";
import { ThemeToggle } from "./components/theme-toggle";
import { SearchInput } from "./components/search-input";
import { StickySearch } from "./components/sticky-search";
import { IconGrid } from "./components/icon-grid";
import { CollectionsGrid } from "./components/collections-grid";
import { LicenseBadge } from "./components/license-badge";
import { InstallCommand } from "./components/install-command";
import { Signature } from "./components/signature";
import { McpDialog } from "./components/mcp-dialog";
import { UserMenu } from "./components/user-menu";
import {
  SearchTransitionProvider,
} from "./components/search-transition";
import { TransitionOverlay } from "./components/transition-overlay";

async function SearchHeader({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; collection?: string; category?: string; license?: string; scope?: string }>;
}) {
  const params = await searchParams;
  const collection = params.collection ?? "";
  const category = params.category ?? "";

  const [allCollections, categories, categoryPrefixes, licenses] = await Promise.all([
    getCollections(),
    collection ? getCategoriesForCollection(collection) : getCategories(),
    category ? getCollectionPrefixesForCategory(category) : null,
    getLicenses(),
  ]);
  const prefixSet = categoryPrefixes ? new Set(categoryPrefixes) : null;

  const collectionsForFilter = allCollections
    .filter((c) => !prefixSet || prefixSet.has(c.prefix))
    .map((c) => ({
      prefix: c.prefix,
      name: c.name,
      total: c.total,
    }));

  return (
    <StickySearch>
      <SearchInput collections={collectionsForFilter} categories={categories} licenses={licenses} />
    </StickySearch>
  );
}

async function SearchResults({
  q,
  collection,
  category,
  license,
  scope,
}: {
  q: string;
  collection?: string;
  category?: string;
  license?: string;
  scope?: string;
}) {
  const includeCollections = scope !== "icons" && !collection;
  const [data, matchingCollections] = await Promise.all([
    searchIconsWeb(q, collection, category, 60, 0, license),
    includeCollections ? searchCollections(q) : Promise.resolve([]),
  ]);

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
    <div className="flex flex-col gap-8">
      {matchingCollections.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="font-mono text-xs text-muted-foreground">
            {matchingCollections.length} collection{matchingCollections.length !== 1 ? "s" : ""} matching &quot;{q}&quot;
          </p>
          <CollectionsGrid collections={matchingCollections} />
        </div>
      )}

      <div className="flex flex-col gap-4">
        <p className="font-mono text-xs text-muted-foreground">
          {data.results.length}
          {data.hasMore ? "+" : ""} icons for &quot;{q}&quot;
          {collection ? ` in ${collection}` : ""}
          {category ? ` [${category}]` : ""}
        </p>
        <IconGrid
          key={`search-${q}-${collection ?? ""}-${category ?? ""}-${license ?? ""}`}
          initialResults={results}
          initialHasMore={data.hasMore}
          query={q}
          collection={collection}
          category={category}
          license={license}
        />
      </div>
    </div>
  );
}

async function BrowseCollection({
  collection,
  category,
  license,
}: {
  collection: string;
  category?: string;
  license?: string;
}) {
  const data = await browseIcons(collection, category, 60, 0, license);
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
      <div className="flex items-center gap-3">
        <h2 className="font-mono text-sm font-medium">
          {data.collection?.name ?? collection}
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {data.collection?.prefix}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/60 tabular-nums">
          {data.collection?.total.toLocaleString()} icons
        </span>
        {category && (
          <span className="font-mono text-[10px] text-muted-foreground">
            [{category}]
          </span>
        )}
        {data.collection?.license && (
          <LicenseBadge className="ml-auto"
            license={data.collection.license}
            author={data.collection.author}
          />
        )}
      </div>
      <IconGrid
        key={`browse-${collection}-${category ?? ""}-${license ?? ""}`}
        initialResults={results}
        initialHasMore={data.hasMore}
        collection={collection}
        category={category}
        license={license}
      />
    </div>
  );
}

async function BrowseCategoryView({ category, license }: { category: string; license?: string }) {
  const data = await browseByCategory(category, 60, 0, license);
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
        {data.hasMore ? "+" : ""} icons in [{category}]
      </p>
      <IconGrid
        key={`category-${category}-${license ?? ""}`}
        initialResults={results}
        initialHasMore={data.hasMore}
        category={category}
        license={license}
      />
    </div>
  );
}


async function CollectionsView({ license }: { license?: string }) {
  const allCollections = await getCollections();
  const filtered = license
    ? allCollections.filter((c) => c.license?.title === license)
    : allCollections;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-xs text-muted-foreground">
          {filtered.length} collections
        </p>
      </div>
      <CollectionsGrid collections={filtered} />
    </div>
  );
}

async function BrowseAllIconsView({ license }: { license?: string }) {
  const data = await browseAllIcons(60, 0, license);
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
      <IconGrid
        key={`browse-all-${license ?? ""}`}
        initialResults={results}
        initialHasMore={data.hasMore}
        license={license}
      />
    </div>
  );
}

async function Content({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    collection?: string;
    category?: string;
    license?: string;
    scope?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const collection = params.collection ?? "";
  const category = params.category ?? "";
  const license = params.license ?? "";
  const scope = params.scope ?? "";

  if (q) {
    return (
      <SearchResults
        q={q}
        collection={collection || undefined}
        category={category || undefined}
        license={license || undefined}
        scope={scope || undefined}
      />
    );
  }
  if (collection) {
    return (
      <BrowseCollection
        collection={collection}
        category={category || undefined}
        license={license || undefined}
      />
    );
  }
  if (category) {
    return <BrowseCategoryView category={category} license={license || undefined} />;
  }
  if (scope === "icons") {
    return <BrowseAllIconsView license={license || undefined} />;
  }
  return <CollectionsView license={license || undefined} />;
}

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    collection?: string;
    category?: string;
    license?: string;
    scope?: string;
  }>;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-10 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <a href="/" className="group flex items-baseline">
            <pre className="text-lg font-bold leading-none tracking-tighter text-foreground">
              icons0</pre><span className="text-sm font-normal leading-none tracking-tighter text-muted-foreground/40 transition-colors group-hover:text-muted-foreground">.dev</span>
          </a>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="hidden sm:flex items-center gap-2">
              <McpDialog />
              <a
                href="https://github.com/marcoripa96/i0"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              >
                [github]
              </a>
            </span>
            <UserMenu />
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="flex flex-col gap-1">
            <p className="font-mono text-sm text-foreground">
              the fastest icon search — for you and your AI agent
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              200k+ icons · 150+ collections · web UI + MCP server
            </p>
          </div>
          <InstallCommand />
        </div>

      </header>

      <SearchTransitionProvider>
        <Suspense
          fallback={
            <StickySearch>
              <SearchInput collections={[]} categories={[]} licenses={[]} />
            </StickySearch>
          }
        >
          <SearchHeader searchParams={searchParams} />
        </Suspense>

        <main className="mt-10 flex-1">
          <TransitionOverlay>
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
          </TransitionOverlay>
        </main>
      </SearchTransitionProvider>

      <footer className="mt-12 border-t border-border pt-6 pb-8 flex flex-col items-center gap-4">
        <p className="font-mono text-[10px] text-muted-foreground/40 text-center">
          powered by <a href="https://iconify.design" target="_blank" rel="noopener noreferrer" className="text-muted-foreground/60 transition-colors hover:text-muted-foreground">iconify</a> · <a href="https://github.com/marcoripa96/i0" target="_blank" rel="noopener noreferrer" className="text-muted-foreground/60 transition-colors hover:text-muted-foreground">github</a> · MIT license
        </p>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground/40">made by</span>
          <Signature />
        </div>
      </footer>
    </div>
  );
}
