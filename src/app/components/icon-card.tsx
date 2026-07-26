"use client";

import { memo, useState } from "react";
import { toast } from "sonner";
import { useWebHaptics } from "web-haptics/react";
import { buildIconCode } from "@/lib/icons/code";
import { useCopyFormatRef } from "./copy-format-provider";

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

function CheckIcon({ size }: { size: number }) {
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

function legacyCopy(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function copyToClipboard(text: string) {
  // Called synchronously from the click handler, so user activation is still
  // live and the async Clipboard API is allowed to fire. The textarea path
  // covers insecure contexts, where navigator.clipboard is undefined.
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
  } else {
    legacyCopy(text);
  }
}

function IconCardImpl({ icon }: { icon: IconData }) {
  // Read at click time, not during render: subscribing here would re-render
  // every card in the grid whenever the format changes.
  const formatRef = useCopyFormatRef();
  const [copied, setCopied] = useState(false);
  const { trigger } = useWebHaptics();

  function handleClick() {
    trigger("success");

    // Rendered in the browser from props: no server roundtrip, so the copy and
    // the "copied!" state land in the same frame as the click.
    copyToClipboard(buildIconCode(icon.fullName, icon, formatRef.current));

    setCopied(true);
    toast(`copied ${icon.fullName}`, {
      icon: (
        <InlineSvg
          body={icon.body}
          width={icon.width}
          height={icon.height}
          size={16}
          className="fill-current shrink-0"
        />
      ),
    });
    setTimeout(() => setCopied(false), 1000);
  }

  return (
    <button
      onClick={handleClick}
      className={`icon-card group flex flex-col items-center gap-2.5 border border-border bg-background p-4 -mb-px -mr-px transition-transform duration-100 active:scale-[0.92] ${
        copied ? "bg-primary text-primary-foreground" : "hover:bg-accent"
      }`}
    >
      <div className="relative flex h-10 w-10 items-center justify-center">
        {copied ? (
          <div className="animate-in zoom-in-0 duration-150">
            <CheckIcon size={24} />
          </div>
        ) : (
          <div className="text-foreground">
            <InlineSvg
              body={icon.body}
              width={icon.width}
              height={icon.height}
              size={24}
              className="fill-current"
            />
          </div>
        )}
      </div>
      <div className="w-full min-w-0 text-center">
        <p className={`truncate font-mono text-[10px] ${
          copied
            ? "text-primary-foreground"
            : "text-muted-foreground group-hover:text-foreground"
        }`}>
          {copied ? "copied!" : icon.name}
        </p>
        {icon.collection && !copied ? (
          <p className="truncate font-mono text-[9px] text-muted-foreground/60">
            {icon.prefix}
          </p>
        ) : null}
      </div>
    </button>
  );
}

/**
 * Memoized because `loadMore` appends to the results array, re-rendering the
 * whole grid: without this, each page of 48 also re-renders every card already
 * on screen. `icon` objects are stable per `fullName`, so the default shallow
 * compare is enough.
 */
export const IconCard = memo(IconCardImpl);
