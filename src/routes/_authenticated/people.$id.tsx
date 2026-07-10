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

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
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
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-12 lg:col-span-8 space-y-8">
        <header className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-full bg-surface border border-border grid place-items-center text-lg font-mono">
              {initials(person.name)}
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                {person.relationship_type}
              </p>
              <h1 className="text-3xl font-bold tracking-tight">{person.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {[person.role, person.company].filter(Boolean).join(" · ") || "—"}
                {person.location && ` · ${person.location}`}
              </p>
            </div>
          </div>
          <HealthRing score={health.score} size={64} />
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
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
        <section className="bg-accent/[0.03] border border-accent/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-accent">
              Meeting prep
            </h2>
            <button
              onClick={runBrief}
              disabled={briefBusy}
              className="text-[10px] font-mono uppercase tracking-widest text-accent hover:underline underline-offset-4 disabled:opacity-30"
            >
              {briefBusy ? "Thinking…" : brief ? "Regenerate →" : "Generate →"}
            </button>
          </div>
          {brief ? (
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{brief}</div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Generate an AI brief combining profile, timeline, notes, and open promises.
            </p>
          )}
        </section>

        {/* Log interaction */}
        <section>
          <h2 className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Log interaction
          </h2>
          <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
            <div className="flex gap-2">
              <select
                value={intType}
                onChange={(e) => setIntType(e.target.value as any)}
                className="bg-background border border-border rounded px-2 py-1.5 text-xs capitalize"
              >
                {INTERACTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input
                placeholder="Summary (e.g. discussed Berlin move)"
                value={intSummary}
                onChange={(e) => setIntSummary(e.target.value)}
                className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-sm"
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
                className="bg-foreground text-background px-4 py-1.5 rounded text-xs font-bold uppercase tracking-widest"
              >
                Log
              </button>
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section>
          <h2 className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Timeline
          </h2>
          {interactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interactions logged yet.</p>
          ) : (
            <div className="border-l border-border ml-2 pl-6 space-y-5">
              {interactions.map((i) => (
                <div key={i.id} className="relative">
                  <div className="absolute -left-[31px] top-1.5 size-2 rounded-full bg-accent ring-4 ring-background" />
                  <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest">
                    <span className="text-accent">{i.type}</span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(i.occurred_at), { addSuffix: true })}
                    </span>
                  </div>
                  {i.summary && <p className="text-sm mt-1 leading-relaxed">{i.summary}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Auto-summarize notes */}
        <section className="bg-surface border border-border rounded-lg p-5">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Summarize raw notes with AI
          </h2>
          <textarea
            rows={4}
            placeholder="Paste raw meeting notes…"
            value={rawNotes}
            onChange={(e) => setRawNotes(e.target.value)}
            className="w-full bg-background border border-border rounded p-3 text-sm font-mono"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={runSummarize}
              disabled={summaryBusy}
              className="text-xs font-bold uppercase tracking-widest bg-foreground text-background px-3 py-1.5 rounded disabled:opacity-50"
            >
              {summaryBusy ? "Summarizing…" : "Summarize"}
            </button>
          </div>
          {summaryResult && (
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Summary
                </p>
                <p>{summaryResult.summary}</p>
              </div>
              {summaryResult.actions?.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    Actions
                  </p>
                  <ul className="list-disc pl-5">
                    {summaryResult.actions.map((a: any, i: number) => (
                      <li key={i}>
                        <span className="text-accent">{a.owner}:</span> {a.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <aside className="col-span-12 lg:col-span-4 space-y-6">
        {/* Notes */}
        <section>
          <h2 className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Notes
          </h2>
          <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
            <textarea
              rows={3}
              placeholder="Add a note (markdown ok)…"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              className="w-full bg-background border border-border rounded p-2 text-sm"
            />
            <div className="flex justify-end">
              <button
                onClick={async () => {
                  if (!noteBody.trim()) return;
                  await addN({ data: { person_id: id, body: noteBody, pinned: false } });
                  setNoteBody("");
                  invalidate();
                }}
                className="text-xs font-bold uppercase tracking-widest bg-foreground text-background px-3 py-1.5 rounded"
              >
                Save note
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="bg-surface border border-border rounded-lg p-3 text-sm">
                <div className="flex justify-between items-start gap-2">
                  <p className="whitespace-pre-wrap flex-1">{n.body}</p>
                  <button
                    onClick={async () => {
                      await removeN({ data: { id: n.id } });
                      invalidate();
                    }}
                    className="text-[10px] font-mono text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground mt-2">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Structured fields */}
        <section>
          <h2 className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Details
          </h2>
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="grid grid-cols-3 gap-1 mb-3">
              <select
                value={fieldCategory}
                onChange={(e) => setFieldCategory(e.target.value)}
                className="bg-background border border-border rounded px-2 py-1 text-xs capitalize"
              >
                {["family", "pet", "favorite", "allergy", "interest", "custom"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                placeholder="Key"
                value={fieldKey}
                onChange={(e) => setFieldKey(e.target.value)}
                className="bg-background border border-border rounded px-2 py-1 text-xs"
              />
              <input
                placeholder="Value"
                value={fieldValue}
                onChange={(e) => setFieldValue(e.target.value)}
                className="bg-background border border-border rounded px-2 py-1 text-xs"
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
              className="w-full text-[10px] font-mono uppercase tracking-widest border border-border rounded py-1 hover:bg-background"
            >
              + Add field
            </button>
            <div className="mt-3 divide-y divide-border">
              {fields.map((f) => (
                <div
                  key={f.id}
                  className="flex justify-between items-baseline py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mr-2">
                      {f.category}
                    </span>
                    <span className="font-medium">{f.key}</span>
                    {f.value && <span className="text-muted-foreground ml-2">{f.value}</span>}
                  </div>
                  <button
                    onClick={async () => {
                      await removeF({ data: { id: f.id } });
                      invalidate();
                    }}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Promises */}
        <section>
          <h2 className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Promises
          </h2>
          <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
            <div className="flex gap-2">
              <input
                placeholder="I promised to…"
                value={promiseText}
                onChange={(e) => setPromiseText(e.target.value)}
                className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-sm"
              />
              <button
                onClick={async () => {
                  if (!promiseText.trim()) return;
                  await addProm({ data: { person_id: id, description: promiseText } });
                  setPromiseText("");
                  invalidate();
                }}
                className="text-[10px] font-mono uppercase tracking-widest border border-border rounded px-2"
              >
                Add
              </button>
            </div>
            <div className="divide-y divide-border">
              {promises.map((p) => (
                <div key={p.id} className="py-2 flex items-center justify-between gap-2">
                  <span
                    className={`text-sm ${p.status !== "open" ? "line-through text-muted-foreground" : ""}`}
                  >
                    {p.description}
                  </span>
                  {p.status === "open" && (
                    <button
                      onClick={async () => {
                        await resolveProm({ data: { id: p.id, status: "kept" } });
                        invalidate();
                      }}
                      className="text-[10px] font-mono uppercase tracking-widest text-accent bg-accent/10 border border-accent/20 rounded px-2 py-0.5"
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
            className="w-full text-xs font-mono uppercase tracking-widest text-destructive border border-destructive/30 rounded py-2 hover:bg-destructive/10"
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
    <div className="bg-surface border border-border rounded-lg p-3">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{children}</p>
    </div>
  );
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "··";
}