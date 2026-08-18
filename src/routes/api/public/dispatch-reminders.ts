import { createFileRoute } from "@tanstack/react-router";

// Called every 5 minutes by pg_cron. Sends a payload-less web push to every
// user who has an active subscription and at least one reminder that just
// became due (in the last 6 minutes so we don't miss any and don't repeat).

export const Route = createFileRoute("/api/public/dispatch-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { getOrCreateVapidKeys, sendWebPush } = await import("@/lib/push.server");

        const now = new Date();
        const windowStart = new Date(now.getTime() - 6 * 60 * 1000).toISOString();
        const windowEnd = now.toISOString();

        // Find reminders that became due in the last 6 minutes.
        const { data: due, error: dueErr } = await supabaseAdmin
          .from("reminders")
          .select("user_id, id, title, due_at")
          .eq("status", "open")
          .gte("due_at", windowStart)
          .lte("due_at", windowEnd);

        if (dueErr) {
          return new Response(JSON.stringify({ error: dueErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const userIds = Array.from(new Set((due ?? []).map((r) => r.user_id)));
        if (userIds.length === 0) {
          return Response.json({ ok: true, dispatched: 0, users: 0 });
        }

        const [{ data: subs }, { data: profiles }] = await Promise.all([
          supabaseAdmin
            .from("push_subscriptions")
            .select("user_id, endpoint, p256dh, auth")
            .eq("active", true)
            .in("user_id", userIds),
          supabaseAdmin
            .from("profiles")
            .select("id, push_enabled, push_quiet_hours")
            .in("id", userIds),
        ]);

        const prefById = new Map((profiles ?? []).map((p) => [p.id, p]));

        function inQuietHours(pref: any): boolean {
          if (!pref || pref.push_enabled === false) return true;
          const q = pref.push_quiet_hours ?? {};
          const startH = Number(q.start_hour ?? 22);
          const endH = Number(q.end_hour ?? 8);
          const hour = now.getUTCHours(); // Simple UTC check; per-user TZ handled client-side.
          if (startH === endH) return false;
          if (startH < endH) return hour >= startH && hour < endH;
          return hour >= startH || hour < endH;
        }

        const keys = await getOrCreateVapidKeys();
        let dispatched = 0;
        const deadEndpoints: string[] = [];

        for (const sub of subs ?? []) {
          const pref = prefById.get(sub.user_id);
          if (pref && (pref.push_enabled === false || inQuietHours(pref))) continue;
          const result = await sendWebPush(sub as any, keys);
          if (result.status === 404 || result.status === 410) {
            deadEndpoints.push(sub.endpoint);
          } else if (result.status >= 200 && result.status < 300) {
            dispatched++;
          }
        }

        if (deadEndpoints.length > 0) {
          await supabaseAdmin
            .from("push_subscriptions")
            .update({ active: false })
            .in("endpoint", deadEndpoints);
        }

        return Response.json({
          ok: true,
          dispatched,
          reaped: deadEndpoints.length,
          reminders_matched: (due ?? []).length,
        });
      },
    },
  },
});
