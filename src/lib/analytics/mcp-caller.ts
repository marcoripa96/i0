/**
 * Who is on the other end of an MCP tool call.
 *
 * The name comes from the client's own `initialize` (parked on the token row
 * by the /mcp route). When a client sends no `clientInfo`, the request's
 * User-Agent is the fallback — the SDK's web transport passes `requestInfo`
 * through to tool handlers, so the header is readable here.
 */
export type McpCaller = {
  userId?: string;
  client?: string;
  clientVersion?: string;
};

type ToolExtra = {
  authInfo?: { extra?: Record<string, unknown> };
  requestInfo?: { headers?: Record<string, string | string[] | undefined> };
};

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function userAgent(extra: ToolExtra): string | undefined {
  const raw = extra.requestInfo?.headers?.["user-agent"];
  const ua = Array.isArray(raw) ? raw[0] : raw;
  // "claude-code/1.2.3 (…)" — the product token is the identifying part.
  return ua?.split(/[\s/]/)[0] || undefined;
}

export function mcpCaller(extra: ToolExtra): McpCaller {
  const auth = extra.authInfo?.extra ?? {};

  return {
    userId: str(auth.userId),
    client: str(auth.client) ?? userAgent(extra),
    clientVersion: str(auth.clientVersion),
  };
}
