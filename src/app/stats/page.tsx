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
  type RankedIcon,
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
  SplitBar,
  Stat,
} from "./components";

export const metadata: Metadata = {
  title: "stats · icons0.dev",
  description:
    "What humans and AI agents actually pick: the most-taken icons, the collections that win, and which agents are shopping.",
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
          nothing picked yet. counting starts the moment somebody copies an icon
          or an agent calls get-icon — come back once the room fills up.
        </EmptyState>
      </div>
    );
  }

  const agentShare = o.picks > 0 ? Math.round((o.agent / o.picks) * 100) : 0;
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
          icons taken since {since} · {agentShare}% of them by something that
          isn&apos;t a person
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4">
        <Stat label="humans" value={o.human.toLocaleString()} sub="copied from the site" />
        <Stat label="agents" value={o.agent.toLocaleString()} sub="fetched over MCP" />
        <Stat label="searches" value={o.searches.toLocaleString()} sub="queries typed and asked" />
        <Stat
          label="distinct icons"
          value={o.distinctIcons.toLocaleString()}
          sub={`out of 300k+`}
        />
      </div>

      <Panel title="who is shopping" hint="share of every icon taken">
        <SplitBar human={o.human} agent={o.agent} />
      </Panel>
    </div>
  );
}

async function Activity() {
  const days = await getDailyActivity(14);
  const total = days.reduce((sum, d) => sum + d.human + d.agent, 0);

  return (
    <Panel title="the last fortnight" hint="picks per day">
      {total === 0 ? (
        <EmptyState>no picks in the last 14 days.</EmptyState>
      ) : (
        <ActivityChart days={days} />
      )}
    </Panel>
  );
}

function IconRanking({ icons }: { icons: RankedIcon[] }) {
  if (icons.length === 0) return <EmptyState>nothing here yet.</EmptyState>;
  const max = icons[0].picks;

  return (
    <div className="flex flex-col divide-y divide-border">
      {icons.map((icon, i) => (
        <RankRow
          key={icon.fullName}
          rank={i + 1}
          label={icon.fullName}
          value={icon.picks}
          max={max}
          href={iconHref(icon.fullName)}
          icon={<IconMark body={icon.body} width={icon.width} height={icon.height} />}
        />
      ))}
    </div>
  );
}

async function Podium() {
  const icons = await getTopIcons(null, 12);

  return (
    <Panel title="most wanted" hint="every source, all time">
      <IconRanking icons={icons} />
    </Panel>
  );
}

/**
 * The comparison the page exists for. The two rankings are computed
 * independently and then marked up against each other.
 *
 * The tag marks agreement, not disagreement. Tagging the ids unique to a
 * column was tried first and put a tag on nearly every row — the two
 * audiences overlap that little — which made the mark noise. Consensus is the
 * rare event here, so consensus is what earns the ink.
 */
async function HeadToHead() {
  const [human, agent] = await Promise.all([getTopIcons("web", 8), getTopIcons("mcp", 8)]);
  const humanSet = new Set(human.map((i) => i.fullName));
  const agentSet = new Set(agent.map((i) => i.fullName));

  const column = (icons: RankedIcon[], otherSet: Set<string>) => {
    if (icons.length === 0) return <EmptyState>nothing yet.</EmptyState>;
    const max = icons[0].picks;
    return (
      <div className="flex flex-col divide-y divide-border">
        {icons.map((icon, i) => (
          <RankRow
            key={icon.fullName}
            rank={i + 1}
            label={icon.fullName}
            sublabel={otherSet.has(icon.fullName) ? "· agreed" : undefined}
            value={icon.picks}
            max={max}
            href={iconHref(icon.fullName)}
            icon={<IconMark body={icon.body} width={icon.width} height={icon.height} />}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="grid gap-px sm:grid-cols-2">
      <Panel title="humans pick" hint="copied from the browser">
        {column(human, agentSet)}
      </Panel>
      <Panel title="agents pick" hint="fetched over MCP">
        {column(agent, humanSet)}
      </Panel>
    </div>
  );
}

async function Collections() {
  const [human, agent] = await Promise.all([
    getTopCollections("web", 8),
    getTopCollections("mcp", 8),
  ]);

  const column = (rows: { prefix: string; name: string; picks: number }[]) => {
    if (rows.length === 0) return <EmptyState>nothing yet.</EmptyState>;
    const max = rows[0].picks;
    return (
      <div className="flex flex-col divide-y divide-border">
        {rows.map((row, i) => (
          <RankRow
            key={row.prefix}
            rank={i + 1}
            label={row.name}
            value={row.picks}
            max={max}
            href={`/?collection=${encodeURIComponent(row.prefix)}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="grid gap-px sm:grid-cols-2">
      <Panel title="human favourite sets" hint="by icons copied">
        {column(human)}
      </Panel>
      <Panel title="agent favourite sets" hint="by icons fetched">
        {column(agent)}
      </Panel>
    </div>
  );
}

async function Agents() {
  const agents = await getAgentLeaderboard(10);

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
              sublabel={`calls · ${a.icons} icons`}
              value={a.calls}
              max={agents[0].calls}
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
        <EmptyState>not enough history yet — this needs two weeks of picks.</EmptyState>
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
  const [top, empty] = await Promise.all([getTopSearches(10), getEmptySearches(10)]);

  return (
    <div className="grid gap-px sm:grid-cols-2">
      <Panel title="what people ask for" hint="results shown per query">
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
            what everyone is actually picking
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            humans copy · agents fetch · nobody agrees
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
        <Suspense fallback={<PanelSkeleton rows={8} />}>
          <HeadToHead />
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
