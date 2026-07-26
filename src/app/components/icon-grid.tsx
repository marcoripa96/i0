"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { IconCard } from "./icon-card";
import { useCopyFormat } from "./copy-format-provider";
import { useSearchTransition } from "./search-transition";

type IconData = {
  fullName: string;
  name: string;
  prefix: string;
  collection?: string;
  body: string;
  width: number;
  height: number;
};

function FormatSelector() {
  const { format, setFormat } = useCopyFormat();

  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-[10px] text-muted-foreground/60 mr-1">copy as</span>
      <Button
        variant={format === "svg" ? "default" : "outline"}
        size="sm"
        onClick={() => setFormat("svg")}
        className="h-6 px-2 font-mono text-[10px] transition-none"
      >
        svg
      </Button>
      <Button
        variant={format === "react" ? "default" : "outline"}
        size="sm"
        onClick={() => setFormat("react")}
        className="h-6 px-2 font-mono text-[10px] transition-none"
      >
        react <span className="text-muted-foreground/60">tsx</span>
      </Button>
      <Button
        variant={format === "shadcn" ? "default" : "outline"}
        size="sm"
        onClick={() => setFormat("shadcn")}
        className="h-6 px-2 font-mono text-[10px] transition-none"
      >
        shadcn
      </Button>
    </div>
  );
}

export function IconGrid({
  initialResults,
  initialHasMore,
  query,
  collection,
  category,
  license,
}: {
  initialResults: IconData[];
  initialHasMore: boolean;
  query?: string;
  collection?: string;
  category?: string;
  license?: string;
}) {
  const [results, setResults] = useState(initialResults);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { startTransition: startSearchTransition } = useSearchTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setFailed(false);

    const offset = results.length;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (collection) params.set("collection", collection);
    if (category) params.set("category", category);
    if (license) params.set("license", license);
    params.set("offset", String(offset));

    startTransition(async () => {
      // Every throw in here has to be caught. An uncaught one propagates out of
      // the transition to the nearest error boundary, which is the root: a
      // single failed page request used to replace the whole page with "This
      // page couldn't load", losing the results already on screen. Both a
      // rejected fetch and a 500 — whose `{error}` body has no `results` to
      // spread — got there.
      try {
        const res = await fetch(`/api/icons?${params.toString()}`);
        if (!res.ok) throw new Error(`/api/icons responded ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data.results)) throw new Error("/api/icons returned no results array");
        setResults((prev) => [...prev, ...data.results]);
        setHasMore(data.hasMore);
      } catch {
        setFailed(true);
      } finally {
        // In `finally`, not at the end of the happy path: leaving this set is
        // what wedged the grid, since every later call returned early on it.
        loadingRef.current = false;
      }
    });
  }, [results.length, query, collection, category, license, startTransition]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    // Stop observing after a failure. The sentinel is still on screen, so
    // re-arming would call `loadMore` again immediately and hammer a server
    // that just failed; the retry button below puts it back under user control.
    if (!sentinel || !hasMore || failed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      // 200px, not the viewport-sized margin card #276 asked for. Widening it
      // to "0px 0px 100% 0px" was tried and measured: at a realistic scroll
      // rate the sentinel never reaches the screen at either value, and when it
      // does — fast scrolling through a query nobody has cached — the stall
      // tracks the cold query, not the trigger point. It landed on a different
      // run each time, swinging 0-115 samples on one query set. A full viewport
      // of lead buys ~0.3s against a 1-2s cold fetch, so there is nothing there
      // to win, and prefetching a screen further ahead costs a page of SVG
      // bodies the reader may never reach.
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, failed, loadMore]);

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="font-mono text-sm text-muted-foreground">
          no icons found
        </p>
        {(query || collection) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => startSearchTransition(() => router.push("/"))}
            className="font-mono text-xs"
          >
            [clear search]
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-start">
        <FormatSelector />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {results.map((icon) => (
          <IconCard key={icon.fullName} icon={icon} />
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="flex flex-col items-center gap-2 pb-8 pt-2">
          {failed ? (
            <>
              <p className="font-mono text-xs text-muted-foreground">
                could not load more icons
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={isPending}
                className="font-mono text-xs"
              >
                [retry]
              </Button>
            </>
          ) : (
            <p className="font-mono text-xs text-muted-foreground animate-pulse">
              loading...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
