import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/connection";
import { apiToken } from "@/lib/db/schema";
import { hashApiToken, parseTokenPrefix } from "@/lib/security/api-token";
import { registerSearchIcons } from "@/tools/search-icons";
import { registerGetIcon } from "@/tools/get-icon";
import { registerListCollections } from "@/tools/list-collections";
import { registerListLicenses } from "@/tools/list-licenses";
import { registerIconSelectionPlaybook } from "@/prompts/icon-selection-playbook";
import { registerIconIntegrationPlaybook } from "@/prompts/icon-integration-playbook";

function parseScopes(scopes: string): string[] {
  try {
    const parsed = JSON.parse(scopes);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

async function verifyToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const tokenPrefix = parseTokenPrefix(bearerToken);
  if (!tokenPrefix) return undefined;

  const [row] = await db
    .select({
      id: apiToken.id,
      userId: apiToken.userId,
      tokenHash: apiToken.tokenHash,
      scopes: apiToken.scopes,
    })
    .from(apiToken)
    .where(and(eq(apiToken.tokenPrefix, tokenPrefix), isNull(apiToken.revokedAt)))
    .limit(1);

  if (!row || row.tokenHash !== hashApiToken(bearerToken)) return undefined;

  try {
    await db.update(apiToken).set({ lastUsedAt: new Date() }).where(eq(apiToken.id, row.id));
  } catch {
    // Best-effort audit field update
  }

  return {
    token: bearerToken,
    clientId: row.userId,
    scopes: parseScopes(row.scopes),
    // search-icons reads userId from here to apply the daily rate limit.
    extra: { userId: row.userId, tokenId: row.id },
  };
}

const mcpHandler = createMcpHandler(
  (server) => {
    registerSearchIcons(server);
    registerGetIcon(server);
    registerListCollections(server);
    registerListLicenses(server);
    registerIconSelectionPlaybook(server);
    registerIconIntegrationPlaybook(server);
  },
  // Without this the server introduces itself as mcp-handler's placeholder,
  // "mcp-typescript server on vercel".
  { serverInfo: { name: "icons0", version: "0.1.0" } },
  {
    // basePath "" resolves the streamable HTTP endpoint to "/mcp", which is this
    // route's own path — the published URL clients are already configured with.
    basePath: "",
    // SSE is the only transport that needs Redis, and it is unreachable from a
    // route mounted at /mcp anyway.
    disableSse: true,
  },
);

const handler = withMcpAuth(mcpHandler, verifyToken, {
  required: true,
  requiredScopes: ["icons:read"],
});

export { handler as GET, handler as POST };
