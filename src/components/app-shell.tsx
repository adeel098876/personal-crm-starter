import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CommandPalette } from "@/components/command-palette";
import { useTheme, type Theme } from "@/components/theme-provider";
import { Background3D } from "@/components/background-3d";

const NAV = [
  {
    to: "/today",
    label: "Today",
    key: "1",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    to: "/people",
    label: "People",
    key: "2",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  },
  {
    to: "/reminders",
    label: "Reminders",
    key: "3",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    to: "/analytics",
    label: "Analytics",
    key: "4",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    to: "/import",
    label: "Import",
    key: "5",
    icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
  },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [initials, setInitials] = useState("··");
  const { theme, setTheme } = useTheme();

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

  const cycleTheme = () => {
    const modes: Theme[] = ["system", "dark", "light"];
    const nextIndex = (modes.indexOf(theme) + 1) % modes.length;
    setTheme(modes[nextIndex]);
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative font-sans transition-colors duration-300">
      {/* 60FPS Hardware-Accelerated 3D Interactive Spatial Background */}
      <Background3D />

      {/* Desktop Sticky Header */}
      <nav className="sticky top-0 z-40 bg-surface backdrop-blur-xl border-b border-border transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <Link
              to="/today"
              className="flex items-center font-bold tracking-tight text-base shrink-0 group"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-primary mr-2.5 drop-shadow-[0_0_10px_rgba(10,132,255,0.4)] transition-transform duration-500 group-hover:rotate-90"
              >
                <circle cx="12" cy="12" r="9" stroke="url(#logoGrad)" strokeWidth="2.5" />
                <circle
                  cx="12"
                  cy="12"
                  r="5"
                  stroke="url(#logoGrad2)"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
                <defs>
                  <linearGradient
                    id="logoGrad"
                    x1="3"
                    y1="3"
                    x2="21"
                    y2="21"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#0A84FF" />
                    <stop offset="1" stopColor="#BF5AF2" />
                  </linearGradient>
                  <linearGradient
                    id="logoGrad2"
                    x1="7"
                    y1="7"
                    x2="17"
                    y2="17"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#BF5AF2" />
                    <stop offset="1" stopColor="#30D158" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground font-extrabold text-xl tracking-tight">
                Kinetic
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-5 text-xs font-semibold tracking-wide">
              {NAV.map((item) => {
                const active = pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 transition-all duration-200 ${
                      active
                        ? "text-foreground font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`px-1.5 py-0.5 border rounded-md text-[10px] font-mono transition-all ${
                        active
                          ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                          : "border-border bg-surface/50"
                      }`}
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
              className="w-full flex items-center gap-2.5 glass-input rounded-full py-2 pl-4 pr-3 text-sm text-muted-foreground hover:border-primary/40 transition-all shadow-sm group"
            >
              <span className="text-primary text-xs font-bold font-mono">/</span>
              <span className="flex-1 text-left truncate text-xs font-medium">
                Search, navigate, or quick command…
              </span>
              <kbd className="px-2 py-0.5 rounded-full bg-background border border-border text-[9px] font-mono tracking-tight text-muted-foreground group-hover:text-foreground">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={cycleTheme}
              title={`Theme: ${theme} (click to toggle)`}
              className="size-9 rounded-full glass-panel flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-90"
            >
              {theme === "light" && (
                <svg
                  className="size-4 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              )}
              {theme === "dark" && (
                <svg
                  className="size-4 text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
              {theme === "system" && (
                <svg
                  className="size-4 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              )}
            </button>

            <Link
              to="/settings"
              className="size-9 rounded-full glass-panel grid place-items-center text-xs font-bold hover:border-primary/40 transition-all active:scale-95 shadow-sm"
            >
              {initials}
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content Area with Fade-In Animation */}
      <main className="max-w-7xl mx-auto px-4 py-8 pb-24 md:pb-8 relative z-10 animate-fade-in">
        {children}
      </main>

      {/* Mobile Bottom Glass Navigation Bar */}
      <div className="fixed bottom-4 left-4 right-4 z-40 md:hidden">
        <div className="glass-panel rounded-full p-2 flex items-center justify-around shadow-2xl border border-border">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center p-2 rounded-full transition-all duration-200 ${
                  active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <svg
                  className="size-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span className="text-[9px] font-semibold tracking-tight mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
