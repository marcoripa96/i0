"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getIconCode } from "@/app/actions";

type IconData = {
  fullName: string;
  name: string;
  prefix: string;
  collection?: string;
  body: string;
  width: number;
  height: number;
};

function InlineSvg({
  body,
  width,
  height,
  size,
  className,
}: {
  body: string;
  width: number;
  height: number;
  size: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={size}
      height={size}
      className={className}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

export function IconCard({ icon }: { icon: IconData }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [format, setFormat] = useState<"svg" | "react">("svg");
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setOpen(true);
    setCode(null);
    setCopied(false);
    loadCode("svg");
  }

  function loadCode(fmt: "svg" | "react") {
    setFormat(fmt);
    setCopied(false);
    startTransition(async () => {
      const result = await getIconCode(icon.fullName, fmt);
      setCode(result);
    });
  }

  async function handleCopy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="group flex flex-col items-center gap-2.5 bg-background p-4 transition-colors hover:bg-accent"
      >
        <div className="flex h-10 w-10 items-center justify-center text-foreground">
          <InlineSvg
            body={icon.body}
            width={icon.width}
            height={icon.height}
            size={24}
            className="fill-current"
          />
        </div>
        <div className="w-full min-w-0 text-center">
          <p className="truncate font-mono text-[10px] text-muted-foreground group-hover:text-foreground">
            {icon.name}
          </p>
          {icon.collection && (
            <p className="truncate font-mono text-[9px] text-muted-foreground/60">
              {icon.prefix}
            </p>
          )}
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md gap-6">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              {icon.fullName}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-muted-foreground">
              {icon.collection || icon.prefix}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center border border-border bg-card p-8">
            <InlineSvg
              body={icon.body}
              width={icon.width}
              height={icon.height}
              size={64}
              className="fill-current text-foreground"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={format === "svg" ? "default" : "outline"}
              size="sm"
              onClick={() => loadCode("svg")}
              className="font-mono text-xs"
            >
              [svg]
            </Button>
            <Button
              variant={format === "react" ? "default" : "outline"}
              size="sm"
              onClick={() => loadCode("react")}
              className="font-mono text-xs"
            >
              [tsx]
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!code || isPending}
              className="font-mono text-xs"
            >
              {copied ? "copied!" : isPending ? "..." : "[copy]"}
            </Button>
          </div>

          {code && (
            <pre className="max-h-[200px] overflow-auto border border-border bg-card p-3 font-mono text-[11px] leading-relaxed text-foreground/80">
              {code}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
