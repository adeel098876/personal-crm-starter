import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeReminder,
  createReminder,
  listReminders,
  snoozeReminder,
} from "@/lib/reminders.functions";
import { listPeople } from "@/lib/people.functions";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reminders")({
  component: RemindersPage,
});

function RemindersPage() {
  const qc = useQueryClient();
  const list = useServerFn(listReminders);
  const create = useServerFn(createReminder);
  const done = useServerFn(completeReminder);
  const snooze = useServerFn(snoozeReminder);
  const people = useServerFn(listPeople);

  const [tab, setTab] = useState<"open" | "done">("open");
  const q = useQuery({
    queryKey: ["reminders", tab],
    queryFn: () => list({ data: { status: tab } }),
  });
  const pplQuery = useQuery({
    queryKey: ["people-mini"],
    queryFn: () => people({ data: {} }),
  });

  const [title, setTitle] = useState("");
  const [due, setDue] = useState<string>(
    format(new Date(Date.now() + 86400000), "yyyy-MM-dd"),
  );
  const [personId, setPersonId] = useState<string>("");

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          title,
          due_at: new Date(due).toISOString(),
          person_id: personId || null,
          kind: "custom",
        },
      }),
    onSuccess: () => {
      setTitle("");
      toast.success("Reminder added");
      qc.invalidateQueries({ queryKey: ["reminders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Cadence
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight mt-1 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground">
          Reminders
        </h1>
      </header>

      <div className="glass-panel rounded-3xl p-6 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            placeholder="What to remember…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="md:col-span-2 glass-input rounded-2xl px-4 py-2.5 text-xs text-foreground focus:outline-none"
          />
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="glass-input rounded-2xl px-4 py-2.5 text-xs font-mono text-foreground focus:outline-none"
          />
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="glass-input rounded-2xl px-4 py-2.5 text-xs text-foreground focus:outline-none"
          >
            <option value="" className="bg-popover text-popover-foreground">— No person —</option>
            {pplQuery.data?.people.map((p: any) => (
              <option key={p.id} value={p.id} className="bg-popover text-popover-foreground">
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end pt-1">
          <button
            onClick={() => title.trim() && createMut.mutate()}
            disabled={createMut.isPending}
            className="bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-all hover:opacity-90 active:scale-95 shadow-md"
          >
            Add reminder
          </button>
        </div>
      </div>

      <div className="flex gap-2 text-[10px] font-semibold uppercase tracking-wider">
        {(["open", "done"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full border transition-all duration-200 ${
              tab === t
                ? "border-primary/40 bg-primary/10 text-primary font-bold shadow-sm"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden divide-y divide-border shadow-xl">
        {q.data?.reminders.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No {tab} reminders.
          </p>
        )}
        {q.data?.reminders.map((r: any) => (
          <div key={r.id} className="p-4.5 flex items-center justify-between gap-4 hover:bg-surface-2 transition-colors">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{r.title}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                {r.people?.name ?? "General"} · {format(new Date(r.due_at), "MMM d, yyyy")}
              </p>
            </div>
            {tab === "open" && (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={async () => {
                    await done({ data: { id: r.id } });
                    qc.invalidateQueries({ queryKey: ["reminders"] });
                    qc.invalidateQueries({ queryKey: ["dashboard"] });
                  }}
                  className="text-[9px] font-bold uppercase tracking-wider text-primary border border-primary/20 bg-primary/10 rounded-full px-3.5 py-1.5 hover:bg-primary hover:text-primary-foreground transition-all active:scale-95"
                >
                  Done
                </button>
                <button
                  onClick={async () => {
                    await snooze({ data: { id: r.id, days: 7 } });
                    qc.invalidateQueries({ queryKey: ["reminders"] });
                  }}
                  className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground border border-border bg-surface rounded-full px-3.5 py-1.5 hover:bg-surface-2 hover:text-foreground transition-all active:scale-95"
                >
                  +7d
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}