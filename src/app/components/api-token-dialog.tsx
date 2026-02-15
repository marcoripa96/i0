"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createApiToken,
  listApiTokens,
  deleteApiToken,
} from "@/lib/api-tokens";
import { KeyIcon } from "./icons";

type Token = {
  id: string;
  name: string;
  createdAt: Date | null;
};

export function ApiTokenDialog() {
  const [open, setOpen] = useState(false);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, startCreateTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  useEffect(() => {
    if (open) {
      startCreateTransition(async () => {
        const result = await listApiTokens();
        setTokens(result);
      });
      setNewToken(null);
    }
  }, [open]);

  function handleCreate() {
    startCreateTransition(async () => {
      const token = await createApiToken("default");
      setNewToken(token);
      const updated = await listApiTokens();
      setTokens(updated);
    });
  }

  function handleDelete(id: string) {
    startDeleteTransition(async () => {
      await deleteApiToken(id);
      setTokens((prev) => prev.filter((t) => t.id !== id));
    });
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer">
          <KeyIcon className="shrink-0 size-[16px]" />
          api keys
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm font-medium">
            API keys
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Generate tokens to authenticate with the MCP server.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {newToken && (
            <div className="flex flex-col gap-1.5 rounded border border-border bg-muted/50 p-3">
              <p className="font-mono text-xs text-muted-foreground">
                Copy this token now — it won&apos;t be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto font-mono text-xs text-foreground break-all">
                  {newToken}
                </code>
                <button
                  onClick={() => handleCopy(newToken)}
                  className="shrink-0 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                >
                  {copied ? "copied" : "copy"}
                </button>
              </div>
            </div>
          )}

          {tokens.length > 0 && (
            <div className="flex flex-col gap-1">
              {tokens.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded px-2 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-foreground">
                      {t.name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground/60">
                      {t.createdAt
                        ? new Date(t.createdAt).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={isDeleting}
                    className="font-mono text-xs text-muted-foreground transition-colors hover:text-destructive cursor-pointer disabled:opacity-50"
                  >
                    revoke
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full rounded border border-border px-3 py-2 font-mono text-sm text-foreground transition-colors hover:bg-muted cursor-pointer disabled:opacity-50"
          >
            {isCreating ? "generating..." : "generate new key"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
