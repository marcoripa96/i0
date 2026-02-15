"use client";

import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme} className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground cursor-pointer">
      <span className="inline-block size-1.5 rounded-full bg-foreground" />
      [{theme}]
    </button>
  );
}
