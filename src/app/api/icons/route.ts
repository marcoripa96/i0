import { NextRequest, NextResponse } from "next/server";
import { searchIconsWeb, browseIcons, browseByCategory, browseAllIcons } from "@/lib/icons/queries";
import { CACHE_HEADERS } from "../cache";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q") ?? "";
    const collection = searchParams.get("collection") ?? "";
    const category = searchParams.get("category") ?? "";
    const license = searchParams.get("license") ?? "";
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = 48;

    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        { error: "Invalid offset parameter" },
        { status: 400 },
      );
    }

    if (q) {
      const data = await searchIconsWeb(
        q,
        collection || undefined,
        category || undefined,
        limit,
        offset,
        license || undefined,
      );
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
      }, { headers: CACHE_HEADERS });
    }

    if (collection) {
      const data = await browseIcons(
        collection,
        category || undefined,
        limit,
        offset,
        license || undefined,
      );
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
      }, { headers: CACHE_HEADERS });
    }

    if (category) {
      const data = await browseByCategory(category, limit, offset, license || undefined);
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
      }, { headers: CACHE_HEADERS });
    }

    // Browse all icons (scope=icons, no query/collection/category)
    const data = await browseAllIcons(limit, offset, license || undefined);
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
    }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("[api/icons] Request failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch icons" },
      { status: 500 },
    );
  }
}
