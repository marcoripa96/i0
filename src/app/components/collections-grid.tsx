"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CollectionWithSamples } from "@/lib/icons/queries";
import { useSearchTransition } from "./search-transition";

type CollectionCardData = {
  prefix: string;
  name: string;
  total: number;
  sampleIcons: { name: string; body: string; width: number; height: number }[];
};

function SampleIcon({
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

function CollectionCard({ collection }: { collection: CollectionCardData }) {
  const router = useRouter();
  const { startTransition } = useSearchTransition();

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
        {collection.sampleIcons.map((icon, i) => (
          <SampleIcon
            key={i}
            body={icon.body}
            width={icon.width}
            height={icon.height}
          />
        ))}
        {collection.sampleIcons.length === 0 && (
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
}: {
  collections: CollectionWithSamples[];
  initialHasMore?: boolean;
  license?: string;
}) {
  const [items, setItems] = useState<CollectionCardData[]>(collections);
  const [hasMore, setHasMore] = useState(initialHasMore ?? false);
  const [, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    const offset = items.length;
    const params = new URLSearchParams();
    if (license) params.set("license", license);
    params.set("offset", String(offset));

    startTransition(async () => {
      const res = await fetch(`/api/collections?${params.toString()}`);
      const data = await res.json();
      setItems((prev) => [...prev, ...data.results]);
      setHasMore(data.hasMore);
      loadingRef.current = false;
    });
  }, [items.length, license, startTransition]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((c) => (
          <CollectionCard key={c.prefix} collection={c} />
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center pb-8 pt-2">
          <p className="font-mono text-xs text-muted-foreground animate-pulse">
            loading...
          </p>
        </div>
      )}
    </div>
  );
}
