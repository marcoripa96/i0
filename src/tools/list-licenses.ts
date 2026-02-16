import { sql } from "drizzle-orm";
import { type ToolMetadata } from "xmcp";
import { db } from "../lib/db/connection";
import { failure, success } from "../lib/mcp/response";

export const schema = {};

export const metadata: ToolMetadata = {
  name: "list-licenses",
  description:
    "List all unique licenses across icon collections. " +
    "Use this to discover available license titles for filtering search-icons by license.",
  annotations: {
    title: "List Licenses",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
};

type LicenseRow = {
  title: string;
  spdx: string | null;
  collections: number | string;
  totalIcons: number | string;
};

export default async function listLicenses() {
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

    const licenses = (rows as LicenseRow[]).map((row) => ({
      title: row.title,
      spdx: row.spdx,
      collections: Number(row.collections),
      totalIcons: Number(row.totalIcons),
    }));

    return success({
      total: licenses.length,
      licenses,
    });
  } catch {
    return failure({
      code: "INTERNAL",
      message: "Failed to list licenses.",
      retryable: true,
      hint: "Retry the request. If the issue persists, check database connectivity.",
    });
  }
}
