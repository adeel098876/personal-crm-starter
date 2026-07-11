import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { parseVCards, type ParsedContact } from "@/lib/vcard-parser";
import { csvToContacts } from "@/lib/csv-parser";
import {
  commitReview,
  listImports,
  previewAndImport,
  type ContactPrediction,
} from "@/lib/import.functions";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/import")({
  component: ImportPage,
});

type Source = "vcard" | "csv" | "google";

function ImportPage() {
  const qc = useQueryClient();
  const preview = useServerFn(previewAndImport);
  const commit = useServerFn(commitReview);
  const list = useServerFn(listImports);

  const [source, setSource] = useState<Source>("vcard");
  const [reviewQueue, setReviewQueue] = useState<ContactPrediction[]>([]);
  const [batchId, setBatchId] = useState<string | undefined>();
  const [autoImported, setAutoImported] = useState(0);
  const [skipped, setSkipped] = useState(0);

  const history = useQuery({ queryKey: ["import-batches"], queryFn: () => list() });

  const runImport = useMutation({
    mutationFn: async (contacts: ParsedContact[]) => {
      const res = await preview({
        data: {
          source,
          contacts: contacts.map((c) => ({
            external_id: c.external_id,
            name: c.name,
            first_name: c.first_name,
            last_name: c.last_name,
            email: c.email,
            phone: c.phone,
            company: c.company,
            role: c.role,
            birthday: c.birthday,
            notes: c.notes,
            address: c.address,
          })),
        },
      });
      return res;
    },
    onSuccess: (res) => {
      setReviewQueue(res.review);
      setBatchId(res.batch?.id);
      setAutoImported(res.autoImported);
      setSkipped(res.skippedDuplicates);
      qc.invalidateQueries({ queryKey: ["people"] });
      qc.invalidateQueries({ queryKey: ["import-batches"] });
      if (res.autoImported > 0) toast.success(`Auto-imported ${res.autoImported} confident matches`);
      if (res.review.length === 0 && res.autoImported === 0 && res.skippedDuplicates > 0) {
        toast.info("All contacts already exist — nothing to do.");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import failed"),
  });

  async function handleFile(file: File) {
    const text = await file.text();
    const contacts =
      source === "vcard" ? parseVCards(text) : source === "csv" ? csvToContacts(text) : csvToContacts(text);
    if (contacts.length === 0) {
      toast.error("No contacts found in file.");
      return;
    }
    if (contacts.length > 2000) {
      toast.error("Max 2000 contacts per import. Split the file.");
      return;
    }
    toast.info(`Parsed ${contacts.length} contacts. AI is classifying…`);
    runImport.mutate(contacts);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Ingest
        </p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Import contacts</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Bring in contacts from Google, Apple, or any address book. AI infers relationship
          and cadence — high-confidence matches are auto-imported, the rest go to a review queue.
        </p>
      </header>

      <div className="flex gap-1 text-xs font-mono uppercase tracking-widest">
        {([
          { key: "vcard", label: "vCard (.vcf)" },
          { key: "csv", label: "CSV" },
          { key: "google", label: "Google" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setSource(t.key)}
            className={`px-3 py-1.5 rounded border ${source === t.key ? "border-accent/40 text-accent" : "border-border text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {source === "vcard" && (
        <UploadCard
          title="Drop a .vcf file"
          hint="On iPhone: Contacts → select all → Share → AirDrop to Mac → drag file here. On Mac: Contacts → File → Export → vCard."
          accept=".vcf,text/vcard"
          onFile={handleFile}
          busy={runImport.isPending}
        />
      )}
      {source === "csv" && (
        <UploadCard
          title="Drop a .csv file"
          hint="Works with Google Contacts CSV, Apple Contacts CSV, or any spreadsheet with name/email/phone/company columns."
          accept=".csv,text/csv"
          onFile={handleFile}
          busy={runImport.isPending}
        />
      )}
      {source === "google" && (
        <div className="space-y-3">
          <UploadCard
            title="Drop your Google Contacts export"
            hint="Go to contacts.google.com → left sidebar → Export → Google CSV → download → drop the .csv here."
            accept=".csv,text/csv"
            onFile={handleFile}
            busy={runImport.isPending}
          />
          <p className="text-xs text-muted-foreground">
            Real-time Google OAuth sync (People API) is on the roadmap. For now the CSV export
            captures the same data and works offline.
          </p>
        </div>
      )}

      {(autoImported > 0 || skipped > 0 || reviewQueue.length > 0) && (
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Stat label="Auto-imported" value={autoImported} accent />
          <Stat label="Needs review" value={reviewQueue.length} />
          <Stat label="Duplicates skipped" value={skipped} />
        </div>
      )}

      {reviewQueue.length > 0 && (
        <ReviewTable
          queue={reviewQueue}
          onCommit={async (items) => {
            const res = await commit({ data: { batch_id: batchId, source, items } });
            toast.success(`Imported ${res.imported} more contacts`);
            setReviewQueue([]);
            qc.invalidateQueries({ queryKey: ["people"] });
            qc.invalidateQueries({ queryKey: ["import-batches"] });
            qc.invalidateQueries({ queryKey: ["dashboard"] });
          }}
        />
      )}

      <section>
        <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-2">
          Recent imports
        </h2>
        <div className="border border-border rounded-lg bg-surface divide-y divide-border">
          {history.data?.batches.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">No imports yet.</p>
          )}
          {history.data?.batches.map((b: any) => (
            <div key={b.id} className="p-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-mono text-xs uppercase text-muted-foreground">{b.source}</p>
                <p>
                  {b.total_imported} imported · {b.total_skipped} dupes ·{" "}
                  {b.total_review} review · <span className="capitalize">{b.status}</span>
                </p>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">
                {format(new Date(b.created_at), "MMM d, HH:mm")}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="border border-border rounded-lg bg-surface p-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 ${accent ? "text-accent" : ""}`}>{value}</p>
    </div>
  );
}

function UploadCard({
  title,
  hint,
  accept,
  onFile,
  busy,
}: {
  title: string;
  hint: string;
  accept: string;
  onFile: (f: File) => void;
  busy: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`block cursor-pointer border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
        dragging ? "border-accent/50 bg-accent/5" : "border-border bg-surface hover:border-accent/30"
      }`}
    >
      <p className="text-lg font-semibold">{busy ? "Processing…" : title}</p>
      <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">{hint}</p>
      <input
        type="file"
        accept={accept}
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-4">
        Click or drag file
      </p>
    </label>
  );
}

function ReviewTable({
  queue,
  onCommit,
}: {
  queue: ContactPrediction[];
  onCommit: (
    items: Array<{
      contact: ContactPrediction["contact"];
      relationship_type: string;
      target_cadence_days: number;
      skip: boolean;
    }>,
  ) => Promise<void>;
}) {
  const [state, setState] = useState(() =>
    queue.map((q) => ({
      contact: q.contact,
      relationship_type: q.relationship_type,
      target_cadence_days: q.target_cadence_days,
      skip: false,
      confidence: q.confidence,
      reason: q.reason,
    })),
  );
  const [busy, setBusy] = useState(false);

  return (
    <div className="border border-border rounded-lg bg-surface overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Review low-confidence predictions</p>
          <p className="text-xs text-muted-foreground">
            Edit or skip. Then commit to import the rest.
          </p>
        </div>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onCommit(
                state.map((s) => ({
                  contact: s.contact,
                  relationship_type: s.relationship_type,
                  target_cadence_days: s.target_cadence_days,
                  skip: s.skip,
                })),
              );
            } finally {
              setBusy(false);
            }
          }}
          className="bg-foreground text-background px-4 py-2 rounded text-xs font-bold uppercase tracking-widest disabled:opacity-50"
        >
          {busy ? "Committing…" : "Commit"}
        </button>
      </div>
      <div className="overflow-x-auto max-h-[520px]">
        <table className="w-full text-sm">
          <thead className="bg-background/50 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Contact</th>
              <th className="text-left px-3 py-2">Company</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Cadence</th>
              <th className="text-left px-3 py-2">Confidence</th>
              <th className="text-left px-3 py-2">Skip</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {state.map((s, i) => (
              <tr key={i} className={s.skip ? "opacity-40" : ""}>
                <td className="px-3 py-2">
                  <p className="font-medium">{s.contact.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {s.contact.email || s.contact.phone || "—"}
                  </p>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {[s.contact.company, s.contact.role].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={s.relationship_type}
                    onChange={(e) =>
                      setState((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], relationship_type: e.target.value as any };
                        return next;
                      })
                    }
                    className="bg-background border border-border rounded px-2 py-1 text-xs capitalize"
                  >
                    {[
                      "family",
                      "friend",
                      "partner",
                      "coworker",
                      "manager",
                      "client",
                      "mentor",
                      "mentee",
                      "investor",
                      "acquaintance",
                      "other",
                    ].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={s.target_cadence_days}
                    onChange={(e) =>
                      setState((prev) => {
                        const next = [...prev];
                        next[i] = {
                          ...next[i],
                          target_cadence_days: parseInt(e.target.value || "30", 10),
                        };
                        return next;
                      })
                    }
                    className="w-20 bg-background border border-border rounded px-2 py-1 text-xs font-mono"
                  />
                </td>
                <td className="px-3 py-2 text-xs font-mono">
                  {Math.round(s.confidence * 100)}%
                  <p className="text-[10px] text-muted-foreground max-w-[220px] truncate">
                    {s.reason}
                  </p>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={s.skip}
                    onChange={(e) =>
                      setState((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], skip: e.target.checked };
                        return next;
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}