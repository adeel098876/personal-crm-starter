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
    <div className="min-h-screen bg-[#050508] text-[#F2F2F7] relative font-sans">
      {/* Ambient glassmorphic blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-600/10 blur-[140px] animate-blob-slow-1" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[70vw] h-[70vw] rounded-full bg-purple-600/10 blur-[160px] animate-blob-slow-2" />
        <div className="absolute top-[25%] right-[15%] w-[45vw] h-[45vw] rounded-full bg-teal-600/5 blur-[120px] animate-blob-slow-3" />
      </div>

      <nav className="sticky top-0 z-40 bg-surface/50 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <Link to="/today" className="flex items-center font-bold tracking-tight text-base shrink-0 group">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary mr-2.5 drop-shadow-[0_0_8px_rgba(10,132,255,0.3)] transition-transform duration-300 group-hover:rotate-45">
                <circle cx="12" cy="12" r="9" stroke="url(#logoGrad)" strokeWidth="2.5" />
                <circle cx="12" cy="12" r="5" stroke="url(#logoGrad2)" strokeWidth="1.5" strokeDasharray="3 2" />
                <defs>
                  <linearGradient id="logoGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#0A84FF" />
                    <stop offset="1" stopColor="#BF5AF2" />
                  </linearGradient>
                  <linearGradient id="logoGrad2" x1="7" y1="7" x2="17" y2="17" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#BF5AF2" />
                    <stop offset="1" stopColor="#30D158" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-[#AEAEB2] font-semibold text-lg tracking-tight">Kinetic</span>
            </Link>
            <div className="hidden md:flex items-center gap-5 text-xs font-medium tracking-wide">
              {NAV.map((item) => {
                const active = pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 transition-all duration-200 ${active ? "text-white font-semibold" : "text-muted-foreground hover:text-white"}`}
                  >
                    <span
                      className={`px-1.5 py-0.5 border rounded-md text-[10px] font-mono transition-colors ${active ? "border-primary/30 bg-primary/10 text-primary" : "border-white/5 bg-white/2"}`}
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
              className="w-full flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.05] rounded-full py-1.5 pl-3.5 pr-2.5 text-sm text-muted-foreground hover:bg-white/[0.08] hover:border-white/[0.08] transition-all"
            >
              <span className="text-muted-foreground text-xs">/</span>
              <span className="flex-1 text-left truncate text-xs">Search, navigate, or quick command…</span>
              <kbd className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/5 text-[9px] font-mono tracking-tight text-white/50">
                ⌘K
              </kbd>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/settings"
              className="size-8 rounded-full bg-white/[0.04] border border-white/[0.06] grid place-items-center text-[11px] font-semibold hover:bg-white/[0.08] transition-all"
            >
              {initials}
            </Link>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8 relative z-10">{children}</main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}