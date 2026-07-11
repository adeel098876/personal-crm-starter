import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getVapidPublicKey,
  savePushSubscription,
  deletePushSubscription,
  listPushSubscriptions,
  testPush,
} from "@/lib/push.functions";
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

  const getKey = useServerFn(getVapidPublicKey);
  const saveSub = useServerFn(savePushSubscription);
  const delSub = useServerFn(deletePushSubscription);
  const listSubs = useServerFn(listPushSubscriptions);
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

      <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Push notifications
          </p>
          <p className="mt-1 text-sm">
            Get notified when reminders are due — even when Kinetic isn't open.
          </p>
        </div>

        {!pushSupported && (
          <p className="text-xs text-destructive">
            This browser doesn't support web push.
          </p>
        )}

        {pushSupported && ios && !installedOnHome && (
          <div className="text-xs bg-background border border-border rounded p-3 space-y-1">
            <p className="font-semibold">iOS requires installing Kinetic to your Home Screen first.</p>
            <p className="text-muted-foreground">
              In Safari: Share → Add to Home Screen. Then open Kinetic from the icon and come back here.
            </p>
          </div>
        )}

        {pushSupported && (!ios || installedOnHome) && (
          <div className="flex flex-wrap gap-2">
            {!enabled ? (
              <button
                onClick={enablePush}
                disabled={busy}
                className="bg-foreground text-background px-4 py-2 rounded text-xs font-bold uppercase tracking-widest disabled:opacity-50"
              >
                {busy ? "Enabling…" : "Enable notifications"}
              </button>
            ) : (
              <>
                <button
                  onClick={disablePush}
                  disabled={busy}
                  className="px-4 py-2 border border-border rounded text-xs font-bold uppercase tracking-widest"
                >
                  Disable
                </button>
                <button
                  onClick={sendTest}
                  className="px-4 py-2 border border-accent/30 text-accent rounded text-xs font-bold uppercase tracking-widest"
                >
                  Send test
                </button>
              </>
            )}
          </div>
        )}

        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Permission: {permission} · Status: {enabled ? "on" : "off"}
        </p>

        <div className="text-[11px] text-muted-foreground border-t border-border pt-3 space-y-1">
          <p className="font-semibold text-foreground/80">Coming with the native iOS app</p>
          <p>
            Today widgets, Live Activities, and the full lock-screen surface for birthdays and
            meetings require iOS APIs (WidgetKit + ActivityKit) that aren't available to web apps.
            They're on the roadmap for the Kinetic iOS build.
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Data
        </p>
        <p className="mt-1 text-sm mb-3">Bring in contacts from Google, Apple, or CSV.</p>
        <Link
          to="/import"
          className="inline-block bg-foreground text-background px-4 py-2 rounded text-xs font-bold uppercase tracking-widest"
        >
          Open importer
        </Link>
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