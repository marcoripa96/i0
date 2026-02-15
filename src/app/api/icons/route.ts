import { NextRequest, NextResponse } from "next/server";
import { searchIconsWeb, browseIcons } from "@/lib/icons/queries";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") ?? "";
  const collection = searchParams.get("collection") ?? "";
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = 60;

  if (q) {
    const data = await searchIconsWeb(q, collection || undefined, limit, offset);
    return NextResponse.json({
      results: data.results.map((r) => ({
        fullName: r.fullName,
        name: r.name,
        prefix: r.prefix,
        collection: r.collection,
        body: r.body,
        width: r.width,
        height: r.height,
      })),
      hasMore: data.hasMore,
    });
  }

  if (collection) {
    const data = await browseIcons(collection, limit, offset);
    return NextResponse.json({
      results: data.results.map((r) => ({
        fullName: r.fullName,
        name: r.name,
        prefix: r.prefix,
        body: r.body,
        width: r.width,
        height: r.height,
      })),
      hasMore: data.hasMore,
    });
  }

  return NextResponse.json({ results: [], hasMore: false });
}
