import { z } from "zod";
import { eq } from "drizzle-orm";
import { type ToolMetadata, type InferSchema } from "xmcp";
import { db } from "../lib/db/connection";
import { icons, collections } from "../lib/db/schema";
import { renderIconSvg } from "../lib/icons/svg";
import { svgToReactComponent } from "../lib/icons/react";
import { failure, parseJsonSafe, success } from "../lib/mcp/response";

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

type ResolvedIconError = {
  fullName: string;
  code: "INVALID_PARAMS" | "NOT_FOUND";
  message: string;
  hint: string;
};

type ResolvedIconSuccess = {
  fullName: string;
  collection: string;
  category: string | null;
  license: Record<string, unknown> | null;
  icon: string;
  width: number;
  height: number;
};

type ResolvedIconResult = ResolvedIconSuccess | ResolvedIconError;

async function resolveIcon(
  fullName: string,
  outputFormat: "svg" | "react",
  size: number | undefined,
): Promise<ResolvedIconResult> {
  const normalizedFullName = fullName.trim();
  const colonIdx = fullName.indexOf(":");
  if (colonIdx === -1) {
    return {
      fullName: normalizedFullName,
      code: "INVALID_PARAMS" as const,
      message: `Invalid format "${normalizedFullName}". Expected "prefix:name" (e.g. "mdi:home").`,
      hint: "Use search-icons to retrieve valid fullName values.",
    };
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
    .where(eq(icons.fullName, normalizedFullName))
    .limit(1);

  if (!row) {
    return {
      fullName: normalizedFullName,
      code: "NOT_FOUND" as const,
      message: `Icon "${normalizedFullName}" not found.`,
      hint: "Use search-icons to find valid icon names.",
    };
  }

  const rendered = renderIconSvg(
    { body: row.body, width: row.width ?? 24, height: row.height ?? 24 },
    size,
  );

  const icon = outputFormat === "react"
    ? svgToReactComponent(rendered.svg, normalizedFullName)
    : rendered.svg;

  return {
    fullName: normalizedFullName,
    collection: row.collectionName,
    category: row.category,
    license: parseJsonSafe<Record<string, unknown>>(row.license),
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
  try {
    const outputFormat = format ?? "svg";
    const names = (Array.isArray(name) ? name : [name]).map((n) => n.trim()).filter(Boolean);

    if (names.length === 0) {
      return failure({
        code: "INVALID_PARAMS",
        message: "No icon names provided.",
        hint: "Pass a name in prefix:name format, for example 'lucide:house'.",
      });
    }

    const results = await Promise.all(names.map((n) => resolveIcon(n, outputFormat, size)));

    if (!Array.isArray(name)) {
      const result = results[0];
      if ("code" in result) {
        return failure({
          code: result.code,
          message: result.message,
          hint: result.hint,
        });
      }

      return success(result);
    }

    const succeeded = results.filter((r) => !("code" in r));
    const failed = results
      .filter((r) => "code" in r)
      .map((r) => ({
        fullName: r.fullName,
        code: r.code,
        message: r.message,
        hint: r.hint,
      }));

    if (succeeded.length === 0) {
      return failure({
        code: "NOT_FOUND",
        message: "No requested icons were found.",
        hint: "Use search-icons to discover valid icon names.",
        details: { failed },
      });
    }

    return success({
      icons: succeeded,
      failed,
      successCount: succeeded.length,
      failureCount: failed.length,
    });
  } catch {
    return failure({
      code: "INTERNAL",
      message: "Failed to retrieve icon data.",
      retryable: true,
      hint: "Retry the request. If the issue persists, check database connectivity.",
    });
  }
}
