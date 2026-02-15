"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { IconCard } from "./icon-card";

type IconData = {
  fullName: string;
  name: string;
  prefix: string;
  collection?: string;
  body: string;
  width: number;
  height: number;
};

export function IconGrid({
  initialResults,
  initialHasMore,
  query,
  collection,
}: {
  initialResults: IconData[];
  initialHasMore: boolean;
  query?: string;
  collection?: string;
}) {
  const [results, setResults] = useState(initialResults);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function loadMore() {
    const offset = results.length;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (collection) params.set("collection", collection);
    params.set("offset", String(offset));

    startTransition(async () => {
      const res = await fetch(`/api/icons?${params.toString()}`);
      const data = await res.json();
      setResults((prev) => [...prev, ...data.results]);
      setHasMore(data.hasMore);
    });
  }

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
            onClick={() => router.push("/")}
            className="font-mono text-xs"
          >
            [clear search]
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {results.map((icon) => (
          <IconCard key={icon.fullName} icon={icon} />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={isPending}
            className="font-mono text-xs"
          >
            {isPending ? "loading..." : "[load more]"}
          </Button>
        </div>
      )}
    </div>
  );
}
