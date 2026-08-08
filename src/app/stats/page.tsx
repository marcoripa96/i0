import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  getOverview,
  getTopIcons,
  getTopCollections,
  getAgentLeaderboard,
  getMovers,
  getTopSearches,
  getEmptySearches,
  getDailyActivity,
} from "@/lib/analytics/queries";
import { ThemeToggle } from "../components/theme-toggle";
import { McpDialog } from "../components/mcp-dialog";
import {
  ActivityChart,
  EmptyState,
  IconMark,
  MoverRow,
  Panel,
  RankRow,
  Stat,
} from "./components";

export const metadata: Metadata = {
  title: "stats · icons0.dev",
  description:
    "What AI agents actually pick: the most-fetched icons, the collections that win, and which MCP clients are calling.",
};

function iconHref(fullName: string) {
  const [prefix] = fullName.split(":");
  return `/?collection=${encodeURIComponent(prefix)}`;
}

async function Headline() {
  const o = await getOverview();

  if (o.picks === 0 && o.searches === 0) {
    return (
      <div className="border border-border p-8">
        <EmptyState>
          no agent has been shopping yet. counting starts the first time a
          connected MCP client calls get-icon — come back once the room fills up.
        </EmptyState>
      </div>
    );
  }

  const since = o.since
    ? o.since.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        {/* The one hero figure on the page. */}
        <p className="text-5xl leading-none text-foreground sm:text-7xl">
          {o.picks.toLocaleString()}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          icons fetched by agents since {since} · across{" "}
          {o.distinctAgents.toLocaleString()} MCP{" "}
          {o.distinctAgents === 1 ? "client" : "clients"}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4">
        <Stat label="searches" value={o.searches.toLocaleString()} sub="questions asked" />
        <Stat
          label="distinct icons"
          value={o.distinctIcons.toLocaleString()}
          sub="out of 300k+"
        />
        <Stat
          label="collections"
          value={o.distinctCollections.toLocaleString()}
          sub="sets drawn from"
        />
        <Stat
          label="clients"
          value={o.distinctAgents.toLocaleString()}
          sub="agents by name"
        />
      </div>
    </div>
  );
}

async function Activity() {
  const days = await getDailyActivity(14);
  const total = days.reduce((sum, d) => sum + d.picks + d.searches, 0);

  return (
    <Panel title="the last fortnight" hint="agent calls per day">
      {total === 0 ? (
        <EmptyState>no agent traffic in the last 14 days.</EmptyState>
      ) : (
        <ActivityChart days={days} />
      )}
    </Panel>
  );
}

/**
 * The leaderboard, with the number of distinct clients beside each count.
 *
 * A total on its own is exactly what one agent in a retry loop inflates, and
 * this page is public. The second number says whether a row is agreement or
 * repetition, which is the difference between a statistic and a scoreboard.
 */
