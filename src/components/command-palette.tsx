import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listPeople } from "@/lib/people.functions";
import { smartSearch } from "@/lib/ai.functions";
import { toast } from "sonner";

type Person = {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
};

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const fetchPeople = useServerFn(listPeople);
  const runSmartSearch = useServerFn(smartSearch);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    fetchPeople({ data: {} })
      .then((r) => setPeople(r.people as Person[]))
      .catch(() => {});
  }, [open, fetchPeople]);

  async function askAi() {
    if (!query.trim()) return;
    setAiBusy(true);
    try {
      const r = await runSmartSearch({ data: { query } });
      if (r.people.length === 0) {
        toast.info("No matches for that query.");
      } else {
        setPeople(r.people as Person[]);
        toast.success(`${r.people.length} match${r.people.length === 1 ? "" : "es"}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI search failed");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search people or ask AI…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {[
            { to: "/today" as const, label: "Today" },
            { to: "/people" as const, label: "People" },
            { to: "/reminders" as const, label: "Reminders" },
            { to: "/analytics" as const, label: "Analytics" },
            { to: "/settings" as const, label: "Settings" },
          ].map((n) => (
            <CommandItem
              key={n.to}
              onSelect={() => {
                onOpenChange(false);
                navigate({ to: n.to });
              }}
            >
              {n.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="People">
          {people.slice(0, 20).map((p) => (
            <CommandItem
              key={p.id}
              value={`${p.name} ${p.company ?? ""} ${p.role ?? ""}`}
              onSelect={() => {
                onOpenChange(false);
                navigate({ to: "/people/$id", params: { id: p.id } });
              }}
            >
              <span>{p.name}</span>
              {(p.company || p.role) && (
                <span className="text-muted-foreground text-xs ml-2">
                  {[p.role, p.company].filter(Boolean).join(" · ")}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="AI">
          <CommandItem onSelect={askAi} disabled={aiBusy}>
            {aiBusy ? "Thinking…" : `Ask AI: "${query || "…"}"`}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
