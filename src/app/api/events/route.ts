import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { recordEvents } from "@/lib/analytics/events";

// Icon ids are lowercase by construction; the loose tail covers names like
// "arrow-right", "1-circle" and "chevron.left".
const FULL_NAME = /^[a-z0-9-]{1,60}:[a-z0-9._-]{1,120}$/;
const FORMATS = new Set(["svg", "react", "shadcn"]);

type Body = { fullName?: unknown; format?: unknown };

/**
 * The copy button's beacon.
 *
 * Copying happens entirely in the browser so the clipboard write lands in the
 * same frame as the click — nothing on the server would otherwise ever learn
 * that a human picked an icon. This endpoint is that missing signal, and it is
 * deliberately the only thing it does: unauthenticated, no reply body, and it
 * accepts one event per call.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const fullName = typeof body.fullName === "string" ? body.fullName : "";
  if (!FULL_NAME.test(fullName)) {
    // Public and unauthenticated, so anything unrecognised is dropped rather
    // than stored — the shape of the id is the whole of the validation.
    return new NextResponse(null, { status: 204 });
  }

  const format =
    typeof body.format === "string" && FORMATS.has(body.format) ? body.format : null;

  // Attributed when the visitor happens to be signed in, anonymous otherwise.
  // Never a reason to fail the beacon.
  let userId: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    userId = session?.user.id ?? null;
  } catch {
    userId = null;
  }

  recordEvents([{ eventType: "copy", source: "web", fullName, format, userId }]);

  return new NextResponse(null, { status: 204 });
}
