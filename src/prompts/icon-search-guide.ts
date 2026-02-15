import { type PromptMetadata } from "xmcp";

export const metadata: PromptMetadata = {
  name: "icon-search-guide",
  title: "Icon Search Guide",
  description: "How to effectively search and use icons from this server",
  role: "user",
};

export default function iconSearchGuide() {
  return `You have access to an icon search MCP server with 200k+ icons from 150+ open-source icon sets.

## Workflow

1. **Discover collections** — Use \`list-collections\` to browse available icon sets. Popular ones:
   - \`lucide\` — Clean, consistent line icons (great for modern UIs)
   - \`mdi\` — Material Design Icons (large set, Google-style)
   - \`tabler\` — Tabler Icons (outline style, 4800+ icons)
   - \`heroicons\` — Heroicons by Tailwind (outline + solid)
   - \`ph\` — Phosphor Icons (6 weights per icon)
   - \`ri\` — Remix Icons (line + fill variants)

   The response includes \`samples\` — icon names you can pass directly to \`get-icon\` to preview a collection's visual style.

2. **Search for icons** — Use \`search-icons\` with natural language:
   - Broad: \`{ query: "home" }\` — finds all home icons across sets
   - Filtered: \`{ query: "home", collection: "lucide" }\` — just Lucide results
   - By category: \`{ query: "arrow", category: "Navigation" }\` — category-filtered
   - Browse: \`{ collection: "lucide" }\` — list all icons in a collection (no query needed)
   - Paginate: when \`hasMore\` is true, pass the \`nextOffset\` value as \`offset\` in the next call

3. **Get the icon** — Use \`get-icon\` with the \`fullName\` from search results:
   - SVG: \`{ name: "lucide:home" }\` — raw SVG markup ready to embed
   - React: \`{ name: "lucide:home", format: "react" }\` — complete ES module:
     \`\`\`tsx
     import type { SVGProps } from "react";
     export function LucideHome(props: SVGProps<SVGSVGElement>) {
       return (<svg {...props} viewBox="0 0 24 24">...</svg>);
     }
     export default LucideHome;
     \`\`\`
   - Batch: \`{ name: ["lucide:home", "lucide:settings", "lucide:user"] }\` — up to 20 at once
   - Custom size: \`{ name: "lucide:home", size: 32 }\` — override dimensions (1-512px)

## Finding the best icon

Not every collection has every concept. When the user's preferred collection doesn't have a good match:

1. **Search broadly first** — Drop the collection filter and search across all sets:
   \`{ query: "calendar check" }\`

2. **Pull SVGs from multiple candidates** — Batch-fetch the top matches from different collections:
   \`{ name: ["mdi:calendar-check", "tabler:calendar-check", "ph:calendar-check"] }\`

3. **Inspect the raw SVG** — Read the SVG markup to understand each icon's visual style:
   - **Stroke vs fill**: Does it use \`stroke="currentColor"\` (line icon) or \`fill="currentColor"\` (solid)?
   - **Stroke width**: A \`stroke-width="2"\` matches Lucide/Tabler; \`stroke-width="1.5"\` matches Phosphor.
   - **Corner style**: Look for \`stroke-linecap="round"\` and \`stroke-linejoin="round"\` — these should match the rest of the project's icons.
   - **Complexity**: Count the number of \`<path>\` elements. Simpler icons (1-3 paths) blend better with minimal sets.
   - **ViewBox size**: Most modern sets use \`viewBox="0 0 24 24"\`. Mixing viewBox sizes causes inconsistent sizing.

4. **Pick the closest match** — Choose the icon whose SVG structure most closely matches the user's primary collection. A Lucide project should use icons with round linecaps, stroke-width 2, and single-path simplicity — even if the icon comes from Tabler or Phosphor.

5. **Explain the choice** — Tell the user which collection the icon came from, why it was chosen over alternatives, and note any license differences.

## Installing icons via shadcn

Once you've found the right icon, install it directly into the user's project using shadcn. This creates a standalone React component file — no runtime icon library dependency needed.

1. **Ensure the registry is configured** — The user's \`components.json\` needs:
   \`\`\`json
   {
     "registries": {
       "@i0": "https://i0.dev/r/{name}.json"
     }
   }
   \`\`\`
   If not already configured, add it before installing.

2. **Install individual icons**:
   \`\`\`bash
   npx shadcn add @i0/lucide:home
   npx shadcn add @i0/lucide:home @i0/lucide:arrow-right
   \`\`\`
   Each icon becomes its own file under \`components/icons/\` (e.g. \`components/icons/lucide-home.tsx\`).

3. **Install an entire collection**:
   \`\`\`bash
   npx shadcn add @i0/lucide
   \`\`\`
   Creates all icon files under \`components/icons/lucide/\` plus a barrel \`index.tsx\` for convenient imports.

4. **Import the installed icon**:
   \`\`\`tsx
   import { LucideHome } from "@/components/icons/lucide-home";
   // or from a collection install:
   import { LucideHome } from "@/components/icons/lucide";
   \`\`\`

**Always prefer \`npx shadcn add\` over manually pasting SVG or React code.** It gives the user a proper component file they own, with no external dependency, and they can re-run the command to update icons later.

## Tips

- **Consistency matters**: Pick one collection and stick with it. Only cross-collection when absolutely needed.
- **Check the license**: All results include license info — most are MIT or Apache 2.0.
- **Batch when possible**: Pass an array to get-icon instead of calling it repeatedly (max 20 per call).
- **Try synonyms**: If "trash" returns nothing useful, try "delete", "bin", "remove".
- **Use tags**: Search results include \`tags\` showing why icons matched — use them to refine queries.`;
}
