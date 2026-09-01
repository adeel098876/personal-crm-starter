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
import {
  meetingPrep,
  summarizeNotes,
  getConversationStarters,
  draftMessage,
  diagnoseRelationship,
} from "@/lib/ai.functions";
import { HealthRing } from "@/components/health-ring";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

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

const DRAFT_OCCASIONS = [
  { value: "birthday", label: "🎂 Birthday" },
  { value: "checkin", label: "👋 Check-in" },
  { value: "followup", label: "🔄 Follow-up" },
  { value: "thankyou", label: "🙏 Thank you" },
  { value: "congratulations", label: "🎉 Congrats" },
  { value: "apology", label: "💙 Apology" },
] as const;

type DraftOccasion = (typeof DRAFT_OCCASIONS)[number]["value"];
type DraftTone = "warm" | "professional" | "casual";

interface SummaryAction {
  owner: string;
  description: string;
}
interface SummaryResult {
  summary: string;
  actions: SummaryAction[];
  follow_ups: Array<{ title: string; when: string }>;
}
interface ConversationStarter {
  opener: string;
  context: string;
  tone: "warm" | "professional" | "playful";
}
interface DiagnosisResult {
  score_label: string;
  summary: string;
  strengths: string[];
  risks: string[];
  top_action: string;
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "··";
}

