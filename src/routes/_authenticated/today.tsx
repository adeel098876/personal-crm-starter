import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDashboard } from "@/lib/dashboard.functions";
import { dailyNudges } from "@/lib/ai.functions";
import { completeReminder, snoozeReminder } from "@/lib/reminders.functions";
import { resolvePromise } from "@/lib/reminders.functions";
import { HealthRing } from "@/components/health-ring";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/today")({
  component: TodayPage,
});

function TodayPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchDashboard = useServerFn(getDashboard);
  const fetchNudges = useServerFn(dailyNudges);
  const doComplete = useServerFn(completeReminder);
  const doSnooze = useServerFn(snoozeReminder);
  const doResolvePromise = useServerFn(resolvePromise);
  const [nudgesOn, setNudgesOn] = useState(false);

  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
  });

  const nudges = useQuery({
    queryKey: ["nudges"],
    queryFn: () => fetchNudges(),
    enabled: nudgesOn,
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => doComplete({ data: { id } }),
    onSuccess: () => {
      toast.success("Done");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const snoozeMut = useMutation({
    mutationFn: (id: string) => doSnooze({ data: { id, days: 3 } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });
  const keepPromiseMut = useMutation({
    mutationFn: (id: string) => doResolvePromise({ data: { id, status: "kept" } }),
    onSuccess: () => {
      toast.success("Promise kept");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const d = dashboard.data;
  const empty = d && d.totalPeople === 0;

  return (
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-12 lg:col-span-8 space-y-10">
        <header>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            {format(new Date(), "EEEE · MMM d, yyyy")}
          </p>
          <h1 className="text-3xl font-bold tracking-tight mt-1">Today</h1>
        </header>

        {empty && <EmptyState />}

        <Section
          title="Priority actions"
          badge={
            d?.birthdays.length || d?.reachOut.length
              ? `${(d?.birthdays.length ?? 0) + (d?.reachOut.length ?? 0)} CRITICAL`
              : undefined
          }
        >
          {(d?.birthdays.length ?? 0) + (d?.reachOut.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing critical today. Nice work.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {d?.birthdays.map((b) => (
                <Link
                  key={b.person.id + b.kind}
                  to="/people/$id"
                  params={{ id: b.person.id }}
                  className="bg-surface border border-border p-4 rounded-lg hover:border-accent/40 transition-colors block"
                >
                  <div className="flex items-start justify-between mb-3">
                    <Initials name={b.person.name} />
                    <span className="text-[10px] font-mono text-accent">
                      {b.kind.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="font-medium">{b.person.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(b.when), "MMM d")} — {b.kind}
                  </p>
                </Link>
              ))}
              {d?.reachOut.slice(0, 4).map((r) => (
                <Link
                  key={r.person.id}
                  to="/people/$id"
                  params={{ id: r.person.id }}
                  className="bg-surface border border-border p-4 rounded-lg hover:border-accent/40 transition-colors block"
                >
                  <div className="flex items-start justify-between mb-3">
                    <Initials name={r.person.name} />
                    <span className="text-[10px] font-mono text-orange-400/80">
                      {r.daysSince == null ? "NEVER" : `STALE (${r.daysSince}d)`}
                    </span>
                  </div>
                  <h3 className="font-medium">{r.person.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Target cadence: every {r.person.target_cadence_days} days
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <section className="bg-accent/[0.03] border border-accent/10 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-[60px] rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-accent animate-pulse" />
              <h2 className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-accent">
                Insights Engine
              </h2>
            </div>
            {!nudgesOn && (
              <button
                onClick={() => setNudgesOn(true)}
                disabled={empty}
                className="text-[10px] font-mono uppercase tracking-widest text-accent hover:underline underline-offset-4 disabled:opacity-30"
              >
                Generate →
              </button>
            )}
          </div>

          {!nudgesOn && (
            <p className="text-sm text-muted-foreground">
              AI executive assistant. Click Generate to get today's three most important actions,
              based on cadence, promises, and dates.
            </p>
          )}
          {nudgesOn && nudges.isLoading && (
            <p className="text-sm text-muted-foreground animate-pulse">Thinking…</p>
          )}
          {nudgesOn && nudges.error && (
            <p className="text-sm text-destructive">
              {(nudges.error as Error).message}
            </p>
          )}
          {nudgesOn && nudges.data && (
            <div className="space-y-4">
              {nudges.data.nudges.length === 0 && (
                <p className="text-sm text-muted-foreground">No suggestions right now.</p>
              )}
              {nudges.data.nudges.map((n, i) => (
                <button
                  key={i}
                  onClick={() =>
                    navigate({ to: "/people/$id", params: { id: n.person_id } })
                  }
                  className="flex items-start gap-4 text-left w-full"
                >
                  <div className="mt-1.5 text-accent">
                    <div className="size-1.5 border-t border-r border-accent rotate-45" />
                  </div>
                  <p className="text-sm leading-relaxed">
                    <span className="text-foreground font-medium">{n.headline}:</span>{" "}
                    <span className="text-muted-foreground">{n.reason}</span>{" "}
                    <span className="text-accent">— {n.suggested_action}</span>
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        <Section title="Open promises">
          {(d?.promises.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No open promises.</p>
          ) : (
            <div className="border border-border rounded-lg bg-surface divide-y divide-border">
              {d?.promises.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{p.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(p as any).people?.name ?? "—"}
                      {p.due_at && ` · due ${format(new Date(p.due_at), "MMM d")}`}
                    </p>
                  </div>
                  <button
                    onClick={() => keepPromiseMut.mutate(p.id)}
                    className="text-[10px] font-mono uppercase tracking-widest text-accent border border-accent/20 bg-accent/10 rounded px-2 py-1"
                  >
                    Kept
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <aside className="col-span-12 lg:col-span-4 space-y-6">
        <Section title="Due reminders" small>
          {(d?.reminders.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due in the next 7 days.</p>
          ) : (
            <div className="bg-surface border border-border rounded-lg divide-y divide-border">
              {d?.reminders.map((r) => (
                <div key={r.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{r.title}</p>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
                      {(r as any).people?.name ?? "General"} ·{" "}
                      {format(new Date(r.due_at), "MMM d")}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => completeMut.mutate(r.id)}
                      className="text-[10px] font-mono uppercase tracking-widest text-accent border border-accent/20 bg-accent/10 rounded px-2 py-1"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => snoozeMut.mutate(r.id)}
                      className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border border-border rounded px-2 py-1"
                    >
                      +3d
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Roster health" small>
          <div className="bg-surface border border-border rounded-lg p-5 text-center">
            <div className="mx-auto mb-3">
              <HealthRing score={average(Object.values(d?.scoresById ?? {}))} size={72} />
            </div>
            <p className="text-xs text-muted-foreground">
              Across {d?.totalPeople ?? 0} contacts
            </p>
          </div>
        </Section>
      </aside>
    </div>
  );
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function Section({
  title,
  badge,
  children,
  small,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <section>
      <header className="flex items-center justify-between mb-4">
        <h2
          className={`font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground ${small ? "text-[10px]" : "text-xs"}`}
        >
          {title}
        </h2>
        {badge && (
          <span className="text-[10px] font-mono text-accent bg-accent/10 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function Initials({ name }: { name: string }) {
  const parts = name.split(" ").filter(Boolean);
  const s = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "··";
  return (
    <div className="size-10 rounded bg-background border border-border grid place-items-center font-mono text-sm text-muted-foreground">
      {s}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-border rounded-xl p-10 text-center bg-surface/50">
      <h3 className="font-medium mb-2">Your roster is empty.</h3>
      <p className="text-sm text-muted-foreground mb-5">
        Add your first person to start tracking relationships. Once you have a few contacts, the
        Insights Engine will surface who to reach out to.
      </p>
      <Link
        to="/people"
        className="inline-flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
      >
        Add someone
      </Link>
    </div>
  );
}