import { sql } from "drizzle-orm";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "../lib/db/connection";
import { fail, ok, table } from "../lib/mcp/response";

type LicenseRow = {
  title: string;
  spdx: string | null;
  collections: number | string;
  totalIcons: number | string;
};

export function registerListLicenses(server: McpServer) {
  server.registerTool(
    "list-licenses",
    {
      title: "List Licenses",
      description:
        "Discover license titles for filtering search-icons, when a project has licensing constraints. Returns TSV.",
      inputSchema: {},
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async () => {
      try {
        const rows = await db.execute<LicenseRow>(sql`
          SELECT
            (c.license::jsonb)->>'title' AS title,
            (c.license::jsonb)->>'spdx' AS spdx,
            COUNT(*) AS collections,
            SUM(c.total) AS "totalIcons"
          FROM collections c
          WHERE c.license IS NOT NULL
          GROUP BY (c.license::jsonb)->>'title', (c.license::jsonb)->>'spdx'
          ORDER BY "totalIcons" DESC
        `);

        return ok(
          table(
            ["license", "spdx", "collections", "icons"],
            (rows as LicenseRow[]).map((r) => [r.title, r.spdx, Number(r.collections), Number(r.totalIcons)]),
          ),
        );
      } catch {
        return fail("INTERNAL", "Could not list licenses. Retry once.");
      }
    },
  );
}
