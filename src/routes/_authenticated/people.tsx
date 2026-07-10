import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPerson, listPeople } from "@/lib/people.functions";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/people")({
  component: PeoplePage,
});

function PeoplePage() {
  const qc = useQueryClient();
  const fetch = useServerFn(listPeople);
  const add = useServerFn(createPerson);
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);

  const people = useQuery({
    queryKey: ["people", search],
    queryFn: () => fetch({ data: { search: search || undefined } }),
  });

  const createMut = useMutation({
    mutationFn: (input: {
      name: string;
      relationship_type: string;
      target_cadence_days: number;
    }) => add({ data: input as any }),
    onSuccess: () => {
      toast.success("Person added");
      setOpenCreate(false);
      qc.invalidateQueries({ queryKey: ["people"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Roster
          </p>
          <h1 className="text-3xl font-bold tracking-tight mt-1">People</h1>
        </div>
        <button
          onClick={() => setOpenCreate(true)}
          className="bg-foreground text-background px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
        >
          Add person
        </button>
      </header>

      <input
        placeholder="Filter by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm bg-surface border border-border rounded-md py-2 px-3 text-sm focus:outline-none focus:border-accent/50"
      />

      <div className="overflow-hidden border border-border rounded-lg bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-background/50 text-muted-foreground text-[10px] font-mono uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Relationship</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Cadence</th>
              <th className="px-4 py-3 font-medium text-right">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {people.data?.people.map((p: any) => (
              <tr key={p.id} className="hover:bg-background/50 transition-colors">
                <td className="px-4 py-3 font-medium">
                  <Link
                    to="/people/$id"
                    params={{ id: p.id }}
                    className="hover:text-accent"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground capitalize">
                  {p.relationship_type}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {[p.role, p.company].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                  every {p.target_cadence_days}d
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">
                  {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                </td>
              </tr>
            ))}
            {people.data && people.data.people.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No people yet. Add your first contact above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSubmit({ name: name.trim(), relationship_type: type, target_cadence_days: cadence });
        }}
        className="bg-surface border border-border rounded-xl w-full max-w-md p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold">Add someone</h2>
        <div>
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent/50"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Relationship
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full bg-background border border-border rounded px-3 py-2 text-sm capitalize"
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
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Cadence (days)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={cadence}
              onChange={(e) => setCadence(parseInt(e.target.value || "30", 10))}
              className="mt-1 w-full bg-background border border-border rounded px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-border rounded text-xs font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 bg-foreground text-background rounded text-xs font-bold uppercase tracking-widest disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}