import { sql } from "drizzle-orm";
import { type ToolMetadata } from "xmcp";
import { db } from "../lib/db/connection";

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
  collections: number;
  totalIcons: number;
};

export default async function listLicenses() {
  const rows = await db.all<LicenseRow>(sql`
    SELECT
      json_extract(c.license, '$.title') AS title,
      json_extract(c.license, '$.spdx') AS spdx,
      COUNT(*) AS collections,
      SUM(c.total) AS totalIcons
    FROM collections c
    WHERE c.license IS NOT NULL
    GROUP BY json_extract(c.license, '$.title')
    ORDER BY totalIcons DESC
  `);

  const data = {
    total: rows.length,
    licenses: rows,
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}
