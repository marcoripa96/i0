import { NextRequest, NextResponse } from "next/server";
import {
  getIconByFullName,
  browseIcons,
  getCollections,
} from "@/lib/icons/queries";
import { renderIconSvg } from "@/lib/icons/svg";
import { svgToReactComponent } from "@/lib/icons/react";

function makeIconContent(
  fullName: string,
  icon: { body: string; width: number; height: number }
): string {
  const { svg } = renderIconSvg(icon);
  const component = svgToReactComponent(svg, fullName);
  return `import type { SVGProps } from "react";\n\n${component}\n`;
}

function extractComponentName(content: string): string {
  const match = content.match(/export function (\w+)/);
  return match![1];
}

async function handleSingleIcon(fullName: string) {
  const icon = await getIconByFullName(fullName);
  if (!icon) {
    return NextResponse.json({ error: "Icon not found" }, { status: 404 });
  }

  const content = makeIconContent(fullName, icon);
  const slashName = fullName.replace(":", "/");

  return NextResponse.json({
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: slashName,
    type: "registry:ui",
    files: [
      {
        path: `icons/${slashName}.tsx`,
        type: "registry:file",
        target: `components/icons/${slashName}.tsx`,
        content,
      },
    ],
  });
}

async function handleCollection(prefix: string) {
  const { results, collection } = await browseIcons(
    prefix,
    undefined,
    100000,
    0
  );

  if (!collection) {
    return NextResponse.json(
      { error: "Collection not found" },
      { status: 404 }
    );
  }

  const files: { path: string; type: string; content: string; target: string }[] = [];
  const exports: { componentName: string; fileName: string }[] = [];

  for (const icon of results) {
    const content = makeIconContent(icon.fullName, icon);
    const componentName = extractComponentName(content);

    files.push({
      path: `icons/${prefix}/${icon.name}.tsx`,
      type: "registry:file",
      target: `components/icons/${prefix}/${icon.name}.tsx`,
      content,
    });

    exports.push({ componentName, fileName: icon.name });
  }

  const barrelContent = exports
    .map((e) => `export { ${e.componentName} } from "./${e.fileName}";`)
    .join("\n");

  files.push({
    path: `icons/${prefix}/index.tsx`,
    type: "registry:file",
    target: `components/icons/${prefix}/index.tsx`,
    content: barrelContent + "\n",
  });

  return NextResponse.json({
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: prefix,
    type: "registry:ui",
    files,
  });
}

async function handleRegistry() {
  const allCollections = await getCollections();

  const items = allCollections.map((c) => ({
    name: c.prefix,
    type: "registry:ui",
    title: c.name,
    description: `${c.total} icons from ${c.name}${c.license ? ` (${c.license.title})` : ""}`,
  }));

  return NextResponse.json({
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: "icons0",
    homepage: "https://icons0.dev",
    items,
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string[] }> }
) {
  const { name: segments } = await params;

  // Strip .json from the last segment
  const last = segments[segments.length - 1].replace(/\.json$/, "");
  const parts = [...segments.slice(0, -1), last];

  if (parts.length === 1) {
    const name = parts[0];

    if (name === "registry") {
      return handleRegistry();
    }

    // Backward compat: "lucide:arrow-right"
    if (name.includes(":")) {
      return handleSingleIcon(name);
    }

    return handleCollection(name);
  }

  if (parts.length === 2) {
    // New format: ["lucide", "arrow-right"] → "lucide:arrow-right"
    const fullName = `${parts[0]}:${parts[1]}`;
    return handleSingleIcon(fullName);
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
