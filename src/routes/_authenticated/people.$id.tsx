import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addField,
  addNote,
  deleteField,
  deleteNote,
  deletePerson,
  getPerson,
  updatePerson,
} from "@/lib/people.functions";
import { logInteraction } from "@/lib/interactions.functions";
import { createPromise, resolvePromise } from "@/lib/reminders.functions";
import { meetingPrep, summarizeNotes } from "@/lib/ai.functions";
import { HealthRing } from "@/components/health-ring";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/people/$id")({
  component: PersonPage,
});

const INTERACTION_TYPES = [
  "call",
  "message",
  "meeting",
  "email",
  "coffee",
  "gift",
  "note",
  "milestone",
] as const;

function PersonPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetch = useServerFn(getPerson);
  const update = useServerFn(updatePerson);
  const remove = useServerFn(deletePerson);
  const logInt = useServerFn(logInteraction);
  const addN = useServerFn(addNote);
  const removeN = useServerFn(deleteNote);
  const addF = useServerFn(addField);
  const removeF = useServerFn(deleteField);
  const addProm = useServerFn(createPromise);
  const resolveProm = useServerFn(resolvePromise);
  const prep = useServerFn(meetingPrep);
  const summarize = useServerFn(summarizeNotes);

  const q = useQuery({
    queryKey: ["person", id],
    queryFn: () => fetch({ data: { id } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["person", id] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const [noteBody, setNoteBody] = useState("");
  const [intType, setIntType] = useState<(typeof INTERACTION_TYPES)[number]>("message");
  const [intSummary, setIntSummary] = useState("");
  const [fieldCategory, setFieldCategory] = useState("favorite");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldValue, setFieldValue] = useState("");
  const [promiseText, setPromiseText] = useState("");
  const [rawNotes, setRawNotes] = useState("");
  const [brief, setBrief] = useState<string | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [summaryResult, setSummaryResult] = useState<any>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);

  if (q.isLoading)
    return <p className="text-sm text-muted-foreground animate-pulse">Loading contact details…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  if (!q.data) return null;

  const { person, interactions, notes, fields, promises, health } = q.data;

  async function runBrief() {
    setBriefBusy(true);
    try {
      const r = await prep({ data: { person_id: id } });
      setBrief(r.brief);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBriefBusy(false);
    }
  }

  async function runSummarize() {
    if (!rawNotes.trim()) return;
    setSummaryBusy(true);
    try {
      const r = await summarize({ data: { text: rawNotes } });
      setSummaryResult(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSummaryBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-12 gap-8 max-w-5xl mx-auto">
      <div className="col-span-12 lg:col-span-8 space-y-8">
        <header className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4.5">
            <div className="size-16 rounded-3xl bg-surface-2 border border-border grid place-items-center text-xl font-bold text-foreground shadow-md">
              {initials(person.name)}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
                {person.relationship_type}
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-0.5">
                {person.name}
              </h1>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                {[person.role, person.company].filter(Boolean).join(" · ") || "—"}
                {person.location && ` · ${person.location}`}
              </p>
            </div>
          </div>
          <div className="flex items-center">
            <HealthRing score={health.score} size={64} />
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBlock label="Last contact">
            {health.daysSinceLastInteraction == null
              ? "Never"
              : `${health.daysSinceLastInteraction}d ago`}
          </StatBlock>
          <StatBlock label="Cadence">every {person.target_cadence_days}d</StatBlock>
          <StatBlock label="Birthday">
            {person.birthday ? format(new Date(person.birthday), "MMM d") : "—"}
          </StatBlock>
          <StatBlock label="Open promises">
            {promises.filter((p) => p.status === "open").length}
          </StatBlock>
        </div>

        {/* Meeting prep */}
        <section className="glass-panel bg-primary/[0.02] border-primary/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
              Meeting prep
            </h2>
            <button
              onClick={runBrief}
              disabled={briefBusy}
              className="text-[10px] font-bold uppercase tracking-wider text-primary hover:opacity-80 transition-colors disabled:opacity-30"
            >
              {briefBusy ? "Thinking…" : brief ? "Regenerate →" : "Generate →"}
            </button>
          </div>
          {brief ? (
            <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {brief}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Generate an AI brief combining profile, timeline, notes, and open promises.
            </p>
          )}
        </section>

        {/* Log interaction */}
        <section className="space-y-3.5">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground pl-1">
            Log interaction
          </h2>
          <div className="glass-panel rounded-3xl p-5 shadow-lg">
            <div className="flex gap-2.5 flex-col sm:flex-row">
              <select
                value={intType}
                onChange={(e) => setIntType(e.target.value as any)}
                className="glass-input rounded-2xl px-4.5 py-3 text-xs capitalize focus:outline-none"
              >
                {INTERACTION_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-popover text-popover-foreground">
                    {t}
                  </option>
                ))}
              </select>
              <input
                placeholder="Summary (e.g. discussed Berlin move)"
                value={intSummary}
                onChange={(e) => setIntSummary(e.target.value)}
                className="flex-1 glass-input rounded-2xl px-4 py-3 text-xs text-foreground focus:outline-none"
              />
              <button
                onClick={async () => {
                  if (!intSummary.trim()) return;
                  await logInt({
                    data: { person_id: id, type: intType, summary: intSummary },
                  });
                  setIntSummary("");
                  invalidate();
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-3 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-md"
              >
                Log
              </button>
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground pl-1">
            Timeline
          </h2>
          {interactions.length === 0 ? (
            <div className="glass-panel p-6 rounded-3xl text-center">
              <p className="text-sm text-muted-foreground">No interactions logged yet.</p>
            </div>
          ) : (
            <div className="border-l border-border ml-3 pl-6 space-y-6 relative py-1">
              {interactions.map((i) => (
                <div key={i.id} className="relative">
                  <div className="absolute -left-[31px] top-1.5 size-2 rounded-full bg-primary ring-4 ring-background" />
                  <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider">
                    <span className="text-primary">{i.type}</span>
                    <span className="text-muted-foreground font-medium">
                      {formatDistanceToNow(new Date(i.occurred_at), { addSuffix: true })}
                    </span>
                  </div>
                  {i.summary && (
                    <p className="text-sm mt-1.5 leading-relaxed text-foreground font-medium">
                      {i.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Auto-summarize notes */}
        <section className="glass-panel rounded-3xl p-5 space-y-4 shadow-xl">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground pl-1">
            Summarize raw notes with AI
          </h2>
          <textarea
            rows={4}
            placeholder="Paste raw meeting notes…"
            value={rawNotes}
            onChange={(e) => setRawNotes(e.target.value)}
            className="w-full glass-input rounded-2xl p-4 text-xs font-mono text-foreground focus:outline-none"
          />
          <div className="flex justify-end">
            <button
              onClick={runSummarize}
              disabled={summaryBusy}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              {summaryBusy ? "Summarizing…" : "Summarize"}
            </button>
          </div>
          {summaryResult && (
            <div className="mt-4 space-y-4 text-sm border-t border-border pt-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Summary
                </p>
                <p className="text-foreground mt-1 leading-relaxed font-medium">
                  {summaryResult.summary}
                </p>
              </div>
              {summaryResult.actions?.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </p>
                  <ul className="list-disc pl-5 mt-1.5 space-y-1.5 text-foreground/90">
                    {summaryResult.actions.map((a: any, i: number) => (
                      <li key={i} className="text-xs">
                        <span className="text-primary font-bold">{a.owner}:</span> {a.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <aside className="col-span-12 lg:col-span-4 space-y-8">
        {/* Notes */}
        <section className="space-y-3.5">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground pl-1">
            Notes
          </h2>
          <div className="glass-panel rounded-3xl p-5 space-y-3 shadow-lg">
            <textarea
              rows={3}
              placeholder="Add a note…"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              className="w-full glass-input rounded-2xl p-3 text-xs text-foreground focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                onClick={async () => {
                  if (!noteBody.trim()) return;
                  await addN({ data: { person_id: id, body: noteBody, pinned: false } });
                  setNoteBody("");
                  invalidate();
                }}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-md"
              >
                Save note
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {notes.map((n) => (
              <div
                key={n.id}
                className="glass-panel rounded-3xl p-4.5 text-sm relative group shadow-md"
              >
                <div className="flex justify-between items-start gap-2">
                  <p className="whitespace-pre-wrap flex-1 text-foreground font-medium text-xs leading-relaxed">
                    {n.body}
                  </p>
                  <button
                    onClick={async () => {
                      await removeN({ data: { id: n.id } });
                      invalidate();
                    }}
                    className="size-6 rounded-full bg-surface-2 border border-border items-center justify-center text-muted-foreground hover:text-destructive flex transition-colors text-xs"
                  >
                    ×
                  </button>
                </div>
                <p className="text-[9px] font-semibold tracking-wide text-muted-foreground mt-3.5">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Structured fields */}
        <section className="space-y-3.5">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground pl-1">
            Details
          </h2>
          <div className="glass-panel rounded-3xl p-5 space-y-4 shadow-lg">
            <div className="grid grid-cols-1 gap-2.5">
              <select
                value={fieldCategory}
                onChange={(e) => setFieldCategory(e.target.value)}
                className="glass-input rounded-2xl px-4 py-2.5 text-xs capitalize focus:outline-none"
              >
                {["family", "pet", "favorite", "allergy", "interest", "custom"].map((c) => (
                  <option key={c} value={c} className="bg-popover text-popover-foreground">
                    {c}
                  </option>
                ))}
              </select>
              <input
                placeholder="Key (e.g. Spouse name)"
                value={fieldKey}
                onChange={(e) => setFieldKey(e.target.value)}
                className="glass-input rounded-2xl px-4 py-2.5 text-xs text-foreground focus:outline-none"
              />
              <input
                placeholder="Value"
                value={fieldValue}
                onChange={(e) => setFieldValue(e.target.value)}
                className="glass-input rounded-2xl px-4 py-2.5 text-xs text-foreground focus:outline-none"
              />
            </div>
            <button
              onClick={async () => {
                if (!fieldKey.trim()) return;
                await addF({
                  data: {
                    person_id: id,
                    category: fieldCategory,
                    key: fieldKey,
                    value: fieldValue || null,
                  },
                });
                setFieldKey("");
                setFieldValue("");
                invalidate();
              }}
              className="w-full text-[10px] font-bold uppercase tracking-wider border border-border hover:bg-surface-2 rounded-full py-2 text-foreground transition-all active:scale-95"
            >
              + Add field
            </button>
            <div className="mt-4 divide-y divide-border">
              {fields.map((f) => (
                <div
                  key={f.id}
                  className="flex justify-between items-baseline py-3 text-xs hover:bg-surface-2 transition-colors rounded px-1"
                >
                  <div className="min-w-0">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-md mr-2">
                      {f.category}
                    </span>
                    <span className="font-semibold text-foreground">{f.key}</span>
                    {f.value && (
                      <span className="text-muted-foreground ml-2 font-medium">{f.value}</span>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      await removeF({ data: { id: f.id } });
                      invalidate();
                    }}
                    className="text-[10px] text-muted-foreground hover:text-destructive transition-colors ml-2"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Promises */}
        <section className="space-y-3.5">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground pl-1">
            Promises
          </h2>
          <div className="glass-panel rounded-3xl p-5 space-y-4 shadow-lg">
            <div className="flex gap-2">
              <input
                placeholder="I promised to…"
                value={promiseText}
                onChange={(e) => setPromiseText(e.target.value)}
                className="flex-1 glass-input rounded-2xl px-4 py-2.5 text-xs text-foreground focus:outline-none"
              />
              <button
                onClick={async () => {
                  if (!promiseText.trim()) return;
                  await addProm({ data: { person_id: id, description: promiseText } });
                  setPromiseText("");
                  invalidate();
                }}
                className="text-[10px] font-bold uppercase tracking-wider border border-border hover:bg-surface-2 rounded-full px-4.5 text-foreground transition-all active:scale-95"
              >
                Add
              </button>
            </div>
            <div className="divide-y divide-border">
              {promises.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-medium ${p.status !== "open" ? "line-through text-muted-foreground/50" : "text-foreground"}`}
                  >
                    {p.description}
                  </span>
                  {p.status === "open" && (
                    <button
                      onClick={async () => {
                        await resolveProm({ data: { id: p.id, status: "kept" } });
                        invalidate();
                      }}
                      className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1 hover:bg-primary hover:text-primary-foreground transition-all active:scale-95"
                    >
                      Kept
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <button
            onClick={async () => {
              if (!confirm(`Delete ${person.name}? This can't be undone.`)) return;
              await remove({ data: { id } });
              qc.invalidateQueries({ queryKey: ["people"] });
              qc.invalidateQueries({ queryKey: ["dashboard"] });
              toast.success("Deleted");
              navigate({ to: "/people" });
            }}
            className="w-full text-xs font-bold uppercase tracking-wider text-destructive border border-destructive/20 hover:bg-destructive/10 rounded-full py-3.5 transition-all duration-200 active:scale-95"
          >
            Delete person
          </button>
        </section>
      </aside>
    </div>
  );
}

function StatBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-3xl p-4 shadow-lg">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-foreground leading-tight">{children}</p>
    </div>
  );
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "··";
}
