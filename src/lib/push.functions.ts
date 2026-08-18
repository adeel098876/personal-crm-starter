import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const { getOrCreateVapidKeys } = await import("./push.server");
  const keys = await getOrCreateVapidKeys();
  return { publicKey: keys.publicKey };
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        endpoint: z.string().url(),
        p256dh: z.string().min(1),
        auth: z.string().min(1),
        user_agent: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.user_agent ?? null,
        active: true,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ endpoint: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", data.endpoint);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPushSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("push_subscriptions")
      .select("id, endpoint, user_agent, active, created_at, last_used_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return { subscriptions: data ?? [] };
  });

export const testPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data?: unknown) => data)
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId)
      .eq("active", true);
    if (!subs || subs.length === 0) throw new Error("No active push subscriptions.");
    const { getOrCreateVapidKeys, sendWebPush } = await import("./push.server");
    const keys = await getOrCreateVapidKeys();
    const results = await Promise.all(subs.map((s) => sendWebPush(s, keys)));
    return { sent: results.length, statuses: results.map((r) => r.status) };
  });
