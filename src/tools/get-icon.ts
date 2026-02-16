import { z } from "zod";
import { eq } from "drizzle-orm";
import { type ToolMetadata, type InferSchema } from "xmcp";
import { db } from "../lib/db/connection";
import { icons, collections } from "../lib/db/schema";
import { renderIconSvg } from "../lib/icons/svg";
import { svgToReactComponent } from "../lib/icons/react";

export const schema = {
  name: z.union([
    z.string(),
    z.array(z.string()).max(20),
  ]).describe(
    'Icon name(s) in "prefix:name" format. Pass a single string like "mdi:home" or an array ' +
    'like ["mdi:home", "lucide:arrow-right"] for batch retrieval (max 20).'
  ),
  format: z.enum(["svg", "react"]).default("svg").optional().describe(
    'Output format. "svg" returns raw SVG markup ready to embed. ' +
    '"react" returns a complete ES module with a typed React component and props spread.'
  ),
  size: z.number().min(1).max(512).optional().describe(
    "Override icon size in pixels (default varies by collection, typically 24). Range: 1-512."
  ),
};

export const metadata: ToolMetadata = {
  name: "get-icon",
  description:
    "Retrieve icon(s) as SVG or React components. Accepts a single name or array of names from search-icons results. " +
    "Returns full SVG markup, dimensions, collection info, and license for attribution.",
  annotations: {
    title: "Get Icon",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
};

async function resolveIcon(
  fullName: string,
  outputFormat: "svg" | "react",
  size: number | undefined,
) {
  const colonIdx = fullName.indexOf(":");
  if (colonIdx === -1) {
    return { fullName, error: `Invalid format "${fullName}". Expected "prefix:name" (e.g. "mdi:home").` };
  }

  const [row] = await db
    .select({
      body: icons.body,
      width: icons.width,
      height: icons.height,
      category: icons.category,
      collectionName: collections.name,
      license: collections.license,
    })
    .from(icons)
    .innerJoin(collections, eq(icons.prefix, collections.prefix))
    .where(eq(icons.fullName, fullName))
    .limit(1);

  if (!row) {
    return { fullName, error: `Icon "${fullName}" not found. Use search-icons to find valid names.` };
  }

  const rendered = renderIconSvg(
    { body: row.body, width: row.width ?? 24, height: row.height ?? 24 },
    size,
  );

  const icon = outputFormat === "react"
    ? svgToReactComponent(rendered.svg, fullName)
    : rendered.svg;

  return {
    fullName,
    collection: row.collectionName,
    category: row.category,
    license: row.license ? JSON.parse(row.license) : null,
    icon,
    width: rendered.width,
    height: rendered.height,
  };
}

export default async function getIcon({
  name,
  format,
  size,
}: InferSchema<typeof schema>) {
  const outputFormat = format ?? "svg";
  const names = Array.isArray(name) ? name : [name];

  if (names.length === 0) {
    return {
      content: [{ type: "text" as const, text: "No icon names provided." }],
      isError: true,
    };
  }

  const results = await Promise.all(names.map((n) => resolveIcon(n, outputFormat, size)));

  // Single icon: return flat result
  if (!Array.isArray(name)) {
    const result = results[0];
    if ("error" in result) {
      return {
        content: [{ type: "text" as const, text: result.error as string }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  }

  // Batch: separate successes and failures
  const succeeded = results.filter((r) => !("error" in r));
  const failed = results.filter((r) => "error" in r);

  const data = {
    icons: succeeded,
    failed: failed.map((r) => ({ fullName: r.fullName, error: (r as { error: string }).error })),
    successCount: succeeded.length,
    failureCount: failed.length,
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
    ...(failed.length > 0 && succeeded.length === 0 ? { isError: true } : {}),
  };
}
