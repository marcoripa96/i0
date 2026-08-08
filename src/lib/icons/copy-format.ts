/**
 * The copy formats offered by the web UI, kept apart from `code.ts` so the
 * places that only need the list — the root layout reading the cookie, the
 * server action writing it — do not pull the SVG renderer in with it.
 */
export const COPY_FORMATS = ["name", "svg", "react", "shadcn"] as const;

export type CopyFormat = (typeof COPY_FORMATS)[number];

export const DEFAULT_COPY_FORMAT: CopyFormat = "svg";

/** Narrows an untrusted string — a cookie value, a server action argument. */
export function parseCopyFormat(value: string | undefined): CopyFormat {
  return COPY_FORMATS.includes(value as CopyFormat)
    ? (value as CopyFormat)
    : DEFAULT_COPY_FORMAT;
}
