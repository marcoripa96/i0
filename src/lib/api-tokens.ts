"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/connection";
import { apiToken } from "@/lib/db/schema";
import { createApiTokenMaterial } from "@/lib/security/api-token";

function generateId() {
  return randomBytes(16).toString("hex");
}

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session.user;
}

export async function createApiToken(name: string) {
  const user = await requireUser();
  const { token, tokenPrefix, tokenHash } = createApiTokenMaterial();

  await db.insert(apiToken).values({
    id: generateId(),
    name,
    tokenPrefix,
    tokenHash,
    scopes: JSON.stringify(["icons:read"]),
    userId: user.id,
  });

  return token;
}

export async function listApiTokens() {
  const user = await requireUser();
  return db
    .select({
      id: apiToken.id,
      name: apiToken.name,
      scopes: apiToken.scopes,
      createdAt: apiToken.createdAt,
      lastUsedAt: apiToken.lastUsedAt,
      revokedAt: apiToken.revokedAt,
    })
    .from(apiToken)
    .where(and(eq(apiToken.userId, user.id), isNull(apiToken.revokedAt)));
}

export async function deleteApiToken(id: string) {
  const user = await requireUser();
  await db
    .update(apiToken)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiToken.id, id), eq(apiToken.userId, user.id), isNull(apiToken.revokedAt)));
}
