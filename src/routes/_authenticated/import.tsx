import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { parseVCards, type ParsedContact } from "@/lib/vcard-parser";
import { csvToContacts } from "@/lib/csv-parser";
import { listImports, previewAndImport } from "@/lib/import.functions";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/import")({
  component: ImportPage,
});

type Source = "vcard" | "csv" | "google";

function ImportPage() {
  const qc = useQueryClient();
  const preview = useServerFn(previewAndImport);
  const list = useServerFn(listImports);

  const [source, setSource] = useState<Source>("vcard");
  const [autoImported, setAutoImported] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [importedStatus, setImportedStatus] = useState(false);

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
      setAutoImported(res.autoImported);
      setSkipped(res.skippedDuplicates);
      setImportedStatus(true);
      qc.invalidateQueries({ queryKey: ["people"] });
      qc.invalidateQueries({ queryKey: ["import-batches"] });
      if (res.autoImported > 0) toast.success(`Imported ${res.autoImported} contacts successfully`);
      if (res.autoImported === 0 && res.skippedDuplicates > 0) {
        toast.info("All contacts already exist — skipped duplicates.");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import failed"),
  });

  async function handleFile(file: File) {
    const text = await file.text();
    const contacts =
      source === "vcard"
        ? parseVCards(text)
        : source === "csv"
          ? csvToContacts(text)
          : csvToContacts(text);
    if (contacts.length === 0) {
      toast.error("No contacts found in file.");
      return;
    }
    if (contacts.length > 2000) {
      toast.error("Max 2000 contacts per import. Split the file.");
      return;
    }
    toast.info(`Parsed ${contacts.length} contacts. Importing…`);
    runImport.mutate(contacts);
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Ingest
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight mt-1 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground">
          Import contacts
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          Bring in contacts from Google, Apple, or any address book. Contacts are imported
          immediately with default relationships. You can refine them anytime.
        </p>
      </header>

      <div className="flex gap-2 text-[10px] font-semibold uppercase tracking-wider">
        {(
          [
            { key: "vcard", label: "vCard (.vcf)" },
            { key: "csv", label: "CSV" },
            { key: "google", label: "Google" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setSource(t.key);
              setImportedStatus(false);
            }}
            className={`px-4 py-2 rounded-full border transition-all ${
              source === t.key
                ? "border-primary/40 bg-primary/10 text-primary font-bold shadow-sm"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {source === "vcard" && (
        <UploadCard
          title="Drop a .vcf file"
          hint="On iPhone: Contacts → Select All → Share → AirDrop to computer. On Mac: Contacts → File → Export → vCard."
          accept=".vcf,text/vcard"
          onFile={handleFile}
          busy={runImport.isPending}
        />
      )}
      {source === "csv" && (
        <UploadCard
          title="Drop a .csv file"
          hint="Works with Google Contacts CSV, Apple Contacts CSV, or any spreadsheet containing name, email, phone, and company columns."
          accept=".csv,text/csv"
          onFile={handleFile}
          busy={runImport.isPending}
        />
      )}
      {source === "google" && (
        <div className="space-y-4">
          <UploadCard
            title="Drop your Google Contacts export"
            hint="Go to contacts.google.com → left sidebar → Export → Google CSV → download → drop the .csv here."
            accept=".csv,text/csv"
            onFile={handleFile}
            busy={runImport.isPending}
          />
          <p className="text-xs text-muted-foreground leading-relaxed pl-1">
            Real-time Google OAuth sync is on the roadmap. For now the CSV export captures all
            details and works offline.
          </p>
        </div>
      )}

      {importedStatus && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Stat label="Imported" value={autoImported} accent />
          <Stat label="Duplicates skipped" value={skipped} />
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground pl-1">
          Recent imports
        </h2>
        <div className="glass-panel rounded-3xl overflow-hidden divide-y divide-border shadow-xl">
          {history.data?.batches.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">No imports yet.</p>
          )}
          {history.data?.batches.map((b: any) => (
            <div
              key={b.id}
              className="p-4 flex items-center justify-between text-sm hover:bg-surface-2 transition-colors"
            >
              <div>
                <p className="font-semibold text-xs uppercase tracking-wide text-primary">
                  {b.source}
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-medium">
                  {b.total_imported} imported · {b.total_skipped} duplicates skipped
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
    <div className="glass-panel p-5 rounded-3xl shadow-lg">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`text-2xl font-extrabold mt-1 ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
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
      className={`block cursor-pointer border border-dashed rounded-3xl p-12 text-center transition-all duration-300 ${
        dragging
          ? "border-primary bg-primary/10 scale-[1.01] shadow-2xl"
          : "border-border glass-panel hover:bg-surface-2 hover:border-primary/40 hover:shadow-xl"
      }`}
    >
      <div className="mx-auto size-12 mb-4 bg-surface-2 rounded-2xl border border-border flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-upload"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </svg>
      </div>
      <p className="text-base font-bold text-foreground">{busy ? "Processing contacts…" : title}</p>
      <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">{hint}</p>
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
      <p className="text-[10px] font-bold uppercase tracking-wider text-primary mt-5">
        Click or drag file here
      </p>
    </label>
  );
}
