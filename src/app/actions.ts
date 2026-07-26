"use server";

import { cookies } from "next/headers";

export async function setTheme(theme: "dark" | "light") {
  const cookieStore = await cookies();
  cookieStore.set("theme", theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

export async function setCopyFormat(format: "svg" | "react" | "shadcn") {
  const cookieStore = await cookies();
  cookieStore.set("copyFormat", format, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
