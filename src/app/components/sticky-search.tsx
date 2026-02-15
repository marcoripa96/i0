"use client";

import { useRef, useState, useEffect } from "react";

export function StickySearch({ children }: { children: React.ReactNode }) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="h-0 w-full" />
      <div
        className={`sticky top-0 z-50 transition-[background-color,border-color] duration-200 ${
          stuck
            ? "border-b border-border bg-background/95 py-3 backdrop-blur-sm -mx-[calc(50vw-50%)] px-[calc(50vw-50%)]"
            : "border-b border-transparent"
        }`}
      >
        {children}
      </div>
    </>
  );
}