function Spinner({ size = 3 }: { size?: number }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-current border-t-transparent animate-spin`}
      style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
    />
  );
}

function AiCard({
  title,
  icon,
  children,
  accent = false,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 space-y-3 shadow-md border ${
        accent ? "bg-primary/[0.04] border-primary/25" : "glass-panel border-border/60"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <h3 className="text-[9px] font-bold uppercase tracking-widest text-primary">{title}</h3>
        <span className="ml-auto size-1.5 rounded-full bg-primary animate-pulse" />
      </div>
      {children}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-[9px] font-bold uppercase tracking-wider text-primary border border-primary/20 bg-primary/10 rounded-full px-3 py-1 hover:bg-primary hover:text-primary-foreground transition-all active:scale-95"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
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

  useEffect(() => {
    const scrollY = window.scrollY;
    const origOverflow = document.body.style.overflow;
    const origPosition = document.body.style.position;
    const origTop = document.body.style.top;
    const origWidth = document.body.style.width;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    const t = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(t);
      document.body.style.position = origPosition;
      document.body.style.top = origTop;
      document.body.style.width = origWidth;
      document.body.style.overflow = origOverflow;
      window.scrollTo({ top: scrollY, behavior: "instant" });
    };
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 320);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [close]);

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
  const fetchStarters = useServerFn(getConversationStarters);
  const fetchDraft = useServerFn(draftMessage);
  const fetchDiagnosis = useServerFn(diagnoseRelationship);

  const q = useQuery({
    queryKey: ["person", id],
    queryFn: () => fetchPerson({ data: { id } }),
  });

  /* AI state */
  const [brief, setBrief] = useState<string | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [rawNotesText, setRawNotesText] = useState("");
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [starters, setStarters] = useState<ConversationStarter[] | null>(null);
  const [startersBusy, setStartersBusy] = useState(false);
  const [draftOccasion, setDraftOccasion] = useState<DraftOccasion>("checkin");
  const [draftTone, setDraftTone] = useState<DraftTone>("warm");
  const [draftExtra, setDraftExtra] = useState("");
  const [draftText, setDraftText] = useState<string | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [diagnosisBusy, setDiagnosisBusy] = useState(false);

  async function generateBrief() {
    setBriefBusy(true);
    setBrief(null);
    try {
      const res = await fetchBrief({ data: { person_id: id } });
      setBrief(res.brief);
      toast.success("Meeting brief generated ✓");
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

  async function generateStarters() {
    setStartersBusy(true);
    setStarters(null);
    try {
      const res = await fetchStarters({ data: { person_id: id } });
      setStarters(res.starters);
      toast.success("Conversation starters ready ✓");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate starters");
    } finally {
      setStartersBusy(false);
    }
  }

  async function generateDraft() {
    setDraftBusy(true);
    setDraftText(null);
    try {
      const res = await fetchDraft({
        data: {
          person_id: id,
          occasion: draftOccasion,
          tone: draftTone,
          extra_context: draftExtra || undefined,
        },
      });
      setDraftText(res.message);
      toast.success("Message drafted ✓");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDraftBusy(false);
    }
  }

  async function runDiagnosis() {
    setDiagnosisBusy(true);
    setDiagnosis(null);
    try {
      const res = await fetchDiagnosis({ data: { person_id: id } });
      setDiagnosis(res);
      toast.success("Relationship diagnosis ready ✓");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Diagnosis failed");
    } finally {
      setDiagnosisBusy(false);
    }
  }

  /* Mutations */
  const [noteBody, setNoteBody] = useState("");
  const [intType, setIntType] = useState<(typeof INTERACTION_TYPES)[number]>("message");
  const [intSummary, setIntSummary] = useState("");
  const [fieldCategory, setFieldCategory] = useState("favorite");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldValue, setFieldValue] = useState("");
  const [promiseText, setPromiseText] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "notes" | "ai" | "details">(
    "overview",
  );

  const logMut = useMutation({
    mutationFn: (vars: { type: (typeof INTERACTION_TYPES)[number]; summary: string }) =>
      logInt({ data: { person_id: id, type: vars.type, summary: vars.summary } }),
    onSuccess: () => {
      toast.success("Interaction logged ✓");
      setIntSummary("");
      invalidate();
    },
    onError: (e) => toast.error(`Log failed: ${e instanceof Error ? e.message : "Error"}`),
  });

  const noteMut = useMutation({
    mutationFn: (body: string) => addN({ data: { person_id: id, body, pinned: false } }),
    onSuccess: () => {
      toast.success("Note saved ✓");
      setNoteBody("");
      invalidate();
    },
    onError: (e) => toast.error(`Save failed: ${e instanceof Error ? e.message : "Error"}`),
  });

  const deleteNoteMut = useMutation({
    mutationFn: (noteId: string) => removeN({ data: { id: noteId } }),
    onSuccess: () => {
      toast.success("Note deleted");
      invalidate();
    },
    onError: (e) => toast.error(`Delete failed: ${e instanceof Error ? e.message : "Error"}`),
  });

  const addFieldMut = useMutation({
    mutationFn: (vars: { category: string; key: string; value: string }) =>
      addF({
        data: { person_id: id, category: vars.category, key: vars.key, value: vars.value || null },
      }),
    onSuccess: () => {
      toast.success("Field added ✓");
      setFieldKey("");
      setFieldValue("");
      invalidate();
    },
    onError: (e) => toast.error(`Add field failed: ${e instanceof Error ? e.message : "Error"}`),
  });

  const deleteFieldMut = useMutation({
    mutationFn: (fieldId: string) => removeF({ data: { id: fieldId } }),
    onSuccess: () => {
      toast.success("Field removed");
      invalidate();
    },
    onError: (e) => toast.error(`Remove failed: ${e instanceof Error ? e.message : "Error"}`),
  });

  const promiseMut = useMutation({
    mutationFn: (description: string) => addProm({ data: { person_id: id, description } }),
    onSuccess: () => {
      toast.success("Promise added ✓");
      setPromiseText("");
      invalidate();
    },
    onError: (e) => toast.error(`Add promise failed: ${e instanceof Error ? e.message : "Error"}`),
  });

  const keptMut = useMutation({
    mutationFn: (promiseId: string) => resolveProm({ data: { id: promiseId, status: "kept" } }),
    onSuccess: () => {
      toast.success("Promise marked as kept ✓");
      invalidate();
    },
    onError: (e) => toast.error(`Update failed: ${e instanceof Error ? e.message : "Error"}`),
  });

  const deleteMut = useMutation({
    mutationFn: () => removePerson({ data: { id } }),
    onSuccess: () => {
      toast.success("Contact deleted");
      invalidate();
      close();
    },
    onError: (e) => toast.error(`Delete failed: ${e instanceof Error ? e.message : "Error"}`),
  });

  const diagnosisColors: Record<string, string> = {
    Thriving: "text-emerald-400",
    Healthy: "text-green-400",
    Drifting: "text-amber-400",
    "At Risk": "text-orange-400",
    Dormant: "text-red-400",
  };

  const TABS = ["overview", "timeline", "notes", "ai", "details"] as const;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={close}
      />

      {/* Slide-over */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col shadow-2xl transition-transform duration-300 ease-out"
        style={{
          transform: visible ? "translateX(0)" : "translateX(100%)",
          background: "var(--glass-bg, rgba(10,10,15,0.93))",
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {q.isLoading && (
            <div className="flex items-center justify-center h-32">
              <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )}
          {q.error && <p className="p-6 text-sm text-destructive">{(q.error as Error).message}</p>}
          {q.data &&
            (() => {
              const { person, interactions, notes, fields, promises, health } = q.data;
              const normalizedNotes = notes.map((n) => ({
                ...n,
                body: n.body || "",
              }));

              return (
                <div className="p-6 space-y-6">
                  {/* Hero */}
                  <div className="flex items-center gap-4">
                    <div className="size-14 rounded-3xl bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/20 grid place-items-center text-lg font-bold text-primary shadow-lg shadow-primary/20">
                      {initials(person.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-primary">
                        {person.relationship_type}
                      </p>
                      <h2 className="text-xl font-extrabold tracking-tight text-foreground truncate">
                        {person.name}
                      </h2>
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
                      {
                        label: "Last contact",
                        value:
                          health.daysSinceLastInteraction == null
                            ? "Never"
                            : `${health.daysSinceLastInteraction}d ago`,
                      },
                      { label: "Cadence", value: `every ${person.target_cadence_days}d` },
                      {
                        label: "Birthday",
                        value: person.birthday ? format(new Date(person.birthday), "MMM d") : "—",
                      },
                      {
                        label: "Open promises",
                        value: String(promises.filter((p) => p.status === "open").length),
                      },
                    ].map((s) => (
                      <div key={s.label} className="glass-panel rounded-2xl p-3.5 shadow-md">
                        <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
                          {s.label}
                        </p>
                        <p className="mt-1 text-sm font-bold text-foreground">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 bg-surface-2 rounded-2xl p-1">
                    {TABS.map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 text-[8px] font-bold uppercase tracking-wider py-2 rounded-xl transition-all duration-200 capitalize
                        ${
                          activeTab === tab
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab === "timeline"
                          ? `Log (${interactions.length})`
                          : tab === "ai"
                            ? "✨ AI"
                            : tab}
                      </button>
                    ))}
                  </div>

                  {/* ── Overview ── */}
                  {activeTab === "overview" && (
                    <div className="space-y-5">
                      {/* Log interaction */}
                      <div>
                        <h3 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                          Log Interaction
                        </h3>
                        <div className="glass-panel rounded-2xl p-4 space-y-3 shadow-md">
                          <div className="flex gap-2">
                            <select
                              value={intType}
                              onChange={(e) =>
                                setIntType(e.target.value as (typeof INTERACTION_TYPES)[number])
                              }
                              className="glass-input rounded-xl px-3 py-2.5 text-xs capitalize focus:outline-none flex-shrink-0"
                            >
                              {INTERACTION_TYPES.map((t) => (
                                <option
                                  key={t}
                                  value={t}
                                  className="bg-popover text-popover-foreground"
                                >
                                  {t}
                                </option>
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
                            {logMut.isPending ? (
                              <>
                                <Spinner /> Logging…
                              </>
                            ) : (
                              "Log Interaction"
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Recent activity */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                            Recent Activity
                          </h3>
                          {interactions.length > 3 && (
                            <button
                              onClick={() => setActiveTab("timeline")}
                              className="text-[9px] font-bold uppercase tracking-wider text-primary hover:opacity-80 transition-opacity"
                            >
                              All ({interactions.length}) →
                            </button>
                          )}
                        </div>
                        <div className="glass-panel rounded-2xl p-4 shadow-md">
                          {interactions.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2 text-center">
                              No interactions yet.
                            </p>
                          ) : (
                            <div className="border-l border-border ml-2 pl-4 space-y-4 py-1">
                              {interactions.slice(0, 3).map((i) => (
                                <div key={i.id} className="relative">
                                  <div className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary ring-4 ring-background" />
                                  <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider">
                                    <span className="text-primary">{i.type}</span>
                                    <span className="text-muted-foreground font-mono">
                                      {formatAgo(i.occurred_at)}
                                    </span>
                                  </div>
                                  {i.summary && (
                                    <p className="text-xs mt-1 leading-relaxed text-foreground font-medium">
                                      {i.summary}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Promises */}
                      <div>
                        <h3 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                          Promises
                        </h3>
                        <div className="glass-panel rounded-2xl p-4 space-y-3 shadow-md">
                          <div className="flex gap-2">
                            <input
                              placeholder="I promised to…"
                              value={promiseText}
                              onChange={(e) => setPromiseText(e.target.value)}
                              className="flex-1 glass-input rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                              onKeyDown={(e) => {
                                if (
                                  e.key === "Enter" &&
                                  promiseText.trim() &&
                                  !promiseMut.isPending
                                )
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
                            {promises.map((p) => (
                              <div
                                key={p.id}
                                className="py-2.5 flex items-center justify-between gap-2"
                              >
                                <span
                                  className={`text-xs font-medium ${p.status !== "open" ? "line-through text-muted-foreground/50" : "text-foreground"}`}
                                >
                                  {p.description}
                                </span>
                                {p.status === "open" && (
                                  <button
                                    disabled={keptMut.isPending && keptMut.variables === p.id}
                                    onClick={() => keptMut.mutate(p.id)}
                                    className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1 hover:bg-primary hover:text-primary-foreground transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    {keptMut.isPending && keptMut.variables === p.id ? (
                                      <Spinner />
                                    ) : (
                                      "Kept ✓"
                                    )}
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
                        {deleteMut.isPending ? (
                          <>
                            <Spinner /> Deleting…
                          </>
                        ) : (
                          "Delete contact"
                        )}
                      </button>
                    </div>
                  )}

                  {/* ── Timeline ── */}
                  {activeTab === "timeline" && (
                    <div>
                      {interactions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No interactions logged yet.
                        </p>
                      ) : (
                        <div className="border-l border-border ml-3 pl-5 space-y-5 py-1">
                          {interactions.map((i) => (
                            <div key={i.id} className="relative">
                              <div className="absolute -left-[27px] top-1.5 size-2 rounded-full bg-primary ring-4 ring-background" />
                              <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider">
                                <span className="text-primary">{i.type}</span>
                                <span className="text-muted-foreground font-mono">
                                  {formatAgo(i.occurred_at)}
                                </span>
                              </div>
                              {i.summary && (
                                <p className="text-xs mt-1.5 leading-relaxed text-foreground font-medium">
                                  {i.summary}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Notes ── */}
                  {activeTab === "notes" && (
                    <div className="space-y-4">
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
                            {noteMut.isPending ? (
                              <>
                                <Spinner /> Saving…
                              </>
                            ) : (
                              "Save Note"
                            )}
                          </button>
                        </div>
                      </div>

                      {/* AI Note Summarizer */}
                      <AiCard title="AI Notes Summarizer" icon="🧾" accent>
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
                            {summaryBusy ? (
                              <>
                                <Spinner /> Summarizing…
                              </>
                            ) : (
                              "Summarize with AI"
                            )}
                          </button>
                        </div>
                        {summaryResult && (
                          <div className="space-y-3 text-xs border-t border-border/60 pt-3">
                            <div>
                              <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                                AI Summary
                              </p>
                              <p className="text-foreground mt-1 leading-relaxed font-medium">
                                {summaryResult.summary}
                              </p>
                            </div>
                            {summaryResult.actions?.length > 0 && (
                              <div>
                                <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Action Items
                                </p>
                                <ul className="list-disc pl-4 mt-1 space-y-1 text-foreground/90">
                                  {summaryResult.actions.map((a, idx) => (
                                    <li key={idx}>
                                      <span className="text-primary font-bold">{a.owner}:</span>{" "}
                                      {a.description}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </AiCard>

                      {/* Saved Notes */}
                      <div className="space-y-3">
                        {normalizedNotes.map((n) => (
                          <div
                            key={n.id}
                            className="glass-panel rounded-2xl p-4 relative shadow-md"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <p className="whitespace-pre-wrap flex-1 text-xs text-foreground font-medium leading-relaxed">
                                {n.body}
                              </p>
                              <button
                                disabled={
                                  deleteNoteMut.isPending && deleteNoteMut.variables === n.id
                                }
                                onClick={() => deleteNoteMut.mutate(n.id)}
                                className="size-6 rounded-full bg-surface-2 border border-border flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors text-sm flex-shrink-0 disabled:opacity-50"
                              >
                                {deleteNoteMut.isPending && deleteNoteMut.variables === n.id ? (
                                  <Spinner />
                                ) : (
                                  "×"
                                )}
                              </button>
                            </div>
                            <p className="text-[9px] font-semibold text-muted-foreground mt-2.5">
                              {formatAgo(n.created_at)}
                            </p>
                          </div>
                        ))}
                        {normalizedNotes.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No saved notes yet.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── AI Tab ── */}
                  {activeTab === "ai" && (
                    <div className="space-y-5">
                      {/* 1. Meeting Brief */}
                      <AiCard title="Meeting Brief" icon="📋" accent>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Instant AI brief analyzing timeline, notes, and open promises before your
                          meeting.
                        </p>
                        <button
                          onClick={generateBrief}
                          disabled={briefBusy}
                          className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {briefBusy ? (
                            <>
                              <Spinner /> Generating…
                            </>
                          ) : brief ? (
                            "Regenerate Brief"
                          ) : (
                            "Generate Brief →"
                          )}
                        </button>
                        {brief && (
                          <div className="border-t border-border/50 pt-3 space-y-2">
                            <div className="flex justify-end">
                              <CopyButton text={brief} />
                            </div>
                            <div className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap font-medium">
                              {brief}
                            </div>
                          </div>
                        )}
                      </AiCard>

                      {/* 2. Conversation Starters */}
                      <AiCard title="Conversation Starters" icon="💬" accent>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          AI-crafted personalized openers based on your relationship history.
                        </p>
                        <button
                          onClick={generateStarters}
                          disabled={startersBusy}
                          className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {startersBusy ? (
                            <>
                              <Spinner /> Thinking…
                            </>
                          ) : starters ? (
                            "Regenerate"
                          ) : (
                            "Generate Starters →"
                          )}
                        </button>
                        {starters && starters.length > 0 && (
                          <div className="border-t border-border/50 pt-3 space-y-3">
                            {starters.map((s, i) => (
                              <div key={i} className="glass-panel rounded-xl p-3 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                      s.tone === "warm"
                                        ? "bg-amber-500/15 text-amber-400"
                                        : s.tone === "professional"
                                          ? "bg-blue-500/15 text-blue-400"
                                          : "bg-purple-500/15 text-purple-400"
                                    }`}
                                  >
                                    {s.tone}
                                  </span>
                                  <CopyButton text={s.opener} />
                                </div>
                                <p className="text-xs font-semibold text-foreground leading-relaxed">
                                  "{s.opener}"
                                </p>
                                <p className="text-[10px] text-muted-foreground">{s.context}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </AiCard>

                      {/* 3. Draft a Message */}
                      <AiCard title="Draft a Message" icon="✉️" accent>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                              Occasion
                            </p>
                            <select
                              value={draftOccasion}
                              onChange={(e) => setDraftOccasion(e.target.value as DraftOccasion)}
                              className="w-full glass-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                            >
                              {DRAFT_OCCASIONS.map((o) => (
                                <option
                                  key={o.value}
                                  value={o.value}
                                  className="bg-popover text-popover-foreground"
                                >
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                              Tone
                            </p>
                            <select
                              value={draftTone}
                              onChange={(e) => setDraftTone(e.target.value as DraftTone)}
                              className="w-full glass-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                            >
                              <option value="warm" className="bg-popover">
                                Warm
                              </option>
                              <option value="professional" className="bg-popover">
                                Professional
                              </option>
                              <option value="casual" className="bg-popover">
                                Casual
                              </option>
                            </select>
                          </div>
                        </div>
                        <input
                          placeholder="Extra context (optional)…"
                          value={draftExtra}
                          onChange={(e) => setDraftExtra(e.target.value)}
                          className="w-full glass-input rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                        />
                        <button
                          onClick={generateDraft}
                          disabled={draftBusy}
                          className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {draftBusy ? (
                            <>
                              <Spinner /> Drafting…
                            </>
                          ) : draftText ? (
                            "Redraft →"
                          ) : (
                            "Draft Message →"
                          )}
                        </button>
                        {draftText && (
                          <div className="border-t border-border/50 pt-3 space-y-2">
                            <div className="flex justify-end">
                              <CopyButton text={draftText} />
                            </div>
                            <p className="text-xs leading-relaxed text-foreground font-medium whitespace-pre-wrap">
                              {draftText}
                            </p>
                          </div>
                        )}
                      </AiCard>

                      {/* 4. Relationship Diagnosis */}
                      <AiCard title="Relationship Diagnosis" icon="🧠" accent>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          AI deep-reads your interaction history and gives an honest relationship
                          audit with specific recommendations.
                        </p>
                        <button
                          onClick={runDiagnosis}
                          disabled={diagnosisBusy}
                          className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {diagnosisBusy ? (
                            <>
                              <Spinner /> Analyzing…
                            </>
                          ) : diagnosis ? (
                            "Re-analyze →"
                          ) : (
                            "Run Diagnosis →"
                          )}
                        </button>
                        {diagnosis && (
                          <div className="border-t border-border/50 pt-3 space-y-3">
                            <div className="flex items-center gap-3">
                              <span
                                className={`text-lg font-black ${diagnosisColors[diagnosis.score_label] ?? "text-foreground"}`}
                              >
                                {diagnosis.score_label}
                              </span>
                            </div>
                            <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                              {diagnosis.summary}
                            </p>
                            {diagnosis.strengths?.length > 0 && (
                              <div>
                                <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
                                  Strengths
                                </p>
                                <ul className="space-y-1">
                                  {diagnosis.strengths.map((s: string, i: number) => (
                                    <li
                                      key={i}
                                      className="text-xs text-foreground/80 flex items-start gap-1.5"
                                    >
                                      <span className="text-emerald-400 mt-0.5">✓</span> {s}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {diagnosis.risks?.length > 0 && (
                              <div>
                                <p className="text-[8px] font-bold uppercase tracking-wider text-orange-400 mb-1">
                                  Watch out for
                                </p>
                                <ul className="space-y-1">
                                  {diagnosis.risks.map((r: string, i: number) => (
                                    <li
                                      key={i}
                                      className="text-xs text-foreground/80 flex items-start gap-1.5"
                                    >
                                      <span className="text-orange-400 mt-0.5">!</span> {r}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {diagnosis.top_action && (
                              <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                                <p className="text-[8px] font-bold uppercase tracking-wider text-primary mb-1">
                                  Top Action This Week
                                </p>
                                <p className="text-xs font-semibold text-foreground">
                                  {diagnosis.top_action}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </AiCard>
                    </div>
                  )}

                  {/* ── Details ── */}
                  {activeTab === "details" && (
                    <div className="space-y-4">
                      <div className="glass-panel rounded-2xl p-4 space-y-3 shadow-md">
                        <div className="grid grid-cols-1 gap-2">
                          <select
                            value={fieldCategory}
                            onChange={(e) => setFieldCategory(e.target.value)}
                            className="glass-input rounded-xl px-3 py-2.5 text-xs capitalize focus:outline-none"
                          >
                            {["family", "pet", "favorite", "allergy", "interest", "custom"].map(
                              (c) => (
                                <option
                                  key={c}
                                  value={c}
                                  className="bg-popover text-popover-foreground"
                                >
                                  {c}
                                </option>
                              ),
                            )}
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
                          onClick={() =>
                            addFieldMut.mutate({
                              category: fieldCategory,
                              key: fieldKey,
                              value: fieldValue,
                            })
                          }
                          className="w-full text-[10px] font-bold uppercase tracking-wider border border-border hover:bg-surface-2 rounded-full py-2 text-foreground transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {addFieldMut.isPending ? (
                            <>
                              <Spinner /> Adding…
                            </>
                          ) : (
                            "+ Add field"
                          )}
                        </button>
                      </div>
                      <div className="divide-y divide-border">
                        {fields.map((f) => (
                          <div
                            key={f.id}
                            className="flex justify-between items-baseline py-3 text-xs hover:bg-surface-2 rounded px-1 transition-colors"
                          >
                            <div className="min-w-0">
                              <span className="text-[8px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-md mr-2">
                                {f.category}
                              </span>
                              <span className="font-semibold text-foreground">{f.key}</span>
                              {f.value && (
                                <span className="text-muted-foreground ml-2 font-medium">
                                  {f.value}
                                </span>
                              )}
                            </div>
                            <button
                              disabled={
                                deleteFieldMut.isPending && deleteFieldMut.variables === f.id
                              }
                              onClick={() => deleteFieldMut.mutate(f.id)}
                              className="text-[10px] text-muted-foreground hover:text-destructive transition-colors ml-2 disabled:opacity-50"
                            >
                              {deleteFieldMut.isPending && deleteFieldMut.variables === f.id ? (
                                <Spinner />
                              ) : (
                                "×"
                              )}
                            </button>
                          </div>
                        ))}
                        {fields.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No fields yet.
                          </p>
                        )}
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
