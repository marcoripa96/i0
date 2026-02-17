import { NextRequest, NextResponse } from "next/server";
import { getCollectionsPaginated } from "@/lib/icons/queries";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const license = searchParams.get("license") ?? "";
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = 48;

    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        { error: "Invalid offset parameter" },
        { status: 400 },
      );
    }

    const data = await getCollectionsPaginated(
      limit,
      offset,
      license || undefined,
    );

    return NextResponse.json({
      results: data.results.map((c) => ({
        prefix: c.prefix,
        name: c.name,
        total: c.total,
        sampleIcons: c.sampleIcons,
      })),
      hasMore: data.hasMore,
    });
  } catch (error) {
    console.error("[api/collections] Request failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch collections" },
      { status: 500 },
    );
  }
}
