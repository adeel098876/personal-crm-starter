import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPerson, listPeople } from "@/lib/people.functions";
import { PersonPanel } from "@/components/person-panel";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/people")({
  component: PeoplePage,
});

function PeoplePage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listPeople);
  const add = useServerFn(createPerson);
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const people = useQuery({
    queryKey: ["people", search],
    queryFn: () => fetchList({ data: { search: search || undefined } }),
  });

  const createMut = useMutation({
    mutationFn: (input: {
      name: string;
      relationship_type: string;
      target_cadence_days: number;
    }) => add({ data: input as any }),
    onSuccess: () => {
      toast.success("Person added ✓");
      setOpenCreate(false);
      qc.invalidateQueries({ queryKey: ["people"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Roster
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight mt-1 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground">People</h1>
        </div>
        <button
          onClick={() => setOpenCreate(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-lg"
        >
          Add person
        </button>
      </header>

      <input
        placeholder="Filter by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm glass-input rounded-2xl py-2.5 px-4 text-xs text-foreground focus:outline-none"
      />

      <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-muted-foreground text-[10px] font-semibold uppercase tracking-wider border-b border-border">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Name</th>
                <th className="px-5 py-3.5 font-semibold">Relationship</th>
                <th className="px-5 py-3.5 font-semibold">Company</th>
                <th className="px-5 py-3.5 font-semibold">Cadence</th>
                <th className="px-5 py-3.5 font-semibold text-right">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {people.data?.people.map((p: any) => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className="hover:bg-surface-2 transition-colors cursor-pointer group"
                >
                  <td className="px-5 py-3.5 font-medium text-foreground">
                    <span className="group-hover:text-primary transition-colors">{p.name}</span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground capitalize">
                    {p.relationship_type}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground">
                    {[p.role, p.company].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground font-mono">
                    every {p.target_cadence_days}d
                  </td>
                  <td className="px-5 py-3.5 text-right text-xs text-muted-foreground font-mono">
                    {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                  </td>
                </tr>
              ))}
              {people.data && people.data.people.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No people yet. Add your first contact above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over panel pinned to viewport */}
      {selectedId && (
        <PersonPanel id={selectedId} onClose={() => setSelectedId(null)} />
      )}

      {openCreate && (
        <CreatePersonDialog
          onClose={() => setOpenCreate(false)}
          onSubmit={(v) => createMut.mutate(v)}
          busy={createMut.isPending}
        />
      )}
    </div>
  );
}

function CreatePersonDialog({
  onClose,
  onSubmit,
  busy,
}: {
  onClose: () => void;
  onSubmit: (v: { name: string; relationship_type: string; target_cadence_days: number }) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("friend");
  const [cadence, setCadence] = useState(30);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSubmit({ name: name.trim(), relationship_type: type, target_cadence_days: cadence });
        }}
        className="glass-panel w-full max-w-md p-6.5 space-y-5 rounded-3xl shadow-2xl"
      >
        <h2 className="text-lg font-bold text-foreground pl-1">Add someone</h2>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">
            Name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full glass-input rounded-2xl px-4 py-2.5 text-xs text-foreground focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">
              Relationship
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1.5 w-full glass-input rounded-2xl px-4 py-2.5 text-xs text-foreground focus:outline-none capitalize"
            >
              {[
                "family", "friend", "partner", "coworker", "manager",
                "client", "mentor", "mentee", "investor", "acquaintance", "other",
              ].map((t) => (
                <option key={t} value={t} className="bg-popover text-popover-foreground">{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">
              Cadence (days)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={cadence}
              onChange={(e) => setCadence(parseInt(e.target.value || "30", 10))}
              className="mt-1.5 w-full glass-input rounded-2xl px-4 py-2.5 text-xs text-foreground font-mono focus:outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-border hover:bg-surface-2 rounded-full text-xs font-semibold text-foreground transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-xs font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}