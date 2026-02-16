"use client";

import dynamic from "next/dynamic";

export const LazySignature = dynamic(
  () => import("./signature").then((m) => m.Signature),
  { ssr: false },
);
