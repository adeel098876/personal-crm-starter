import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import {
  getVapidPublicKey,
  savePushSubscription,
  deletePushSubscription,
  listPushSubscriptions,
  testPush,
} from "@/lib/push.functions";
import { deleteAccount } from "@/lib/people.functions";
import {
  isIos,
  isPushSupported,
  isStandalone,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [pushSupported, setPushSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "default">("default");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installedOnHome, setInstalledOnHome] = useState(false);
  const [ios, setIos] = useState(false);

  const { theme, setTheme } = useTheme();

  const getKey = useServerFn(getVapidPublicKey);
  const saveSub = useServerFn(savePushSubscription);
  const delSub = useServerFn(deletePushSubscription);
  const testSend = useServerFn(testPush);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    setPushSupported(isPushSupported());
    setIos(isIos());
    setInstalledOnHome(isStandalone());
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    if (isPushSupported()) {
      navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
        if (!reg) return;
        const sub = await reg.pushManager.getSubscription();
        setEnabled(!!sub);
      });
    }
  }, []);

  async function enablePush() {
    setBusy(true);
    try {
      const { publicKey } = await getKey();
      const sub = await subscribeToPush(publicKey);
      await saveSub({
        data: {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          user_agent: navigator.userAgent.slice(0, 500),
        },
      });
      setEnabled(true);
      setPermission("granted");
      toast.success("Push notifications enabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to enable push");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) await delSub({ data: { endpoint } });
      setEnabled(false);
      toast.success("Push notifications disabled");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    try {
      const res = await testSend();
      toast.success(`Sent to ${res.sent} device(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out");
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign out failed");
    }
  }

  async function deleteMyAccount() {
    if (!confirm("Delete your account and all of your data? This cannot be undone.")) {
      return;
    }
    setBusy(true);
    try {
      await deleteAccount();
      toast.success("Account deleted");
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Account deletion failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 max-w-xl mx-auto">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Account
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight mt-1 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground">
          Settings
        </h1>
      </header>

      {/* Account Info */}
      <div className="glass-panel rounded-3xl p-6 space-y-4 shadow-xl">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Signed in as
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{email || "—"}</p>
        </div>
        <button
          onClick={signOut}
          className="text-xs font-bold uppercase tracking-wider text-destructive border border-destructive/20 hover:bg-destructive/10 rounded-full px-5 py-2.5 transition-all duration-200 active:scale-95"
        >
          Sign out
        </button>
        <button
          onClick={deleteMyAccount}
          disabled={busy}
          className="text-[10px] font-bold uppercase tracking-wider text-destructive/70 border border-destructive/20 hover:bg-destructive/10 rounded-full px-5 py-2 transition-all duration-200 active:scale-95 disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Delete account"}
        </button>
      </div>

      {/* Theme & Appearance */}
      <div className="glass-panel rounded-3xl p-6 space-y-4 shadow-xl">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Appearance & Theme
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Customize Kinetic's appearance for day or night. Auto syncs with system settings.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1">
          {[
            {
              id: "light" as const,
              label: "Light",
              icon: (
                <svg
                  className="size-4"
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
              ),
            },
            {
              id: "dark" as const,
              label: "Dark",
              icon: (
                <svg
                  className="size-4"
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
              ),
            },
            {
              id: "system" as const,
              label: "Auto System",
              icon: (
                <svg
                  className="size-4"
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
              ),
            },
          ].map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all duration-200 ${
                  active
                    ? "border-primary/50 bg-primary/10 text-primary font-bold shadow-md scale-[1.02]"
                    : "border-border bg-surface hover:bg-surface-2 text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="mb-2">{t.icon}</div>
                <span className="text-xs font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications */}
      <div className="glass-panel rounded-3xl p-6 space-y-4 shadow-xl">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Push notifications
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Get notified when reminders are due — even when Kinetic isn't open.
          </p>
        </div>

        {!pushSupported && (
          <p className="text-xs text-destructive">This browser doesn't support web push.</p>
        )}

        {pushSupported && ios && !installedOnHome && (
          <div className="text-xs glass-panel border border-border rounded-2xl p-4 space-y-1">
            <p className="font-semibold text-foreground">
              iOS requires installing Kinetic to your Home Screen first.
            </p>
            <p className="text-muted-foreground">
              In Safari: Share → Add to Home Screen. Then open Kinetic from the icon and come back
              here.
            </p>
          </div>
        )}

        {pushSupported && (!ios || installedOnHome) && (
          <div className="flex flex-wrap gap-2.5">
            {!enabled ? (
              <button
                onClick={enablePush}
                disabled={busy}
                className="bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-all active:scale-95 shadow-md"
              >
                {busy ? "Enabling…" : "Enable notifications"}
              </button>
            ) : (
              <>
                <button
                  onClick={disablePush}
                  disabled={busy}
                  className="px-5 py-2.5 border border-border rounded-full text-xs font-bold uppercase tracking-wider hover:bg-surface-2 transition-all active:scale-95"
                >
                  Disable
                </button>
                <button
                  onClick={sendTest}
                  className="px-5 py-2.5 border border-primary/30 text-primary bg-primary/10 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-primary hover:text-white transition-all active:scale-95"
                >
                  Send test
                </button>
              </>
            )}
          </div>
        )}

        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
          Permission: {permission} · Status: {enabled ? "on" : "off"}
        </p>

        <div className="text-[11px] text-muted-foreground border-t border-border pt-4 space-y-1">
          <p className="font-semibold text-foreground">Coming with the native iOS app</p>
          <p className="leading-relaxed">
            Today widgets, Live Activities, and full lock-screen surfaces for birthdays and meetings
            require iOS native APIs (WidgetKit + ActivityKit).
          </p>
        </div>
      </div>

      {/* Importer Link */}
      <div className="glass-panel rounded-3xl p-6">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Data Import
        </p>
        <p className="mt-1 text-xs text-muted-foreground mb-3 leading-relaxed">
          Bring in contacts from Google, Apple, or CSV spreadsheets.
        </p>
        <Link
          to="/import"
          className="inline-block bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all hover:opacity-90 active:scale-95 shadow-md"
        >
          Open importer
        </Link>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="glass-panel rounded-3xl p-6 text-sm text-muted-foreground space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Keyboard shortcuts
        </p>
        <ul className="font-mono text-xs space-y-1.5 mt-2">
          <li>
            <kbd className="px-2 py-0.5 rounded bg-surface border border-border text-[10px]">
              ⌘K
            </kbd>{" "}
            — command palette
          </li>
          <li>
            <kbd className="px-2 py-0.5 rounded bg-surface border border-border text-[10px]">
              1–5
            </kbd>{" "}
            — jump between pages
          </li>
        </ul>
      </div>
    </div>
  );
}
