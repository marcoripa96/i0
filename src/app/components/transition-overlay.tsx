"use client";

import { useSearchTransition } from "./search-transition";

export function TransitionOverlay({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isPending } = useSearchTransition();

  return (
    <div
      className="transition-opacity duration-200"
      style={{ opacity: isPending ? 0.5 : 1 }}
    >
      {children}
    </div>
  );
}
