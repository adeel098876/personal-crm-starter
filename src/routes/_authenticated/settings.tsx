import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-8 max-w-xl">
      <header>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Account
        </p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Settings</h1>
      </header>

      <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Signed in as
          </p>
          <p className="mt-1 text-sm font-medium">{email || "—"}</p>
        </div>
        <button
          onClick={signOut}
          className="text-xs font-bold uppercase tracking-widest text-destructive border border-destructive/30 rounded px-4 py-2 hover:bg-destructive/10"
        >
          Sign out
        </button>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5 text-sm text-muted-foreground space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Keyboard shortcuts
        </p>
        <ul className="font-mono text-xs space-y-1 mt-2">
          <li>⌘K — command palette</li>
          <li>1–4 — jump between sections</li>
        </ul>
      </div>
    </div>
  );
}