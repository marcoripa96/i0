/**
 * Tool results are plain text.
 *
 * Deliberately NOT returning `structuredContent`: none of these tools declare an
 * `outputSchema`, so a structured copy buys no validation and would repeat the
 * entire payload in every response — the client pays for both halves. Text-only
 * roughly halves the token cost of every call.
 */

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export type ToolErrorCode =
  | "AUTH_INVALID"
  | "RATE_LIMIT"
  | "INVALID_PARAMS"
  | "NOT_FOUND"
  | "INTERNAL";

export function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

/**
 * `CODE: message` — keeps the code machine-detectable for the retry rules in the
 * prompts at a cost of about two tokens.
 */
export function fail(code: ToolErrorCode, message: string): ToolResult {
  return {
    content: [{ type: "text", text: `${code}: ${message}` }],
    isError: true,
  };
}

export function parseJsonSafe<T>(value: string | null | undefined): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/** Tab-separated rows: one token per separator, and trivially parseable. */
export function table(header: string[], rows: (string | number | null)[][]): string {
  return [header, ...rows]
    .map((cells) => cells.map((c) => (c == null ? "" : String(c))).join("\t"))
    .join("\n");
}
