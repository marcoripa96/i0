"use server";

import { getIconByFullName } from "@/lib/icons/queries";
import { renderIconSvg } from "@/lib/icons/svg";
import { svgToReactComponent } from "@/lib/icons/react";

export async function getIconCode(
  fullName: string,
  format: "svg" | "react"
): Promise<string | null> {
  const icon = await getIconByFullName(fullName);
  if (!icon) return null;

  const { svg } = renderIconSvg(
    { body: icon.body, width: icon.width, height: icon.height },
    24
  );

  if (format === "svg") return svg;
  return svgToReactComponent(svg, fullName);
}
