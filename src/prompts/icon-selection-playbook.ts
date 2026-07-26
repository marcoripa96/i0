import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const BODY = `Selecting icons from the icons0 MCP server.

## Loop

1. Call \`search-icons\` with a plain-language query: \`{ query: "calendar check" }\`.
2. Narrow only when the first page is weak — \`collection\` to match an existing
   style, \`license\` for legal constraints, \`category\` for domain grouping.
3. Page only when results are weak, using the offset from the tool's trailing
   "More available" line.
4. Compare finalists in one \`get-icon\` call, passing an array of ids.
5. Choose on style fit with the icons already in the project: stroke vs fill,
   stroke width, linecap/linejoin, visual weight, viewBox.

## Errors

\`INVALID_PARAMS\` repair and retry once · \`NOT_FOUND\` broaden or drop filters ·
\`RATE_LIMIT\` stop and report the reset · \`INTERNAL\` retry once, then summarise.

## Output

Name one winner and at most two alternatives, each by exact id. State any style
or license tradeoff. Do not dump the candidate list.`;

export function registerIconSelectionPlaybook(server: McpServer) {
  server.registerPrompt(
    "icon-selection-playbook",
    {
      title: "Icon Selection Playbook",
      description: "Fast decision loop for finding the best icon candidates",
    },
    () => ({
      messages: [{ role: "user", content: { type: "text", text: BODY } }],
    }),
  );
}
