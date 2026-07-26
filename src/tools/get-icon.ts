import { z } from "zod";
import { eq } from "drizzle-orm";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../lib/db/connection";
import { icons, collections } from "../lib/db/schema";
import { renderIconSvg } from "../lib/icons/svg";
import { svgToReactComponent } from "../lib/icons/react";
import { fail, ok, parseJsonSafe } from "../lib/mcp/response";

const MAX_BATCH = 20;

type Resolved = { fullName: string; header: string; code: string } | { fullName: string; error: string };

async function resolveIcon(
  fullName: string,
  format: "svg" | "react",
  size: number | undefined,
): Promise<Resolved> {
  const id = fullName.trim();
  if (!id.includes(":")) {
    return { fullName: id, error: `not "prefix:name" format` };
  }

  const [row] = await db
    .select({
      body: icons.body,
      width: icons.width,
      height: icons.height,
      collectionName: collections.name,
      license: collections.license,
    })
    .from(icons)
    .innerJoin(collections, eq(icons.prefix, collections.prefix))
    .where(eq(icons.fullName, id))
    .limit(1);

  if (!row) return { fullName: id, error: "not found" };

  const rendered = renderIconSvg(
    { body: row.body, width: row.width ?? 24, height: row.height ?? 24 },
    size,
  );
  const license = parseJsonSafe<{ title?: string }>(row.license)?.title;

  return {
    fullName: id,
    // License travels with the icon because attribution is decided at use time.
    header: [id, row.collectionName, license].filter(Boolean).join(" · "),
    code: format === "react" ? svgToReactComponent(rendered.svg, id) : rendered.svg,
  };
}

export function registerGetIcon(server: McpServer) {
  server.registerTool(
    "get-icon",
    {
      title: "Get Icon",
      description:
        "Fetch icons by `prefix:name` id as SVG markup or a typed React component. " +
        `Pass an array to fetch up to ${MAX_BATCH} at once. Includes the collection and license for attribution.`,
      inputSchema: {
        name: z
          .union([z.string(), z.array(z.string()).max(MAX_BATCH)])
          .describe(`One id like "mdi:home", or an array of up to ${MAX_BATCH}.`),
        format: z.enum(["svg", "react"]).default("svg"),
        size: z.number().min(1).max(512).optional().describe("Pixel size. Defaults to the icon's own."),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ name, format, size }) => {
      try {
        const ids = (Array.isArray(name) ? name : [name]).map((n) => n.trim()).filter(Boolean);
        if (ids.length === 0) {
          return fail("INVALID_PARAMS", 'No ids given. Pass something like "lucide:house".');
        }

        const results = await Promise.all(ids.map((id) => resolveIcon(id, format, size)));
        const found = results.filter((r): r is Extract<Resolved, { code: string }> => "code" in r);
        const missing = results.filter((r): r is Extract<Resolved, { error: string }> => "error" in r);

        if (found.length === 0) {
          const detail = missing.map((m) => `${m.fullName} (${m.error})`).join(", ");
          return fail("NOT_FOUND", `${detail}. Use search-icons for valid ids.`);
        }

        const blocks = found.map((r) => `${r.header}\n${r.code}`);
        if (missing.length > 0) {
          blocks.push(`Failed: ${missing.map((m) => `${m.fullName} (${m.error})`).join(", ")}`);
        }

        return ok(blocks.join("\n\n"));
      } catch {
        return fail("INTERNAL", "Icon fetch failed. Retry once.");
      }
    },
  );
}