async function Podium() {
  const icons = await getTopIcons(16);

  return (
    <Panel title="most wanted" hint="fetched over MCP, all time">
      {icons.length === 0 ? (
        <EmptyState>nothing fetched yet.</EmptyState>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {icons.map((icon, i) => (
            <RankRow
              key={icon.fullName}
              rank={i + 1}
              label={icon.fullName}
              sublabel={`× · ${icon.agents} ${icon.agents === 1 ? "client" : "clients"}`}
              value={icon.picks}
              max={icons[0].picks}
              href={iconHref(icon.fullName)}
              icon={<IconMark body={icon.body} width={icon.width} height={icon.height} />}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

async function Agents() {
  const agents = await getAgentLeaderboard(12);

  return (
    <Panel title="which agents are calling" hint="from the MCP handshake">
      {agents.length === 0 ? (
        <EmptyState>
          no agent has introduced itself yet. connect an MCP client and it lands
          here by name.
        </EmptyState>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {agents.map((a, i) => (
            <RankRow
              key={a.client}
              rank={i + 1}
              label={a.client}
              sublabel={`fetched · ${a.icons} distinct · ${a.searches} searches`}
              value={a.calls}
              max={agents[0].calls}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

async function Collections() {
  const rows = await getTopCollections(10);

  return (
    <Panel title="favourite sets" hint="by icons fetched">
      {rows.length === 0 ? (
        <EmptyState>nothing yet.</EmptyState>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {rows.map((row, i) => (
            <RankRow
              key={row.prefix}
              rank={i + 1}
              label={row.name}
              value={row.picks}
              max={rows[0].picks}
              href={`/?collection=${encodeURIComponent(row.prefix)}`}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

async function Movers() {
  const movers = await getMovers(8);
  const scale = Math.max(...movers.map((m) => Math.abs(m.recent - m.previous)), 1);

  return (
    <Panel title="climbing & falling" hint="this week vs last">
      {movers.length === 0 ? (
        <EmptyState>not enough history yet — this needs two weeks of traffic.</EmptyState>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {movers.map((m) => (
            <MoverRow
              key={m.fullName}
              fullName={m.fullName}
              recent={m.recent}
              previous={m.previous}
              scale={scale}
              icon={<IconMark body={m.body} width={m.width} height={m.height} size={18} />}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

async function Searches() {
  const [top, empty] = await Promise.all([getTopSearches(12), getEmptySearches(10)]);

  return (
    <div className="grid gap-px sm:grid-cols-2">
      <Panel title="what agents ask for" hint="results shown per query">
        {top.length === 0 ? (
          <EmptyState>no searches yet.</EmptyState>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {top.map((q, i) => (
              <RankRow
                key={q.query}
                rank={i + 1}
                label={q.query}
                sublabel={`× · ~${q.results} shown`}
                value={q.times}
                max={top[0].times}
                href={`/?q=${encodeURIComponent(q.query)}`}
              />
            ))}
          </div>
        )}
      </Panel>
      <Panel title="found nothing" hint="the search to-do list">
        {empty.length === 0 ? (
          <EmptyState>every search found something. suspicious.</EmptyState>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {empty.map((q, i) => (
              <RankRow
                key={q.query}
                rank={i + 1}
                label={q.query}
                sublabel="× nothing"
                value={q.times}
                max={empty[0].times}
                href={`/?q=${encodeURIComponent(q.query)}`}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/** Reserves a panel's height so streaming in doesn't shove the page around. */
function PanelSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="border border-border">
      <div className="border-b border-border px-4 py-3">
        <div className="h-3 w-32 bg-muted" />
      </div>
      <div className="flex flex-col gap-4 p-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-3 w-full bg-muted" />
        ))}
      </div>
    </div>
  );
}

export default function StatsPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-10 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="group flex items-baseline">
            <pre className="text-lg font-bold leading-none tracking-tighter text-foreground">
              icons0</pre><span className="text-sm font-normal leading-none tracking-tighter text-muted-foreground/40 transition-colors group-hover:text-muted-foreground">.dev</span>
          </Link>
          {/* See the home header: nowrap by inheritance, wrap whole items. */}
          <div className="flex flex-wrap items-center justify-end gap-2 whitespace-nowrap">
            <ThemeToggle />
            <span className="hidden sm:flex items-center gap-2">
              <McpDialog />
            </span>
            {/* The way back, so a phone that lands here is not relying on the
                wordmark being recognised as a link. */}
            <Link
              href="/"
              className="font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              [search]
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <p className="font-mono text-sm text-foreground">
            what the agents are picking
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            every number here comes from an authenticated MCP call — nothing a
            browser does is counted
          </p>
        </div>
      </header>

      {/* The page takes no dynamic input, so all of this prerenders at build
          and then refreshes on the "minutes" profile — visitors never wait on
          a group-by. The boundaries are for the revalidation pass, where each
          section refills on its own rather than the headline waiting behind
          the search tables. */}
      <main className="flex flex-1 flex-col gap-px">
        <Suspense fallback={<PanelSkeleton rows={4} />}>
          <Headline />
        </Suspense>
        <Suspense fallback={<PanelSkeleton rows={4} />}>
          <Activity />
        </Suspense>
        <Suspense fallback={<PanelSkeleton rows={8} />}>
          <Podium />
        </Suspense>
        <Suspense fallback={<PanelSkeleton rows={6} />}>
          <Agents />
        </Suspense>
        <Suspense fallback={<PanelSkeleton rows={6} />}>
          <Collections />
        </Suspense>
        <Suspense fallback={<PanelSkeleton rows={6} />}>
          <Movers />
        </Suspense>
        <Suspense fallback={<PanelSkeleton rows={6} />}>
          <Searches />
        </Suspense>
      </main>

      <footer className="mt-10 border-t border-border pt-4 font-mono text-[10px] text-muted-foreground">
        counts are aggregate and refresh every few minutes. nothing here
        identifies anyone.
      </footer>
    </div>
  );
}
