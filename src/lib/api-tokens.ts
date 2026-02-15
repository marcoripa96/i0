"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/connection";
import { apiToken } from "@/lib/db/schema";

function generateId() {
  return randomBytes(16).toString("hex");
}

function generateToken() {
  return `i0_${randomBytes(24).toString("base64url")}`;
}

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session.user;
}

export async function createApiToken(name: string) {
  const user = await requireUser();
  const token = generateToken();

  await db.insert(apiToken).values({
    id: generateId(),
    name,
    token,
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
      createdAt: apiToken.createdAt,
    })
    .from(apiToken)
    .where(eq(apiToken.userId, user.id));
}

export async function deleteApiToken(id: string) {
  const user = await requireUser();
  await db
    .delete(apiToken)
    .where(eq(apiToken.id, id));
}
