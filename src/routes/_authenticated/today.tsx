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
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            {format(new Date(), "EEEE · MMM d, yyyy")}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight mt-1 bg-clip-text text-transparent bg-gradient-to-b from-white to-[#AEAEB2]">Today</h1>
        </header>

        {empty && <EmptyState />}

        <Section
          title="Priority actions"
          badge={
            d?.birthdays.length || d?.reachOut.length
              ? `${(d?.birthdays.length ?? 0) + (d?.reachOut.length ?? 0)} Actionable`
              : undefined
          }
        >
          {(d?.birthdays.length ?? 0) + (d?.reachOut.length ?? 0) === 0 ? (
            <div className="glass-panel p-6 rounded-3xl text-center">
              <p className="text-sm text-muted-foreground">Nothing critical today. Nice work.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {d?.birthdays.map((b) => (
                <Link
                  key={b.person.id + b.kind}
                  to="/people/$id"
                  params={{ id: b.person.id }}
                  className="glass-panel p-5 rounded-3xl hover:bg-white/[0.06] hover:border-white/15 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.99] block group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <Initials name={b.person.name} />
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-primary px-2 py-0.5 rounded-full bg-primary/10">
                      {b.kind}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-primary transition-colors text-base">{b.person.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    {format(new Date(b.when), "MMM d")} — {b.kind}
                  </p>
                </Link>
              ))}
              {d?.reachOut.slice(0, 4).map((r) => (
                <Link
                  key={r.person.id}
                  to="/people/$id"
                  params={{ id: r.person.id }}
                  className="glass-panel p-5 rounded-3xl hover:bg-white/[0.06] hover:border-white/15 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.99] block group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <Initials name={r.person.name} />
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
                      {r.daysSince == null ? "NEVER" : `${r.daysSince}d stale`}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-primary transition-colors text-base">{r.person.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    Reach out every {r.person.target_cadence_days} days
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <section className="glass-panel bg-primary/[0.02] border-primary/20 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
                Insights Engine
              </h2>
            </div>
            {!nudgesOn && (
              <button
                onClick={() => setNudgesOn(true)}
                disabled={empty}
                className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-white transition-colors disabled:opacity-30"
              >
                Generate →
              </button>
            )}
          </div>

          {!nudgesOn && (
            <p className="text-sm text-muted-foreground leading-relaxed">
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
                  className="flex items-start gap-4 text-left w-full hover:bg-white/[0.02] p-2.5 rounded-2xl transition-colors group"
                >
                  <div className="mt-1.5 text-primary">
                    <div className="size-1.5 border-t-2 border-r-2 border-primary rotate-45 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="text-sm leading-relaxed">
                    <span className="text-white font-semibold">{n.headline}:</span>{" "}
                    <span className="text-muted-foreground">{n.reason}</span>{" "}
                    <span className="text-primary font-medium">— {n.suggested_action}</span>
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        <Section title="Open promises">
          {(d?.promises.length ?? 0) === 0 ? (
            <div className="glass-panel p-6 rounded-3xl text-center">
              <p className="text-sm text-muted-foreground">No open promises.</p>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl overflow-hidden divide-y divide-white/5">
              {d?.promises.map((p) => (
                <div key={p.id} className="p-4.5 flex items-center justify-between gap-4 hover:bg-white/[0.01] transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{p.description}</p>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">
                      {(p as any).people?.name ?? "—"}
                      {p.due_at && ` · due ${format(new Date(p.due_at), "MMM d")}`}
                    </p>
                  </div>
                  <button
                    onClick={() => keepPromiseMut.mutate(p.id)}
                    className="text-[9px] font-bold uppercase tracking-wider text-primary border border-primary/20 bg-primary/10 rounded-full px-3 py-1.5 hover:bg-primary hover:text-white transition-all duration-200 active:scale-95"
                  >
                    Kept
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <aside className="col-span-12 lg:col-span-4 space-y-8">
        <Section title="Due reminders" small>
          {(d?.reminders.length ?? 0) === 0 ? (
            <div className="glass-panel p-5 rounded-3xl text-center">
              <p className="text-xs text-muted-foreground">Nothing due in the next 7 days.</p>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl overflow-hidden divide-y divide-white/5">
              {d?.reminders.map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between gap-3 hover:bg-white/[0.01] transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs text-white font-semibold truncate">{r.title}</p>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                      {(r as any).people?.name ?? "General"} ·{" "}
                      {format(new Date(r.due_at), "MMM d")}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => completeMut.mutate(r.id)}
                      className="text-[9px] font-bold uppercase tracking-wider text-primary border border-primary/20 bg-primary/10 rounded-full px-3 py-1 hover:bg-primary hover:text-white transition-all active:scale-95"
                    >
                      Done
                    </button>
                    <button
                      onClick={() => snoozeMut.mutate(r.id)}
                      className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground border border-white/5 bg-white/[0.02] rounded-full px-3 py-1 hover:bg-white/[0.06] transition-all active:scale-95"
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
          <div className="glass-panel rounded-3xl p-6 text-center shadow-lg">
            <div className="mx-auto mb-3.5 flex justify-center">
              <HealthRing score={average(Object.values(d?.scoresById ?? {}))} size={80} />
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
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
      <header className="flex items-center justify-between mb-3.5 px-1">
        <h2
          className={`font-semibold uppercase tracking-[0.2em] text-muted-foreground/80 ${small ? "text-[9px]" : "text-[10px]"}`}
        >
          {title}
        </h2>
        {badge && (
          <span className="text-[9px] font-bold uppercase tracking-wide text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
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
    <div className="size-10 rounded-2xl bg-white/[0.04] border border-white/[0.06] grid place-items-center font-semibold text-xs text-white">
      {s}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass-panel rounded-3xl p-10 text-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[50px] rounded-full pointer-events-none" />
      <h3 className="font-semibold text-lg text-white mb-2">Your roster is empty.</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
        Add your first person to start tracking relationships. Once you have a few contacts, the
        Insights Engine will surface who to reach out to.
      </p>
      <Link
        to="/people"
        className="inline-flex items-center gap-2 bg-[#F2F2F7] hover:bg-white text-black px-5 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-lg"
      >
        Add someone
      </Link>
    </div>
  );
}