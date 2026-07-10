import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/today", replace: true });
    });
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
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
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/today", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="font-bold tracking-tighter text-2xl">KINETIC</div>
          <p className="mt-2 text-xs font-mono text-muted-foreground uppercase tracking-[0.2em]">
            Relationship OS
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-6">
          <div className="flex gap-1 mb-6 p-1 bg-background rounded border border-border text-xs font-mono uppercase tracking-widest">
            <button
              onClick={() => setMode("sign_in")}
              className={`flex-1 py-1.5 rounded transition-colors ${mode === "sign_in" ? "bg-surface text-foreground" : "text-muted-foreground"}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode("sign_up")}
              className={`flex-1 py-1.5 rounded transition-colors ${mode === "sign_up" ? "bg-surface text-foreground" : "text-muted-foreground"}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-accent/50"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-foreground text-background py-2 rounded text-xs font-bold uppercase tracking-widest disabled:opacity-50"
            >
              {mode === "sign_in" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <div className="flex-1 border-t border-border" />
            or
            <div className="flex-1 border-t border-border" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={busy}
            className="w-full border border-border py-2 rounded text-xs font-medium hover:bg-surface transition-colors disabled:opacity-50"
          >
            Continue with Google
          </button>
        </div>

        <p className="text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-6">
          Private by design · Encrypted at rest
        </p>
      </div>
    </div>
  );
}