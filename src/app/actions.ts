"use server";

import { cookies } from "next/headers";
import { parseCopyFormat, type CopyFormat } from "@/lib/icons/copy-format";

export async function setTheme(theme: "dark" | "light") {
  const cookieStore = await cookies();
  cookieStore.set("theme", theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

export async function setCopyFormat(format: CopyFormat) {
  const cookieStore = await cookies();
  // Re-narrowed rather than trusted: a server action is a public endpoint, and
  // the argument arrives over the wire regardless of the declared type.
  cookieStore.set("copyFormat", parseCopyFormat(format), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
