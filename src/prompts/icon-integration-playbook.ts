import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const BODY = `Integrating already-chosen icons into the user's project.

## Format

- React + shadcn project → shadcn install command.
- Wants owned component source → \`get-icon\` with \`format: "react"\`.
- Non-React stack, design asset, or inline markup → \`format: "svg"\`.

## Calls

- \`get-icon\` takes one id or an array, so fetch a whole set in one call.
- shadcn path mapping: \`prefix:name\` becomes \`@icons0/prefix/name\`, installed with
  \`npx shadcn@latest add @icons0/<collection>/<name>\` — combine ids in one command
  where practical.

## Errors

\`NOT_FOUND\` re-run \`search-icons\` and offer corrected candidates ·
\`INVALID_PARAMS\` repair and retry once · \`INTERNAL\` retry once, then fall back to
SVG if the React conversion is what failed.

## Output

Copy-pasteable commands or code blocks, with target paths and imports where
relevant. Carry the license through when attribution matters. Keep it short.`;

export function registerIconIntegrationPlaybook(server: McpServer) {
  server.registerPrompt(
    "icon-integration-playbook",
    {
      title: "Icon Integration Playbook",
      description: "Turn selected icons into codebase-ready integration output",
    },
    () => ({
      messages: [{ role: "user", content: { type: "text", text: BODY } }],
    }),
  );
}
