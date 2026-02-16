import { xmcpHandler, withAuth, type VerifyToken } from "@xmcp/adapter";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/connection";
import { apiToken } from "@/lib/db/schema";
import { hashApiToken, parseTokenPrefix } from "@/lib/security/api-token";

function parseScopes(scopes: string): string[] {
  try {
    const parsed = JSON.parse(scopes);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

const verifyToken: VerifyToken = async (_req, bearerToken) => {
  if (!bearerToken) return undefined;

  const tokenPrefix = parseTokenPrefix(bearerToken);
  if (!tokenPrefix) return undefined;

  const [result] = await db
    .select({
      id: apiToken.id,
      userId: apiToken.userId,
      tokenHash: apiToken.tokenHash,
      scopes: apiToken.scopes,
    })
    .from(apiToken)
    .where(and(eq(apiToken.tokenPrefix, tokenPrefix), isNull(apiToken.revokedAt)))
    .limit(1);

  if (!result) return undefined;

  if (result.tokenHash !== hashApiToken(bearerToken)) {
    return undefined;
  }

  try {
    await db
      .update(apiToken)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiToken.id, result.id));
  } catch {
    // Best-effort audit field update
  }

  const scopes = parseScopes(result.scopes);

  return {
    token: bearerToken,
    clientId: result.userId,
    scopes,
    extra: { userId: result.userId, tokenId: result.id },
  };
};

const handler = withAuth(xmcpHandler, {
  verifyToken,
  required: true,
  requiredScopes: ["icons:read"],
});

export { handler as GET, handler as POST };
