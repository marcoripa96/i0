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
  const fileName = fullName.replace(":", "-");

  return NextResponse.json({
    name: fullName,
    type: "registry:ui",
    files: [
      {
        path: `icons/${fileName}.tsx`,
        type: "registry:file",
        target: `components/icons/${fileName}.tsx`,
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
    homepage: "https://i0-phi.vercel.app",
    items,
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: rawName } = await params;
  const name = rawName.replace(/\.json$/, "");

  if (name === "registry") {
    return handleRegistry();
  }

  if (name.includes(":")) {
    return handleSingleIcon(name);
  }

  return handleCollection(name);
}
