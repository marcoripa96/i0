"use client";

import { Button } from "@/components/ui/button";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button variant="ghost" size="sm" onClick={toggleTheme} className="gap-1.5 font-mono text-xs tracking-tight text-muted-foreground hover:text-foreground">
      <span className="inline-block size-2.5 rounded-full bg-foreground" />
      [{theme}]
    </Button>
  );
}
