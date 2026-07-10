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
    <div className="space-y-6 max-w-3xl">
      <header>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Cadence
        </p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Reminders</h1>
      </header>

      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            placeholder="What to remember"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="md:col-span-2 bg-background border border-border rounded px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="bg-background border border-border rounded px-3 py-2 text-sm font-mono"
          />
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="bg-background border border-border rounded px-3 py-2 text-sm"
          >
            <option value="">— No person —</option>
            {pplQuery.data?.people.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end mt-3">
          <button
            onClick={() => title.trim() && createMut.mutate()}
            disabled={createMut.isPending}
            className="bg-foreground text-background px-4 py-1.5 rounded text-xs font-bold uppercase tracking-widest disabled:opacity-50"
          >
            Add reminder
          </button>
        </div>
      </div>

      <div className="flex gap-1 text-xs font-mono uppercase tracking-widest">
        {(["open", "done"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded border ${tab === t ? "border-accent/40 text-accent" : "border-border text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-lg divide-y divide-border">
        {q.data?.reminders.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No {tab} reminders.
          </p>
        )}
        {q.data?.reminders.map((r: any) => (
          <div key={r.id} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm truncate">{r.title}</p>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
                {r.people?.name ?? "General"} · {format(new Date(r.due_at), "MMM d, yyyy")}
              </p>
            </div>
            {tab === "open" && (
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={async () => {
                    await done({ data: { id: r.id } });
                    qc.invalidateQueries({ queryKey: ["reminders"] });
                    qc.invalidateQueries({ queryKey: ["dashboard"] });
                  }}
                  className="text-[10px] font-mono uppercase tracking-widest text-accent border border-accent/20 bg-accent/10 rounded px-2 py-1"
                >
                  Done
                </button>
                <button
                  onClick={async () => {
                    await snooze({ data: { id: r.id, days: 7 } });
                    qc.invalidateQueries({ queryKey: ["reminders"] });
                  }}
                  className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border border-border rounded px-2 py-1"
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