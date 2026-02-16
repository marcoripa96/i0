import { createHash, randomBytes } from "crypto";

const TOKEN_NAMESPACE = "i0";
const TOKEN_PREFIX_BYTES = 6;
const TOKEN_SECRET_BYTES = 24;

function tokenSecret(): string {
  const secret =
    process.env.API_TOKEN_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error(
      "Missing API token secret. Set API_TOKEN_SECRET (or BETTER_AUTH_SECRET/AUTH_SECRET).",
    );
  }

  return secret;
}

export function hashApiToken(token: string): string {
  return createHash("sha256")
    .update(`${tokenSecret()}:${token}`)
    .digest("hex");
}

export function createApiTokenMaterial(): {
  token: string;
  tokenPrefix: string;
  tokenHash: string;
} {
  const tokenPrefix = randomBytes(TOKEN_PREFIX_BYTES).toString("hex");
  const tokenSecretPart = randomBytes(TOKEN_SECRET_BYTES).toString("base64url");
  const token = `${TOKEN_NAMESPACE}_${tokenPrefix}_${tokenSecretPart}`;

  return {
    token,
    tokenPrefix,
    tokenHash: hashApiToken(token),
  };
}

export function parseTokenPrefix(token: string): string | null {
  const [namespace, prefix] = token.split("_");

  if (namespace !== TOKEN_NAMESPACE || !prefix) {
    return null;
  }

  return /^[a-f0-9]{12}$/.test(prefix) ? prefix : null;
}
