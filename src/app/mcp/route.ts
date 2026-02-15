import { xmcpHandler, withAuth, type VerifyToken } from "@xmcp/adapter";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/connection";
import { apiToken } from "@/lib/db/schema";

const verifyToken: VerifyToken = async (_req, bearerToken) => {
  if (!bearerToken) return undefined;

  const result = await db
    .select({ userId: apiToken.userId })
    .from(apiToken)
    .where(eq(apiToken.token, bearerToken))
    .get();

  if (!result) return undefined;

  return {
    token: bearerToken,
    clientId: result.userId,
    extra: { userId: result.userId },
  };
};

const handler = withAuth(xmcpHandler, {
  verifyToken,
  required: true,
});

export { handler as GET, handler as POST };
