"use client";

import { useCallback, useEffect, useRef, useState, createContext, useContext, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSearchTransition } from "./search-transition";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";

type Collection = {
  prefix: string;
  name: string;
  total: number;
};

type FilterData = {
  collections: Collection[];
  categories: string[];
  licenses: string[];
};

const FilterSetterContext = createContext<{
  setFilterData: (data: FilterData) => void;
}>({ setFilterData: () => {} });

export function FiltersHydrator({
  collections,
  categories,
  licenses,
}: FilterData) {
  const { setFilterData } = useContext(FilterSetterContext);
  useEffect(() => {
    setFilterData({ collections, categories, licenses });
  }, [collections, categories, licenses, setFilterData]);
  return null;
}

export function SearchInput({
  children,
}: {
  children?: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startTransition } = useSearchTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const collection = searchParams.get("collection") ?? "";
  const category = searchParams.get("category") ?? "";
  const license = searchParams.get("license") ?? "";
  const rawScope = searchParams.get("scope") === "icons" ? "icons" : "all";
  const scope = collection ? "icons" : rawScope;
  const hasFilters = query || collection || category || license || scope === "icons";

  const [filterData, setFilterData] = useState<FilterData>({
    collections: [],
    categories: [],
    licenses: [],
  });

  const [collectionOpen, setCollectionOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleReset = useCallback(() => {
    setQuery("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    startTransition(() => {
      router.replace("/", { scroll: false });
    });
    inputRef.current?.focus();
  }, [router, startTransition]);

  useEffect(() => {
    inputRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleReset();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key.length === 1) {
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleReset]);

  function updateUrl(q: string, col: string, cat: string, lic: string, sc: string = scope) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (col) params.set("collection", col);
    if (cat) params.set("category", cat);
    if (lic) params.set("license", lic);
    if (sc === "icons") params.set("scope", "icons");
    const search = params.toString();
    startTransition(() => {
      router.replace(search ? `/?${search}` : "/", { scroll: false });
    });
  }

  function handleScopeChange(value: "all" | "icons") {
    updateUrl(query, collection, category, license, value);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateUrl(value, collection, category, license);
    }, 300);
  }

  function handleCollectionChange(value: string) {
    const col = value === collection ? "" : value;
    setCollectionOpen(false);
    updateUrl(query, col, category, license);
  }

  function handleCategoryChange(value: string) {
    const cat = value === category ? "" : value;
    setCategoryOpen(false);
    updateUrl(query, collection, cat, license);
  }

  function handleLicenseChange(value: string) {
    const lic = value === license ? "" : value;
    setLicenseOpen(false);
    updateUrl(query, collection, category, lic);
  }

  return (
    <FilterSetterContext.Provider value={{ setFilterData }}>
      {children}
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
            {">"}
          </span>
          <Input
            ref={inputRef}
            type="text"
            spellCheck={false}
            placeholder="search icons and collections..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="h-10 pl-7 font-mono text-sm bg-background"
          />
        </div>
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] text-muted-foreground/60">scope</label>
            <div className="flex h-10 items-center rounded-md border border-input bg-background p-1">
              <button
                onClick={() => handleScopeChange("all")}
                disabled={!!collection}
                className={`h-full px-2.5 rounded-sm font-mono text-[11px] transition-colors ${
                  collection
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : scope === "all"
                      ? "bg-foreground text-background cursor-pointer"
                      : "text-muted-foreground hover:text-foreground cursor-pointer"
                }`}
              >
                all
              </button>
              <button
                onClick={() => handleScopeChange("icons")}
                className={`h-full px-2.5 rounded-sm font-mono text-[11px] transition-colors cursor-pointer ${
                  scope === "icons"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                icons
              </button>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-1 sm:flex-initial">
            <label className="font-mono text-[10px] text-muted-foreground/60">collection</label>
            <Popover open={collectionOpen} onOpenChange={setCollectionOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-10 w-full justify-between font-mono text-xs sm:w-[180px]"
              >
                <span className="truncate">
                  {collection || "all"}
                </span>
                <span className="text-muted-foreground/60">&#x25BE;</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="search collections..."
                  className="font-mono text-xs"
                />
                <CommandList>
                  <CommandEmpty className="font-mono text-xs">
                    no collection found
                  </CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => handleCollectionChange("")}
                      className="font-mono text-xs"
                    >
                      all collections
                    </CommandItem>
                    {filterData.collections.map((c) => (
                      <CommandItem
                        key={c.prefix}
                        value={c.prefix}
                        onSelect={() => handleCollectionChange(c.prefix)}
                        className="font-mono text-xs"
                      >
                        <span className="flex-1 truncate">{c.prefix}</span>
                        <span className="text-muted-foreground/60 tabular-nums">
                          {c.total.toLocaleString()}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          </div>
          <div className="flex flex-1 flex-col gap-1 sm:flex-initial">
            <label className="font-mono text-[10px] text-muted-foreground/60">category</label>
            <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-10 w-full justify-between font-mono text-xs sm:w-[160px]"
              >
                <span className="truncate">
                  {category || "all"}
                </span>
                <span className="text-muted-foreground/60">&#x25BE;</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="search categories..."
                  className="font-mono text-xs"
                />
                <CommandList>
                  <CommandEmpty className="font-mono text-xs">
                    no category found
                  </CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => handleCategoryChange("")}
                      className="font-mono text-xs"
                    >
                      all categories
                    </CommandItem>
                    {filterData.categories.map((cat) => (
                      <CommandItem
                        key={cat}
                        value={cat}
                        onSelect={() => handleCategoryChange(cat)}
                        className="font-mono text-xs"
                      >
                        {cat}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          </div>
          <div className="flex flex-1 flex-col gap-1 sm:flex-initial">
            <label className="font-mono text-[10px] text-muted-foreground/60">license</label>
            <Popover open={licenseOpen} onOpenChange={setLicenseOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-10 w-full justify-between font-mono text-xs sm:w-[140px]"
              >
                <span className="truncate">
                  {license || "all"}
                </span>
                <span className="text-muted-foreground/60">&#x25BE;</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="search licenses..."
                  className="font-mono text-xs"
                />
                <CommandList>
                  <CommandEmpty className="font-mono text-xs">
                    no license found
                  </CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => handleLicenseChange("")}
                      className="font-mono text-xs"
                    >
                      all licenses
                    </CommandItem>
                    {filterData.licenses.map((lic) => (
                      <CommandItem
                        key={lic}
                        value={lic}
                        onSelect={() => handleLicenseChange(lic)}
                        className="font-mono text-xs"
                      >
                        {lic}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-10 gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              reset
              <Kbd className="bg-transparent border border-border text-[10px]">esc</Kbd>
            </Button>
          )}
        </div>
      </div>
    </FilterSetterContext.Provider>
  );
}
