import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Background3D } from "@/components/background-3d";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => {
        if (data.session) navigate({ to: "/today", replace: true });
      })
      .catch((err) => {
        console.warn("[Auth] Failed to reach Supabase:", err);
        setConnectionError("Unable to reach your Supabase backend URL. Please verify VITE_SUPABASE_URL in your .env file.");
      });
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setConnectionError(null);
    try {
      if (mode === "sign_up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. Check your email if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/today", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg.includes("Failed to fetch") || msg.includes("ERR_NAME_NOT_RESOLVED")) {
        const urlErr = "Cannot resolve Supabase server URL. Check your VITE_SUPABASE_URL in .env file.";
        setConnectionError(urlErr);
        toast.error(urlErr);
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        toast.error(error.message ?? "Google sign-in failed");
      }
    } catch (err) {
      toast.error("Network error reaching Supabase server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 relative font-sans overflow-hidden transition-colors duration-300">
      {/* 60FPS Hardware Accelerated 3D Spatial Background */}
      <Background3D />

      <div className="w-full max-w-sm relative z-10">
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center mb-3">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary drop-shadow-[0_0_15px_rgba(10,132,255,0.4)] animate-pulse">
              <circle cx="12" cy="12" r="9" stroke="url(#authLogoGrad)" strokeWidth="2.5" />
              <circle cx="12" cy="12" r="5" stroke="url(#authLogoGrad2)" strokeWidth="1.5" strokeDasharray="3 2" />
              <defs>
                <linearGradient id="authLogoGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#0A84FF" />
                  <stop offset="1" stopColor="#BF5AF2" />
                </linearGradient>
                <linearGradient id="authLogoGrad2" x1="7" y1="7" x2="17" y2="17" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#BF5AF2" />
                  <stop offset="1" stopColor="#30D158" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground font-extrabold text-3xl tracking-tight">Kinetic</h1>
          <p className="mt-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-[0.25em]">
            Relationship OS
          </p>
        </div>

        <div className="glass-panel rounded-3xl p-7 shadow-2xl space-y-4">
          {connectionError && (
            <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/30 text-xs text-destructive leading-relaxed">
              <p className="font-bold mb-1">Supabase Connection Error</p>
              <p>{connectionError}</p>
            </div>
          )}

          <div className="flex gap-1 p-1 bg-surface-2 rounded-2xl border border-border text-[10px] font-mono uppercase tracking-widest">
            <button
              type="button"
              onClick={() => setMode("sign_in")}
              className={`flex-1 py-2 rounded-xl transition-all duration-200 ${mode === "sign_in" ? "bg-primary text-primary-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("sign_up")}
              className={`flex-1 py-2 rounded-xl transition-all duration-200 ${mode === "sign_up" ? "bg-primary text-primary-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleEmail} className="space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full glass-input rounded-2xl px-4.5 py-3 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground ml-1">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full glass-input rounded-2xl px-4.5 py-3 text-sm focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-2xl text-xs font-bold uppercase tracking-widest disabled:opacity-50 transition-all duration-200 shadow-lg active:scale-[0.98]"
            >
              {mode === "sign_in" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-4 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            <div className="flex-1 border-t border-border" />
            or
            <div className="flex-1 border-t border-border" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="w-full glass-panel hover:bg-surface-2 border border-border py-3 rounded-2xl text-xs font-semibold transition-all duration-200 active:scale-[0.98]"
          >
            Continue with Google
          </button>
        </div>

        <p className="text-center text-[9px] font-medium uppercase tracking-widest text-muted-foreground/60 mt-8">
          Private by design · Encrypted at rest
        </p>
      </div>
    </div>
  );
}