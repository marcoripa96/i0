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
      clientName: apiToken.clientName,
      clientVersion: apiToken.clientVersion,
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
    // search-icons reads userId from here to apply the daily rate limit, and
    // the tools read the client to attribute usage on /stats. The client comes
    // along on this select rather than a lookup of its own — the row is already
    // being read to authenticate.
    extra: {
      userId: row.userId,
      tokenId: row.id,
      client: row.clientName ?? undefined,
      clientVersion: row.clientVersion ?? undefined,
    },
  };
}

type InitializeBody = {
  method?: string;
  params?: { clientInfo?: { name?: string; version?: string } };
};

/**
 * Remember who is calling.
 *
 * MCP clients introduce themselves once, in `initialize`. `mcp-handler` builds
 * a fresh `McpServer` per POST and passes no `sessionIdGenerator`, so the
 * server that handles a tool call is not the one that was introduced to —
 * `getClientVersion()` there is always undefined. The token row is the only
 * thing spanning both requests, so the identity is parked on it.
 *
 * Best-effort throughout: an unidentified client still gets served.
 */
async function captureClientInfo(req: Request, bearerToken: string | undefined) {
  if (!bearerToken) return;

  try {
    // Clone first — the body is a one-shot stream and the handler needs it.
    const body = (await req.clone().json()) as InitializeBody | InitializeBody[];
    const messages = Array.isArray(body) ? body : [body];
    const init = messages.find((m) => m?.method === "initialize");
    const info = init?.params?.clientInfo;
    if (!info?.name) return;

    const tokenPrefix = parseTokenPrefix(bearerToken);
    if (!tokenPrefix) return;

    await db
      .update(apiToken)
      .set({
        clientName: info.name.slice(0, 100),
        clientVersion: info.version?.slice(0, 50) ?? null,
        clientSeenAt: new Date(),
      })
      .where(
        and(
          eq(apiToken.tokenPrefix, tokenPrefix),
          eq(apiToken.tokenHash, hashApiToken(bearerToken)),
          isNull(apiToken.revokedAt),
        ),
      );
  } catch {
    // Malformed body, or the update lost a race. Either way, not our problem.
  }
}

function bearerFrom(req: Request): string | undefined {
  const header = req.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return undefined;
  return header.slice(7).trim() || undefined;
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

const authedHandler = withMcpAuth(mcpHandler, verifyToken, {
  required: true,
  requiredScopes: ["icons:read"],
});

async function handler(req: Request) {
  if (req.method === "POST") {
    // Awaited so the identity is committed before the initialize response
    // goes out — the client's first tool call follows immediately after it.
    await captureClientInfo(req, bearerFrom(req));
  }
  return authedHandler(req);
}

export { handler as GET, handler as POST };
