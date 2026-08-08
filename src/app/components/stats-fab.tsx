import Link from "next/link";

/**
 * The way into /stats, floating over the grid rather than sitting in the
 * header row.
 *
 * Bottom right is also where the copy toast appears, and copying is the thing
 * people come here to do — so the Toaster carries an offset that stacks toasts
 * above this instead of on top of it (see `layout.tsx`). Changing one without
 * the other puts a 2-second toast over the button on every copy.
 *
 * The glyph is three bars rather than an icon from the database: this renders
 * on every page load, and it would be strange for the one icon the site draws
 * itself to be one it had to fetch.
 */
export function StatsFab() {
  return (
    <Link
      href="/stats"
      aria-label="Usage statistics"
      className="group fixed bottom-4 right-4 z-40 flex items-center gap-2 border border-border bg-background px-3 py-2 font-mono text-[11px] text-foreground shadow-[0_2px_12px_rgba(0,0,0,0.18)] transition-colors hover:bg-foreground hover:text-background"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect x="0" y="7" width="3" height="5" fill="currentColor" />
        <rect x="4.5" y="3" width="3" height="9" fill="currentColor" />
        <rect x="9" y="0" width="3" height="12" fill="currentColor" />
      </svg>
      stats
    </Link>
  );
}
