import { type PromptMetadata } from "xmcp";

export const metadata: PromptMetadata = {
  name: "icon-integration-playbook",
  title: "Icon Integration Playbook",
  description: "Turn selected icons into codebase-ready integration output",
  role: "user",
};

export default function iconIntegrationPlaybook() {
  return `You already have the target icon fullName(s). Integrate them into the user's project with minimal friction.

## Format choice

1. **Prefer shadcn install commands** when the project uses React + shadcn workflow.
2. **Use React output** when the user wants owned component source files.
3. **Use raw SVG** for non-React stacks, design assets, or inline markup needs.

## MCP usage

- Single icon source:
  - \`get-icon\` with \`{ name: "prefix:name", format: "react" }\` or \`format: "svg"\`
- Batch source:
  - \`get-icon\` with \`{ name: ["prefix:a", "prefix:b"], format: "react" }\`
- Registry path mapping:
  - Convert \`prefix:name\` to \`@icons0/prefix/name\` for shadcn install commands.

## Installation flow (shadcn)

- Build command from selected icon:
  - \`npx shadcn@latest add @icons0/<collection>/<name>\`
- For multiple icons, include all package paths in one command when practical.

## Response requirements

- Provide copy-pasteable commands or code blocks.
- Include expected target paths/imports when relevant.
- Include license title/source collection for attribution-sensitive contexts.
- Keep output short and execution-oriented.

## Error handling

- \`NOT_FOUND\`: run \`search-icons\` and present corrected candidates.
- \`INVALID_PARAMS\`: repair request shape and retry once.
- \`INTERNAL\`: retry once, then provide fallback format (SVG if React conversion fails).`;
}
