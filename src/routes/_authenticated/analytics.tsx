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

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const d = q.data;
  if (!d) return null;

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Signal
        </p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Analytics</h1>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

      <section className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
          Cadence — last 12 weeks
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.weeks}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="var(--color-accent)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Longest ignored
        </h2>
        <div className="bg-surface border border-border rounded-lg divide-y divide-border">
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
              className="p-4 flex items-center justify-between hover:bg-background/50 transition-colors"
            >
              <span className="text-sm font-medium">{r.person.name}</span>
              <span className="text-xs font-mono text-orange-400/80">{r.days}d ago</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="text-2xl font-bold tracking-tight mt-1">{value}</p>
    </div>
  );
}