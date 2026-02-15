"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { IconCard } from "./icon-card";
import { useCopyFormat } from "./copy-format-provider";

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
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function loadMore() {
    const offset = results.length;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (collection) params.set("collection", collection);
    if (category) params.set("category", category);
    if (license) params.set("license", license);
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
        <div className="flex justify-center pb-8 pt-2">
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
