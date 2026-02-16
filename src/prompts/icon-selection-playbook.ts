import { type PromptMetadata } from "xmcp";

export const metadata: PromptMetadata = {
  name: "icon-selection-playbook",
  title: "Icon Selection Playbook",
  description: "Fast decision loop for finding the best icon candidates",
  role: "user",
};

export default function iconSelectionPlaybook() {
  return `You are selecting icons from the icons0 MCP server.

## Goal

Find the best icon match with the fewest calls while preserving visual consistency.

## Decision loop

1. **Start broad**
   - Call \`search-icons\` with a concise natural-language query.
   - Example: \`{ query: "calendar check", limit: 20 }\`

2. **Narrow only if needed**
   - If style must match an existing set, rerun with \`collection\`.
   - If legal constraints apply, add \`license\`.
   - If domain-specific grouping helps, add \`category\`.

3. **Page deliberately**
   - Only request another page when the current results are weak.
   - Use the exact \`data.pagination.nextOffset\` returned by the tool.

4. **Compare candidates in batch**
   - Call \`get-icon\` once with multiple names (up to 20).
   - Example: \`{ name: ["mdi:calendar-check", "lucide:calendar-check", "tabler:calendar-check"] }\`

5. **Pick by style fit**
   - Prefer consistency with the user’s existing icon language:
     - stroke vs fill
     - stroke width
     - linecap/linejoin style
     - visual complexity
     - viewBox compatibility

6. **Explain the decision**
   - Report the chosen icon, collection, and why it beat alternatives.
   - If tradeoffs exist (style or license), state them explicitly.

## Error handling

- If the server returns \`INVALID_PARAMS\`, repair arguments and retry once.
- If \`NOT_FOUND\`, broaden query or remove restrictive filters.
- If \`RATE_LIMIT\`, stop and communicate reset timing.
- If \`INTERNAL\`, retry once, then return a concise failure summary.

## Output discipline

- Do not dump long candidate lists.
- Show 1 winner and up to 2 alternatives.
- Include the exact \`fullName\` so downstream calls are deterministic.`;
}
