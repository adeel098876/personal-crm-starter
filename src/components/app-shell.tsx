import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CommandPalette } from "@/components/command-palette";

const NAV = [
  { to: "/today", label: "Today", key: "1" },
  { to: "/people", label: "People", key: "2" },
  { to: "/reminders", label: "Reminders", key: "3" },
  { to: "/analytics", label: "Analytics", key: "4" },
  { to: "/import", label: "Import", key: "5" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [initials, setInitials] = useState("··");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? "";
      setInitials(email.slice(0, 2).toUpperCase() || "··");
    });
  }, []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <Link to="/today" className="font-bold tracking-tighter text-lg shrink-0">
              KINETIC
            </Link>
            <div className="hidden md:flex items-center gap-4 text-xs font-mono uppercase tracking-widest">
              {NAV.map((item) => {
                const active = pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <span
                      className={`px-1.5 py-0.5 border rounded ${active ? "border-accent/40 text-accent" : "border-border"}`}
                    >
                      {item.key}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex-1 max-w-md">
            <button
              onClick={() => setPaletteOpen(true)}
              className="w-full flex items-center gap-2 bg-surface border border-border rounded-md py-1.5 pl-3 pr-2 text-sm text-muted-foreground hover:border-accent/40 transition-colors"
            >
              <span className="text-muted-foreground">/</span>
              <span className="flex-1 text-left truncate">Search people, notes, or ask AI…</span>
              <kbd className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono">
                ⌘K
              </kbd>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/settings"
              className="size-8 rounded-full bg-surface border border-border grid place-items-center text-xs font-mono hover:border-accent/40 transition-colors"
            >
              {initials}
            </Link>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}