import Link from "next/link";
import type { CollectionWithSamples } from "@/lib/icons/queries";

function SampleIcon({
  body,
  width,
  height,
}: {
  body: string;
  width: number;
  height: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={16}
      height={16}
      className="fill-current text-muted-foreground"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

export function CollectionsGrid({
  collections,
}: {
  collections: CollectionWithSamples[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {collections.map((c) => (
        <Link
          key={c.prefix}
          href={`/?collection=${c.prefix}`}
          className="group flex items-center gap-4 border border-border bg-background p-4 transition-colors hover:bg-accent -mb-px -mr-px"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            {c.sampleIcons.map((icon, i) => (
              <SampleIcon
                key={i}
                body={icon.body}
                width={icon.width}
                height={icon.height}
              />
            ))}
            {c.sampleIcons.length === 0 && (
              <div className="h-4 w-4 border border-dashed border-muted-foreground/30" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-xs font-medium text-foreground group-hover:text-foreground">
              {c.prefix}
            </p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">
              {c.name}
            </p>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
            {c.total.toLocaleString()}
          </span>
        </Link>
      ))}
    </div>
  );
}
