import { renderIconSvg } from "./svg";
import { svgToReactComponent } from "./react";

export type CopyFormat = "svg" | "react" | "shadcn";

/**
 * Builds the copyable code for an icon. Pure — no DB, no network — so the
 * browser can produce it from the `body`/`width`/`height` it already holds
 * instead of paying a server roundtrip on every copy.
 */
export function buildIconCode(
  fullName: string,
  icon: { body: string; width: number; height: number },
  format: CopyFormat,
): string {
  if (format === "shadcn") {
    return `npx shadcn@latest add @icons0/${fullName.replace(":", "/")}`;
  }

  const { svg } = renderIconSvg(icon, 24);
  return format === "svg" ? svg : svgToReactComponent(svg, fullName);
}
