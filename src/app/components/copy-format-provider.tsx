"use client";

import { createContext, useContext, useState, useCallback, useMemo, useRef } from "react";
import { setCopyFormat as setCopyFormatCookie } from "@/app/actions";
import { DEFAULT_COPY_FORMAT, type CopyFormat } from "@/lib/icons/copy-format";

const CopyFormatContext = createContext<{
  format: CopyFormat;
  setFormat: (f: CopyFormat) => void;
}>({
  format: DEFAULT_COPY_FORMAT,
  setFormat: () => {},
});

/**
 * The same value, behind a ref whose identity never changes.
 *
 * Context subscription re-renders a consumer no matter how it is memoized, so a
 * component that only needs the format when the user clicks — every card in the
 * grid — reads it from here instead. Switching format then re-renders the
 * selector alone rather than several hundred inline SVGs.
 */
const CopyFormatRefContext = createContext<{ current: CopyFormat }>({
  current: DEFAULT_COPY_FORMAT,
});

export function CopyFormatProvider({
  initialFormat,
  children,
}: {
  initialFormat: CopyFormat;
  children: React.ReactNode;
}) {
  const [format, setFormatState] = useState<CopyFormat>(initialFormat);
  const formatRef = useRef<CopyFormat>(initialFormat);

  const setFormat = useCallback((f: CopyFormat) => {
    formatRef.current = f;
    setFormatState(f);
    setCopyFormatCookie(f);
  }, []);

  // Without this the provider hands consumers a fresh object on every render.
  const value = useMemo(() => ({ format, setFormat }), [format, setFormat]);

  return (
    <CopyFormatRefContext.Provider value={formatRef}>
      <CopyFormatContext.Provider value={value}>{children}</CopyFormatContext.Provider>
    </CopyFormatRefContext.Provider>
  );
}

/** Subscribes to changes — for components that render differently per format. */
export function useCopyFormat() {
  return useContext(CopyFormatContext);
}

/** Does not subscribe — read `.current` inside an event handler, never during render. */
export function useCopyFormatRef() {
  return useContext(CopyFormatRefContext);
}
