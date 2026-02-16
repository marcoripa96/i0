export type ToolErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "RATE_LIMIT"
  | "INVALID_PARAMS"
  | "NOT_FOUND"
  | "INTERNAL";

type ToolError = {
  code: ToolErrorCode;
  message: string;
  retryable: boolean;
  hint?: string;
  details?: Record<string, unknown>;
};

type ToolSuccess<T> = {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
};

type ToolFailure = {
  ok: false;
  error: ToolError;
};

function serialize(payload: ToolSuccess<unknown> | ToolFailure): string {
  return JSON.stringify(payload, null, 2);
}

export function success<T>(
  data: T,
  meta?: Record<string, unknown>,
) {
  const payload: ToolSuccess<T> = meta
    ? { ok: true, data, meta }
    : { ok: true, data };

  return {
    content: [{ type: "text" as const, text: serialize(payload) }],
    structuredContent: payload,
  };
}

export function failure({
  code,
  message,
  retryable = false,
  hint,
  details,
}: {
  code: ToolErrorCode;
  message: string;
  retryable?: boolean;
  hint?: string;
  details?: Record<string, unknown>;
}) {
  const payload: ToolFailure = {
    ok: false,
    error: {
      code,
      message,
      retryable,
      ...(hint ? { hint } : {}),
      ...(details ? { details } : {}),
    },
  };

  return {
    content: [{ type: "text" as const, text: serialize(payload) }],
    structuredContent: payload,
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
