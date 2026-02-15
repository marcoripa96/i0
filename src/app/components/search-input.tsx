"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Collection = {
  prefix: string;
  name: string;
  total: number;
};

export function SearchInput({
  collections,
}: {
  collections: Collection[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const collection = searchParams.get("collection") ?? "";
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function updateUrl(q: string, col: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (col) params.set("collection", col);
    const search = params.toString();
    startTransition(() => {
      router.replace(search ? `/?${search}` : "/", { scroll: false });
    });
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateUrl(value, collection);
    }, 300);
  }

  function handleCollectionChange(value: string) {
    const col = value === "all" ? "" : value;
    updateUrl(query, col);
  }

  return (
    <div className="flex w-full items-center gap-3">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
          {">"}
        </span>
        <Input
          ref={inputRef}
          type="text"
          placeholder="search icons..."
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="h-10 pl-7 font-mono text-sm"
        />
      </div>
      <Select value={collection || "all"} onValueChange={handleCollectionChange}>
        <SelectTrigger className="h-10 w-[180px] font-mono text-xs shrink-0">
          <SelectValue placeholder="all collections" />
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          <SelectItem value="all" className="font-mono text-xs">
            all collections
          </SelectItem>
          {collections.map((c) => (
            <SelectItem
              key={c.prefix}
              value={c.prefix}
              className="font-mono text-xs"
            >
              {c.prefix} ({c.total})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
