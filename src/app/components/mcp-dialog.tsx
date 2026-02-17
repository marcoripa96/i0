"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Harness = {
  id: string;
  name: string;
  configPath: string;
  getConfig: (url: string, token: string) => string;
};

const TOKEN_PLACEHOLDER = "<your-api-key>";

const harnesses: Harness[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    configPath: "Terminal",
    getConfig: (url, token) =>
      `claude mcp add icons0 \\\n  --header "Authorization: Bearer ${token}" \\\n  --transport http \\\n  ${url}`,
  },
  {
    id: "codex",
    name: "Codex",
    configPath: "~/.codex/config.toml",
    getConfig: (url, token) =>
      `[mcp_servers.icons0]\nurl = "${url}"\nhttp_headers = { Authorization = "Bearer ${token}" }`,
  },
  {
    id: "cursor",
    name: "Cursor",
    configPath: ".cursor/mcp.json",
    getConfig: (url, token) =>
      JSON.stringify(
        {
          mcpServers: {
            icons0: {
              url,
              headers: { Authorization: `Bearer ${token}` },
            },
          },
        },
        null,
        2
      ),
  },
];

function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function McpDialog({ token }: { token?: string }) {
  const [selected, setSelected] = useState("claude-code");
  const [copied, setCopied] = useState(false);

  const harness = harnesses.find((h) => h.id === selected)!;
  const mcpUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/mcp`
      : "https://your-domain.com/mcp";
  const config = harness.getConfig(mcpUrl, token || TOKEN_PLACEHOLDER);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(config);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = config;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground cursor-pointer">
          [mcp]
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm font-medium">
            Add MCP server
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Give your agent instant access to 200k+ icons.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-full font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {harnesses.map((h) => (
                <SelectItem
                  key={h.id}
                  value={h.id}
                  className="font-mono text-xs"
                >
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[10px] text-muted-foreground/60">
                {harness.configPath}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground/50 transition-colors hover:text-foreground cursor-pointer"
              >
                {copied ? (
                  <>
                    <CheckIcon size={10} />
                    copied
                  </>
                ) : (
                  <>
                    <CopyIcon size={10} />
                    copy
                  </>
                )}
              </button>
            </div>
            <pre className="overflow-x-auto rounded border border-border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap break-all">
              {config}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
