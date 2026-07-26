"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useTransition,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { CollectionPageRow, SampleIcon } from "@/lib/icons/queries";
import { useSearchTransition } from "./search-transition";

type CollectionCardData = {
  prefix: string;
  name: string;
  total: number;
  sampleIcons?: SampleIcon[];
};

// Context for streaming sample icons into the grid
const SampleIconsContext = createContext<Record<string, SampleIcon[]>>({});

export function SampleIconsHydrator({ data }: { data: Record<string, SampleIcon[]> }) {
  const { setSampleIcons } = useContext(SampleIconsSetterContext);
  useEffect(() => {
    setSampleIcons(data);
  }, [data, setSampleIcons]);
  return null;
}

const SampleIconsSetterContext = createContext<{
  setSampleIcons: (data: Record<string, SampleIcon[]>) => void;
}>({ setSampleIcons: () => {} });

function SampleIconDisplay({
  body,
  width,
  height,
}: {
  body: string;
  width: number;
  height: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={16}
      height={16}
      className="fill-current text-muted-foreground"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

function SampleIconsSkeleton() {
  return (
    <>
      <div className="h-4 w-4 rounded-sm bg-muted-foreground/10 animate-pulse" />
      <div className="h-4 w-4 rounded-sm bg-muted-foreground/10 animate-pulse" />
      <div className="h-4 w-4 rounded-sm bg-muted-foreground/10 animate-pulse" />
    </>
  );
}

function CollectionCard({ collection }: { collection: CollectionCardData }) {
  const router = useRouter();
  const { startTransition } = useSearchTransition();
  const sampleIconsMap = useContext(SampleIconsContext);

  const sampleIcons = collection.sampleIcons ?? sampleIconsMap[collection.prefix];
  const isLoading = !sampleIcons;

  return (
    <button
      onClick={() =>
        startTransition(() =>
          router.push(`/?collection=${collection.prefix}`)
        )
      }
      className="group flex items-center gap-4 border border-border bg-background p-4 transition-colors hover:bg-accent -mb-px -mr-px text-left cursor-pointer"
    >
      <div className="flex items-center gap-1.5 shrink-0">
        {isLoading ? (
          <SampleIconsSkeleton />
        ) : sampleIcons.length > 0 ? (
          sampleIcons.map((icon, i) => (
            <SampleIconDisplay
              key={i}
              body={icon.body}
              width={icon.width}
              height={icon.height}
            />
          ))
        ) : (
          <div className="h-4 w-4 border border-dashed border-muted-foreground/30" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs font-medium text-foreground group-hover:text-foreground">
          {collection.prefix}
        </p>
        <p className="truncate font-mono text-[10px] text-muted-foreground">
          {collection.name}
        </p>
      </div>
      <span className="font-mono text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
        {collection.total.toLocaleString()}
      </span>
    </button>
  );
}

export function CollectionsGrid({
  collections,
  initialHasMore,
  license,
  children,
}: {
  collections: (CollectionPageRow | CollectionCardData)[];
  initialHasMore?: boolean;
  license?: string;
  children?: ReactNode;
}) {
  const [items, setItems] = useState<CollectionCardData[]>(collections);
  const [hasMore, setHasMore] = useState(initialHasMore ?? false);
  const [failed, setFailed] = useState(false);
  const [sampleIcons, setSampleIcons] = useState<Record<string, SampleIcon[]>>({});
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setFailed(false);

    const offset = items.length;
    const params = new URLSearchParams();
    if (license) params.set("license", license);
    params.set("offset", String(offset));

    startTransition(async () => {
      // See icon-grid.tsx: an uncaught throw here escapes the transition to the
      // root error boundary and takes the whole page down with it.
      try {
        const res = await fetch(`/api/collections?${params.toString()}`);
        if (!res.ok) throw new Error(`/api/collections responded ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data.results)) throw new Error("/api/collections returned no results array");
        setItems((prev) => [...prev, ...data.results]);
        setHasMore(data.hasMore);
      } catch {
        setFailed(true);
      } finally {
        loadingRef.current = false;
      }
    });
  }, [items.length, license, startTransition]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    // Not re-armed after a failure: the sentinel is still on screen, so it
    // would immediately retry against a server that just failed.
    if (!sentinel || !hasMore || failed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      // Left at 200px — see icon-grid.tsx for the measurement that rejected
      // widening this.
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, failed, loadMore]);

  return (
    <SampleIconsSetterContext.Provider value={{ setSampleIcons }}>
      <SampleIconsContext.Provider value={sampleIcons}>
        {children}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((c) => (
              <CollectionCard key={c.prefix} collection={c} />
            ))}
          </div>

          {hasMore && (
            <div ref={sentinelRef} className="flex flex-col items-center gap-2 pb-8 pt-2">
              {failed ? (
                <>
                  <p className="font-mono text-xs text-muted-foreground">
                    could not load more collections
                  </p>
                  <button
                    onClick={loadMore}
                    disabled={isPending}
                    className="border border-border px-2 py-1 font-mono text-xs transition-colors hover:bg-accent disabled:opacity-50 cursor-pointer"
                  >
                    [retry]
                  </button>
                </>
              ) : (
                <p className="font-mono text-xs text-muted-foreground animate-pulse">
                  loading...
                </p>
              )}
            </div>
          )}
        </div>
      </SampleIconsContext.Provider>
    </SampleIconsSetterContext.Provider>
  );
}
