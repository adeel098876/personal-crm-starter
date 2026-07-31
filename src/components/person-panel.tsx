import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPerson,
  deletePerson,
  addNote,
  deleteNote,
  addField,
  deleteField,
} from "@/lib/people.functions";
import { logInteraction } from "@/lib/interactions.functions";
import { createPromise, resolvePromise } from "@/lib/reminders.functions";
import { meetingPrep, summarizeNotes } from "@/lib/ai.functions";
import { HealthRing } from "@/components/health-ring";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

const INTERACTION_TYPES = [
  "call", "message", "meeting", "email", "coffee", "gift", "note", "milestone",
] as const;

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "··";
}

function Spinner() {
  return (
    <span className="inline-block size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
  );
}

function formatAgo(dateStr?: string) {
  if (!dateStr) return "recently";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "recently" : formatDistanceToNow(d, { addSuffix: true });
}

export function PersonPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [visible, setVisible] = useState(false);

  // Lock body scroll and trigger entrance animation
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(t);
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 320);
  };

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["person", id] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["people"] });
  };

  /* Server function hooks */
  const fetchPerson = useServerFn(getPerson);
  const removePerson = useServerFn(deletePerson);
  const logInt = useServerFn(logInteraction);
  const addN = useServerFn(addNote);
  const removeN = useServerFn(deleteNote);
  const addF = useServerFn(addField);
  const removeF = useServerFn(deleteField);
  const addProm = useServerFn(createPromise);
  const resolveProm = useServerFn(resolvePromise);
  const fetchBrief = useServerFn(meetingPrep);
  const fetchSummary = useServerFn(summarizeNotes);

  const q = useQuery({
    queryKey: ["person", id],
    queryFn: () => fetchPerson({ data: { id } }),
  });

  /* AI States */
  const [brief, setBrief] = useState<string | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [rawNotesText, setRawNotesText] = useState("");
  const [summaryResult, setSummaryResult] = useState<any>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);

  async function generateBrief() {
    setBriefBusy(true);
    try {
      const res = await fetchBrief({ data: { person_id: id } });
      setBrief(res.brief);
      toast.success("AI brief generated ✓");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Brief generation failed");
    } finally {
      setBriefBusy(false);
    }
  }

  async function runSummarize() {
    if (!rawNotesText.trim()) return;
    setSummaryBusy(true);
    try {
      const res = await fetchSummary({ data: { text: rawNotesText } });
      setSummaryResult(res);
      toast.success("Notes summarized ✓");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Summarization failed");
    } finally {
      setSummaryBusy(false);
    }
  }

  /* Mutations */
  const logMut = useMutation({
    mutationFn: (vars: { type: string; summary: string }) =>
      logInt({ data: { person_id: id, type: vars.type as any, summary: vars.summary } }),
    onSuccess: () => {
      toast.success("Interaction logged ✓");
      setIntSummary("");
      invalidate();
    },
    onError: (e) => toast.error(`Log failed: ${e instanceof Error ? e.message : "Unknown error"}`),
  });

  const noteMut = useMutation({
    mutationFn: (body: string) =>
      addN({ data: { person_id: id, body, pinned: false } }),
    onSuccess: () => {
      toast.success("Note saved ✓");
      setNoteBody("");
      invalidate();
    },
    onError: (e) => toast.error(`Save failed: ${e instanceof Error ? e.message : "Unknown error"}`),
  });

  const deleteNoteMut = useMutation({
    mutationFn: (noteId: string) => removeN({ data: { id: noteId } }),
    onSuccess: () => {
      toast.success("Note deleted");
      invalidate();
    },
    onError: (e) => toast.error(`Delete failed: ${e instanceof Error ? e.message : "Unknown error"}`),
  });

  const addFieldMut = useMutation({
    mutationFn: (vars: { category: string; key: string; value: string }) =>
      addF({ data: { person_id: id, category: vars.category, key: vars.key, value: vars.value || null } }),
    onSuccess: () => {
      toast.success("Field added ✓");
      setFieldKey("");
      setFieldValue("");
      invalidate();
    },
    onError: (e) => toast.error(`Add field failed: ${e instanceof Error ? e.message : "Unknown error"}`),
  });

  const deleteFieldMut = useMutation({
    mutationFn: (fieldId: string) => removeF({ data: { id: fieldId } }),
    onSuccess: () => {
      toast.success("Field removed");
      invalidate();
    },
    onError: (e) => toast.error(`Remove failed: ${e instanceof Error ? e.message : "Unknown error"}`),
  });

  const promiseMut = useMutation({
    mutationFn: (description: string) =>
      addProm({ data: { person_id: id, description } }),
    onSuccess: () => {
      toast.success("Promise added ✓");
      setPromiseText("");
      invalidate();
    },
    onError: (e) => toast.error(`Add promise failed: ${e instanceof Error ? e.message : "Unknown error"}`),
  });

  const keptMut = useMutation({
    mutationFn: (promiseId: string) =>
      resolveProm({ data: { id: promiseId, status: "kept" } }),
    onSuccess: () => {
      toast.success("Promise marked as kept ✓");
      invalidate();
    },
    onError: (e) => toast.error(`Update failed: ${e instanceof Error ? e.message : "Unknown error"}`),
  });

  const deleteMut = useMutation({
    mutationFn: () => removePerson({ data: { id } }),
    onSuccess: () => {
      toast.success("Contact deleted");
      invalidate();
      close();
    },
    onError: (e) => toast.error(`Delete failed: ${e instanceof Error ? e.message : "Unknown error"}`),
  });

  /* Local state */
  const [noteBody, setNoteBody] = useState("");
  const [intType, setIntType] = useState<(typeof INTERACTION_TYPES)[number]>("message");
  const [intSummary, setIntSummary] = useState("");
  const [fieldCategory, setFieldCategory] = useState("favorite");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldValue, setFieldValue] = useState("");
  const [promiseText, setPromiseText] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "notes" | "details">("overview");

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={close}
      />

      {/* Slide-over panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col shadow-2xl transition-transform duration-300 ease-out"
        style={{
          transform: visible ? "translateX(0)" : "translateX(100%)",
          background: "var(--glass-bg, rgba(10,10,15,0.92))",
          backdropFilter: "blur(40px) saturate(180%)",
          borderLeft: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Contact Details & Stats
          </p>
          <button
            onClick={close}
            className="size-7 rounded-full bg-surface-2 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {q.isLoading && (
            <div className="flex items-center justify-center h-32">
              <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )}
          {q.error && (
            <p className="p-6 text-sm text-destructive">{(q.error as Error).message}</p>
          )}
          {q.data && (() => {
            const { person, interactions, notes, fields, promises, health } = q.data;
            const normalizedNotes = notes.map((n: any) => ({
              ...n,
              body: n.body || n.content || "",
            }));

            return (
              <div className="p-6 space-y-6">
                {/* Hero */}
                <div className="flex items-center gap-4">
                  <div className="size-14 rounded-3xl bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/20 grid place-items-center text-lg font-bold text-primary shadow-lg shadow-primary/20">
                    {initials(person.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-primary">{person.relationship_type}</p>
                    <h2 className="text-xl font-extrabold tracking-tight text-foreground truncate">{person.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {[person.role, person.company].filter(Boolean).join(" · ") || "—"}
                      {person.location && ` · ${person.location}`}
                    </p>
                  </div>
                  <HealthRing score={health.score} size={52} />
                </div>

                {/* Stat blocks */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Last contact", value: health.daysSinceLastInteraction == null ? "Never" : `${health.daysSinceLastInteraction}d ago` },
                    { label: "Cadence", value: `every ${person.target_cadence_days}d` },
                    { label: "Birthday", value: person.birthday ? format(new Date(person.birthday), "MMM d") : "—" },
                    { label: "Open promises", value: String(promises.filter((p: any) => p.status === "open").length) },
                  ].map((s) => (
                    <div key={s.label} className="glass-panel rounded-2xl p-3.5 shadow-md">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                      <p className="mt-1 text-sm font-bold text-foreground">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-surface-2 rounded-2xl p-1">
                  {(["overview", "timeline", "notes", "details"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 text-[9px] font-bold uppercase tracking-wider py-2 rounded-xl transition-all duration-200 capitalize
                        ${activeTab === tab
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      {tab} {tab === "timeline" && `(${interactions.length})`}
                    </button>
                  ))}
                </div>

                {/* ── Tab: Overview ── */}
                {activeTab === "overview" && (
                  <div className="space-y-5">
                    {/* Groq AI Meeting Prep Brief */}
                    <div className="glass-panel bg-primary/[0.03] border border-primary/20 rounded-2xl p-4 shadow-md space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-primary animate-pulse" />
                          <h3 className="text-[9px] font-bold uppercase tracking-widest text-primary">Groq AI Meeting Brief</h3>
                        </div>
                        <button
                          onClick={generateBrief}
                          disabled={briefBusy}
                          className="text-[9px] font-bold uppercase tracking-wider text-primary hover:opacity-80 transition-opacity disabled:opacity-50 flex items-center gap-1"
                        >
                          {briefBusy ? <><Spinner /> Generating…</> : brief ? "Regenerate →" : "Generate Brief →"}
                        </button>
                      </div>
                      {brief ? (
                        <div className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap font-medium border-t border-border/50 pt-2.5">
                          {brief}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Generate an instant AI meeting brief analyzing timeline, notes, and open promises.
                        </p>
                      )}
                    </div>

                    {/* Log interaction */}
                    <div>
                      <h3 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Log Interaction</h3>
                      <div className="glass-panel rounded-2xl p-4 space-y-3 shadow-md">
                        <div className="flex gap-2">
                          <select
                            value={intType}
                            onChange={(e) => setIntType(e.target.value as any)}
                            className="glass-input rounded-xl px-3 py-2.5 text-xs capitalize focus:outline-none flex-shrink-0"
                          >
                            {INTERACTION_TYPES.map((t) => (
                              <option key={t} value={t} className="bg-popover text-popover-foreground">{t}</option>
                            ))}
                          </select>
                          <input
                            placeholder="What happened?"
                            value={intSummary}
                            onChange={(e) => setIntSummary(e.target.value)}
                            className="flex-1 glass-input rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && intSummary.trim() && !logMut.isPending)
                                logMut.mutate({ type: intType, summary: intSummary });
                            }}
                          />
                        </div>
                        <button
                          disabled={logMut.isPending || !intSummary.trim()}
                          onClick={() => logMut.mutate({ type: intType, summary: intSummary })}
                          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {logMut.isPending ? <><Spinner /> Logging…</> : "Log"}
                        </button>
                      </div>
                    </div>

                    {/* Recent Timeline Logs Preview */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Recent Activity Logs</h3>
                        {interactions.length > 3 && (
                          <button
                            onClick={() => setActiveTab("timeline")}
                            className="text-[9px] font-bold uppercase tracking-wider text-primary hover:opacity-80 transition-opacity"
                          >
                            View all ({interactions.length}) →
                          </button>
                        )}
                      </div>
                      <div className="glass-panel rounded-2xl p-4 shadow-md">
                        {interactions.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2 text-center">No interactions logged yet.</p>
                        ) : (
                          <div className="border-l border-border ml-2 pl-4 space-y-4 py-1">
                            {interactions.slice(0, 4).map((i: any) => (
                              <div key={i.id} className="relative">
                                <div className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary ring-4 ring-background" />
                                <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider">
                                  <span className="text-primary">{i.type}</span>
                                  <span className="text-muted-foreground font-mono">{formatAgo(i.occurred_at)}</span>
                                </div>
                                {i.summary && <p className="text-xs mt-1 leading-relaxed text-foreground font-medium">{i.summary}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Promises */}
                    <div>
                      <h3 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Promises</h3>
                      <div className="glass-panel rounded-2xl p-4 space-y-3 shadow-md">
                        <div className="flex gap-2">
                          <input
                            placeholder="I promised to…"
                            value={promiseText}
                            onChange={(e) => setPromiseText(e.target.value)}
                            className="flex-1 glass-input rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && promiseText.trim() && !promiseMut.isPending)
                                promiseMut.mutate(promiseText);
                            }}
                          />
                          <button
                            disabled={promiseMut.isPending || !promiseText.trim()}
                            onClick={() => promiseMut.mutate(promiseText)}
                            className="px-4 py-2 text-[9px] font-bold uppercase tracking-wider border border-border hover:bg-surface-2 rounded-full text-foreground transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {promiseMut.isPending ? <Spinner /> : "Add"}
                          </button>
                        </div>
                        <div className="divide-y divide-border">
                          {promises.map((p: any) => (
                            <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                              <span className={`text-xs font-medium ${p.status !== "open" ? "line-through text-muted-foreground/50" : "text-foreground"}`}>
                                {p.description}
                              </span>
                              {p.status === "open" && (
                                <button
                                  disabled={keptMut.isPending && keptMut.variables === p.id}
                                  onClick={() => keptMut.mutate(p.id)}
                                  className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1 hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                  {keptMut.isPending && keptMut.variables === p.id ? <Spinner /> : "Kept ✓"}
                                </button>
                              )}
                            </div>
                          ))}
                          {promises.length === 0 && (
                            <p className="text-xs text-muted-foreground py-2">No promises yet.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      disabled={deleteMut.isPending}
                      onClick={() => {
                        if (!confirm(`Delete ${person.name}? This can't be undone.`)) return;
                        deleteMut.mutate();
                      }}
                      className="w-full text-[10px] font-bold uppercase tracking-wider text-destructive border border-destructive/20 hover:bg-destructive/10 rounded-full py-3 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {deleteMut.isPending ? <><Spinner /> Deleting…</> : "Delete person"}
                    </button>
                  </div>
                )}

                {/* ── Tab: Timeline ── */}
                {activeTab === "timeline" && (
                  <div>
                    {interactions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No interactions logged yet.</p>
                    ) : (
                      <div className="border-l border-border ml-3 pl-5 space-y-5 py-1">
                        {interactions.map((i: any) => (
                          <div key={i.id} className="relative">
                            <div className="absolute -left-[27px] top-1.5 size-2 rounded-full bg-primary ring-4 ring-background" />
                            <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider">
                              <span className="text-primary">{i.type}</span>
                              <span className="text-muted-foreground font-mono">{formatAgo(i.occurred_at)}</span>
                            </div>
                            {i.summary && <p className="text-xs mt-1.5 leading-relaxed text-foreground font-medium">{i.summary}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Notes ── */}
                {activeTab === "notes" && (
                  <div className="space-y-4">
                    {/* Notes Input */}
                    <div className="glass-panel rounded-2xl p-4 space-y-3 shadow-md">
                      <textarea
                        rows={3}
                        placeholder="Add a note…"
                        value={noteBody}
                        onChange={(e) => setNoteBody(e.target.value)}
                        className="w-full glass-input rounded-xl p-3 text-xs text-foreground focus:outline-none resize-none"
                      />
                      <div className="flex justify-end">
                        <button
                          disabled={noteMut.isPending || !noteBody.trim()}
                          onClick={() => noteMut.mutate(noteBody)}
                          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                          {noteMut.isPending ? <><Spinner /> Saving…</> : "Save"}
                        </button>
                      </div>
                    </div>

                    {/* Groq AI Notes Summarizer */}
                    <div className="glass-panel border border-primary/20 bg-primary/[0.02] rounded-2xl p-4 space-y-3 shadow-md">
                      <h3 className="text-[9px] font-bold uppercase tracking-widest text-primary">Summarize Raw Notes with Groq AI</h3>
                      <textarea
                        rows={3}
                        placeholder="Paste raw unstructured meeting notes here to extract summary & action items…"
                        value={rawNotesText}
                        onChange={(e) => setRawNotesText(e.target.value)}
                        className="w-full glass-input rounded-xl p-3 text-xs font-mono text-foreground focus:outline-none resize-none"
                      />
                      <div className="flex justify-end">
                        <button
                          disabled={summaryBusy || !rawNotesText.trim()}
                          onClick={runSummarize}
                          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                          {summaryBusy ? <><Spinner /> Summarizing…</> : "Summarize with AI"}
                        </button>
                      </div>
                      {summaryResult && (
                        <div className="mt-3 space-y-3 text-xs border-t border-border/60 pt-3">
                          <div>
                            <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">AI Summary</p>
                            <p className="text-foreground mt-1 leading-relaxed font-medium">{summaryResult.summary}</p>
                          </div>
                          {summaryResult.actions?.length > 0 && (
                            <div>
                              <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">Action Items</p>
                              <ul className="list-disc pl-4 mt-1 space-y-1 text-foreground/90">
                                {summaryResult.actions.map((a: any, idx: number) => (
                                  <li key={idx}>
                                    <span className="text-primary font-bold">{a.owner}:</span> {a.description}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Saved Notes List */}
                    <div className="space-y-3">
                      {normalizedNotes.map((n: any) => (
                        <div key={n.id} className="glass-panel rounded-2xl p-4 relative shadow-md">
                          <div className="flex justify-between items-start gap-2">
                            <p className="whitespace-pre-wrap flex-1 text-xs text-foreground font-medium leading-relaxed">{n.body}</p>
                            <button
                              disabled={deleteNoteMut.isPending && deleteNoteMut.variables === n.id}
                              onClick={() => deleteNoteMut.mutate(n.id)}
                              className="size-6 rounded-full bg-surface-2 border border-border flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors text-sm flex-shrink-0 disabled:opacity-50"
                            >
                              {deleteNoteMut.isPending && deleteNoteMut.variables === n.id ? <Spinner /> : "×"}
                            </button>
                          </div>
                          <p className="text-[9px] font-semibold text-muted-foreground mt-2.5">{formatAgo(n.created_at)}</p>
                        </div>
                      ))}
                      {normalizedNotes.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No saved notes yet.</p>}
                    </div>
                  </div>
                )}

                {/* ── Tab: Details ── */}
                {activeTab === "details" && (
                  <div className="space-y-4">
                    <div className="glass-panel rounded-2xl p-4 space-y-3 shadow-md">
                      <div className="grid grid-cols-1 gap-2">
                        <select
                          value={fieldCategory}
                          onChange={(e) => setFieldCategory(e.target.value)}
                          className="glass-input rounded-xl px-3 py-2.5 text-xs capitalize focus:outline-none"
                        >
                          {["family", "pet", "favorite", "allergy", "interest", "custom"].map((c) => (
                            <option key={c} value={c} className="bg-popover text-popover-foreground">{c}</option>
                          ))}
                        </select>
                        <input
                          placeholder="Key (e.g. Spouse name)"
                          value={fieldKey}
                          onChange={(e) => setFieldKey(e.target.value)}
                          className="glass-input rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none"
                        />
                        <input
                          placeholder="Value"
                          value={fieldValue}
                          onChange={(e) => setFieldValue(e.target.value)}
                          className="glass-input rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none"
                        />
                      </div>
                      <button
                        disabled={addFieldMut.isPending || !fieldKey.trim()}
                        onClick={() => addFieldMut.mutate({ category: fieldCategory, key: fieldKey, value: fieldValue })}
                        className="w-full text-[10px] font-bold uppercase tracking-wider border border-border hover:bg-surface-2 rounded-full py-2 text-foreground transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {addFieldMut.isPending ? <><Spinner /> Adding…</> : "+ Add field"}
                      </button>
                    </div>
                    <div className="divide-y divide-border">
                      {fields.map((f: any) => (
                        <div key={f.id} className="flex justify-between items-baseline py-3 text-xs hover:bg-surface-2 rounded px-1 transition-colors">
                          <div className="min-w-0">
                            <span className="text-[8px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-md mr-2">{f.category}</span>
                            <span className="font-semibold text-foreground">{f.key}</span>
                            {f.value && <span className="text-muted-foreground ml-2 font-medium">{f.value}</span>}
                          </div>
                          <button
                            disabled={deleteFieldMut.isPending && deleteFieldMut.variables === f.id}
                            onClick={() => deleteFieldMut.mutate(f.id)}
                            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors ml-2 disabled:opacity-50"
                          >
                            {deleteFieldMut.isPending && deleteFieldMut.variables === f.id ? <Spinner /> : "×"}
                          </button>
                        </div>
                      ))}
                      {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No fields yet.</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}
