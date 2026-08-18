import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDashboard } from "@/lib/dashboard.functions";
import { dailyNudges } from "@/lib/ai.functions";
import { completeReminder, snoozeReminder } from "@/lib/reminders.functions";
import { resolvePromise } from "@/lib/reminders.functions";
import { HealthRing } from "@/components/health-ring";
import { PersonPanel } from "@/components/person-panel";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/today")({
  component: TodayPage,
});

function TodayPage() {
  const qc = useQueryClient();
  const fetchDashboard = useServerFn(getDashboard);
  const fetchNudges = useServerFn(dailyNudges);
  const doComplete = useServerFn(completeReminder);
  const doSnooze = useServerFn(snoozeReminder);
  const doResolvePromise = useServerFn(resolvePromise);
  const [nudgesOn, setNudgesOn] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetchDashboard();
      return res as {
        birthdays: Array<{ person: any; when: string; kind: string }>;
        reachOut: Array<{ person: any; score: number; daysSince: number | null }>;
        reminders: any[];
        promises: any[];
        totalPeople: number;
        scoresById: Record<string, number>;
      };
    },
  });

  const nudges = useQuery({
    queryKey: ["nudges"],
    queryFn: async () => {
      const res = await fetchNudges();
      // Normalise: server may return { nudges: [...] } or the array directly
      const data = res as any;
      const nudgeList: Array<{
        person_id: string;
        headline: string;
        reason: string;
        suggested_action: string;
      }> = Array.isArray(data) ? data : Array.isArray(data?.nudges) ? data.nudges : [];
      return { nudges: nudgeList };
    },
    enabled: nudgesOn,
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => doComplete({ data: { id } }),
    onSuccess: () => {
      toast.success("Done ✓");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(`Action failed: ${e instanceof Error ? e.message : "Error"}`),
  });

  const snoozeMut = useMutation({
    mutationFn: (id: string) => doSnooze({ data: { id, days: 3 } }),
    onSuccess: () => {
      toast.success("Snoozed 3 days");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(`Snooze failed: ${e instanceof Error ? e.message : "Error"}`),
  });

  const keepPromiseMut = useMutation({
    mutationFn: (id: string) => doResolvePromise({ data: { id, status: "kept" } }),
    onSuccess: () => {
      toast.success("Promise kept ✓");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) =>
      toast.error(`Promise update failed: ${e instanceof Error ? e.message : "Error"}`),
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
          <h1 className="text-4xl font-extrabold tracking-tight mt-1 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground">
            Today
          </h1>
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
                <button
                  key={b.person.id + b.kind}
                  onClick={() => setSelectedPersonId(b.person.id)}
                  className="glass-panel glass-panel-hover p-5 rounded-3xl text-left block w-full group cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <Initials name={b.person.name} />
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-primary px-2 py-0.5 rounded-full bg-primary/10">
                      {b.kind}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-base">
                    {b.person.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    {format(new Date(b.when), "MMM d")} — {b.kind}
                  </p>
                </button>
              ))}
              {d?.reachOut.slice(0, 4).map((r) => (
                <button
                  key={r.person.id}
                  onClick={() => setSelectedPersonId(r.person.id)}
                  className="glass-panel glass-panel-hover p-5 rounded-3xl text-left block w-full group cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <Initials name={r.person.name} />
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      {r.daysSince == null ? "NEVER" : `${r.daysSince}d stale`}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors text-base">
                    {r.person.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    Reach out every {r.person.target_cadence_days} days
                  </p>
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* Insights Engine */}
        <section className="glass-panel bg-primary/[0.02] border-primary/20 rounded-3xl p-6 relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
                ✨ AI Insights Engine
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {nudgesOn && !nudges.isLoading && (
                <button
                  onClick={() => qc.invalidateQueries({ queryKey: ["nudges"] })}
                  className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                >
                  ↺ Refresh
                </button>
              )}
              {!nudgesOn && (
                <button
                  onClick={() => setNudgesOn(true)}
                  disabled={empty}
                  className="text-[10px] font-bold uppercase tracking-widest text-primary hover:opacity-80 transition-colors disabled:opacity-30"
                >
                  Generate →
                </button>
              )}
            </div>
          </div>

          {!nudgesOn && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your AI relationship coach analyzes your cadence, open promises, and upcoming
                birthdays — then surfaces the{" "}
                <strong className="text-foreground">3 most important actions</strong> to take today.
              </p>
              <button
                onClick={() => setNudgesOn(true)}
                disabled={empty}
                className="inline-flex items-center gap-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-30"
              >
                ✨ Generate AI Nudges
              </button>
            </div>
          )}

          {nudgesOn && nudges.isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl bg-surface-2 border border-border p-4 space-y-2"
                >
                  <div className="h-3 bg-border/60 rounded w-1/3" />
                  <div className="h-4 bg-border/40 rounded w-2/3" />
                  <div className="h-3 bg-border/30 rounded w-full" />
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground text-center animate-pulse font-medium uppercase tracking-widest">
                AI is analyzing your relationships…
              </p>
            </div>
          )}

          {nudgesOn && nudges.error && (
            <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-4 space-y-2">
              <p className="text-sm text-destructive font-semibold">
                {(nudges.error as Error).message.includes("GROQ_API_KEY")
                  ? "⚠️ GROQ_API_KEY not configured"
                  : "AI request failed"}
              </p>
              <p className="text-xs text-muted-foreground">
                {(nudges.error as Error).message.includes("GROQ_API_KEY")
                  ? "Add your Groq API key to .env: GROQ_API_KEY=gsk_..."
                  : (nudges.error as Error).message}
              </p>
              <button
                onClick={() => qc.invalidateQueries({ queryKey: ["nudges"] })}
                className="text-[9px] font-bold uppercase tracking-wider text-primary hover:opacity-80 transition-opacity"
              >
                ↺ Retry
              </button>
            </div>
          )}

          {nudgesOn && nudges.data && (
            <div className="space-y-3">
              {(nudges.data.nudges?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">
                  No suggestions right now — all your relationships look healthy!
                </p>
              )}
              {(nudges.data.nudges ?? []).map((n: any, i: number) => {
                const priorityStyle =
                  n.priority === "high"
                    ? "border-red-400/30 bg-red-400/5 text-red-400"
                    : n.priority === "medium"
                      ? "border-amber-400/30 bg-amber-400/5 text-amber-400"
                      : "border-blue-400/30 bg-blue-400/5 text-blue-400";
                return (
                  <button
                    key={i}
                    onClick={() => n.person_id && setSelectedPersonId(n.person_id)}
                    className="w-full text-left glass-panel glass-panel-hover rounded-2xl p-4 space-y-2 transition-all duration-200 group hover:border-primary/30 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-foreground/70">{n.name}</span>
                      {n.priority && (
                        <span
                          className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${priorityStyle}`}
                        >
                          {n.priority}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-snug">
                      {n.headline}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{n.reason}</p>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="size-1 rounded-full bg-primary" />
                      <p className="text-[10px] text-primary font-semibold">{n.suggested_action}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <Section title="Open promises">
          {(d?.promises.length ?? 0) === 0 ? (
            <div className="glass-panel p-6 rounded-3xl text-center">
              <p className="text-sm text-muted-foreground">No open promises.</p>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl overflow-hidden divide-y divide-border shadow-xl">
              {d?.promises.map((p) => {
                const personId = p.person_id || (p as any).people?.id;
                return (
                  <div
                    key={p.id}
                    className="p-4.5 flex items-center justify-between gap-4 hover:bg-surface-2 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground font-medium truncate">
                        {p.description}
                      </p>
                      <button
                        type="button"
                        onClick={() => personId && setSelectedPersonId(personId)}
                        className="text-xs text-muted-foreground mt-1 font-medium hover:text-primary transition-colors text-left"
                      >
                        {(p as any).people?.name ?? "—"}
                        {p.due_at && ` · due ${format(new Date(p.due_at), "MMM d")}`}
                      </button>
                    </div>
                    <button
                      onClick={() => keepPromiseMut.mutate(p.id)}
                      disabled={keepPromiseMut.isPending && keepPromiseMut.variables === p.id}
                      className="text-[9px] font-bold uppercase tracking-wider text-primary border border-primary/20 bg-primary/10 rounded-full px-3.5 py-1.5 hover:bg-primary hover:text-primary-foreground transition-all duration-200 active:scale-95 disabled:opacity-50"
                    >
                      {keepPromiseMut.isPending && keepPromiseMut.variables === p.id
                        ? "Kept..."
                        : "Kept ✓"}
                    </button>
                  </div>
                );
              })}
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
            <div className="glass-panel rounded-3xl overflow-hidden divide-y divide-border shadow-xl">
              {d?.reminders.map((r) => {
                const personId = r.person_id || (r as any).people?.id;
                return (
                  <div
                    key={r.id}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-surface-2 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground font-semibold truncate">{r.title}</p>
                      <button
                        type="button"
                        onClick={() => personId && setSelectedPersonId(personId)}
                        className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mt-1 hover:text-primary transition-colors text-left"
                      >
                        {(r as any).people?.name ?? "General"} ·{" "}
                        {format(new Date(r.due_at), "MMM d")}
                      </button>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => completeMut.mutate(r.id)}
                        disabled={completeMut.isPending && completeMut.variables === r.id}
                        className="text-[9px] font-bold uppercase tracking-wider text-primary border border-primary/20 bg-primary/10 rounded-full px-3 py-1 hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
                      >
                        Done ✓
                      </button>
                      <button
                        onClick={() => snoozeMut.mutate(r.id)}
                        disabled={snoozeMut.isPending && snoozeMut.variables === r.id}
                        className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground border border-border bg-surface rounded-full px-3 py-1 hover:bg-surface-2 transition-all active:scale-95 disabled:opacity-50"
                      >
                        +3d
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Roster health" small>
          <div className="glass-panel rounded-3xl p-6 text-center shadow-xl">
            <div className="mx-auto mb-3.5 flex justify-center">
              <HealthRing score={average(Object.values(d?.scoresById ?? {}))} size={80} />
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
              Across {d?.totalPeople ?? 0} contacts
            </p>
          </div>
        </Section>
      </aside>

      {/* Contact stats drawer on dashboard */}
      {selectedPersonId && (
        <PersonPanel id={selectedPersonId} onClose={() => setSelectedPersonId(null)} />
      )}
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
          className={`font-semibold uppercase tracking-[0.2em] text-muted-foreground ${small ? "text-[9px]" : "text-[10px]"}`}
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
    <div className="size-10 rounded-2xl bg-surface-2 border border-border grid place-items-center font-bold text-xs text-foreground">
      {s}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass-panel rounded-3xl p-10 text-center relative overflow-hidden shadow-xl">
      <h3 className="font-semibold text-lg text-foreground mb-2">Your roster is empty.</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
        Add your first person to start tracking relationships. Once you have a few contacts, the
        Insights Engine will surface who to reach out to.
      </p>
      <Link
        to="/people"
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all hover:opacity-90 active:scale-95 shadow-lg"
      >
        Add someone
      </Link>
    </div>
  );
}
