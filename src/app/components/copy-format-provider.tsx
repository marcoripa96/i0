"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { setCopyFormat as setCopyFormatCookie } from "@/app/actions";

type CopyFormat = "svg" | "react" | "shadcn";

const CopyFormatContext = createContext<{
  format: CopyFormat;
  setFormat: (f: CopyFormat) => void;
}>({
  format: "svg",
  setFormat: () => {},
});

export function CopyFormatProvider({
  initialFormat,
  children,
}: {
  initialFormat: CopyFormat;
  children: React.ReactNode;
}) {
  const [format, setFormatState] = useState<CopyFormat>(initialFormat);

  const setFormat = useCallback((f: CopyFormat) => {
    setFormatState(f);
    setCopyFormatCookie(f);
  }, []);

  return (
    <CopyFormatContext.Provider value={{ format, setFormat }}>
      {children}
    </CopyFormatContext.Provider>
  );
}

export function useCopyFormat() {
  return useContext(CopyFormatContext);
}
