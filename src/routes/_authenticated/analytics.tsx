import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAnalytics } from "@/lib/dashboard.functions";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const fetch = useServerFn(getAnalytics);
  const q = useQuery({ queryKey: ["analytics"], queryFn: () => fetch() });

  if (q.isLoading) return <p className="text-sm text-muted-foreground animate-pulse">Loading analytics…</p>;
  const d = q.data;
  if (!d) return null;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Signal
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight mt-1 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground">
          Analytics
        </h1>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total people" value={d.totalPeople} />
        <Stat label="Contacted / 30d" value={d.contactedThisMonth} />
        <Stat label="Interactions / 90d" value={d.totalInteractions90} />
        <Stat
          label="Promise reliability"
          value={
            d.totalPromises === 0
              ? "—"
              : `${Math.round((d.keptPromises / d.totalPromises) * 100)}%`
          }
        />
      </div>

      <section className="glass-panel rounded-3xl p-6 shadow-xl space-y-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground pl-1">
          Cadence — last 12 weeks
        </h2>
        <div className="h-64 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.weeks}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 16,
                  color: "var(--color-popover-foreground)",
                  fontSize: 12,
                  backdropFilter: "blur(16px)",
                  boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.2)",
                }}
              />
              <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground pl-1">
          Longest ignored
        </h2>
        <div className="glass-panel rounded-3xl overflow-hidden divide-y divide-border shadow-xl">
          {d.longestIgnored.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Not enough interaction data yet.
            </p>
          )}
          {d.longestIgnored.map((r: any) => (
            <Link
              key={r.person.id}
              to="/people/$id"
              params={{ id: r.person.id }}
              className="p-4.5 flex items-center justify-between hover:bg-surface-2 transition-all duration-200 group"
            >
              <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{r.person.name}</span>
              <span className="text-xs font-mono text-amber-500 font-medium bg-amber-500/10 px-2.5 py-1 rounded-full">{r.days}d ago</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-panel glass-panel-hover rounded-3xl p-5 shadow-lg">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-2xl font-extrabold tracking-tight mt-1.5 text-foreground">{value}</p>
    </div>
  );
}