"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function InstallCommand() {
  const [copied, setCopied] = useState(false);
  const searchParams = useSearchParams();
  const collection = searchParams.get("collection") ?? "";
  const command = collection
    ? `npx shadcn add @i0/${collection}`
    : "npx shadcn add @i0/<name>";

  async function handleCopy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      className="group flex w-full items-center gap-3 border border-border bg-card px-4 py-3 font-mono text-sm text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground sm:w-auto"
    >
      <span className="text-muted-foreground/50 select-none">$</span>
      <span className="whitespace-nowrap">{command}</span>
      <span className="ml-auto text-muted-foreground/40 transition-colors group-hover:text-foreground/60">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </span>
    </button>
  );
}
