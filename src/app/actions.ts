"use server";

import { cookies } from "next/headers";
import { getIconByFullName } from "@/lib/icons/queries";
import { renderIconSvg } from "@/lib/icons/svg";
import { svgToReactComponent } from "@/lib/icons/react";

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

export async function getIconCode(
  fullName: string,
  format: "svg" | "react" | "shadcn"
): Promise<string | null> {
  if (format === "shadcn") {
    return `npx shadcn add @icons0/${fullName}`;
  }

  const icon = await getIconByFullName(fullName);
  if (!icon) return null;

  const { svg } = renderIconSvg(
    { body: icon.body, width: icon.width, height: icon.height },
    24
  );

  if (format === "svg") return svg;
  return svgToReactComponent(svg, fullName);
}
