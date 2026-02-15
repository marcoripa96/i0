"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="gap-1.5 font-mono text-xs tracking-tight text-muted-foreground hover:text-foreground">
      <span className="inline-block size-2.5 rounded-full bg-foreground" />
      [{dark ? "dark" : "light"}]
    </Button>
  );
}
