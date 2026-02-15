"use client";

import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card";

type LicenseBadgeProps = {
  license: { title: string; spdx?: string; url?: string };
  author?: { name: string; url?: string } | null;
  className?: string;
};

export function LicenseBadge({ license, author, className }: LicenseBadgeProps) {
  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <button className={`inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/20 ${className ?? ""}`}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          LICENSE
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" sideOffset={8} className="w-auto max-w-64">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs font-medium">{license.title}</p>
          {license.spdx && (
            <p className="font-mono text-[10px] text-muted-foreground">
              SPDX: {license.spdx}
            </p>
          )}
          {author && (
            <p className="font-mono text-[10px] text-muted-foreground">
              by{" "}
              {author.url ? (
                <a
                  href={author.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {author.name}
                </a>
              ) : (
                author.name
              )}
            </p>
          )}
          {license.url && (
            <a
              href={license.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              view license
            </a>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
