import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InteractionInput = z.object({
  person_id: z.string().uuid(),
  type: z.enum(["call", "message", "meeting", "email", "coffee", "gift", "note", "milestone"]),
  channel: z.string().max(50).optional().nullable(),
  occurred_at: z.string().optional(),
  summary: z.string().max(2000).optional().nullable(),
  mood: z.string().max(50).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
});

export const logInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InteractionInput.parse(data))
  .handler(async ({ data, context }) => {
    const payload: any = {
      person_id: data.person_id,
      type: data.type,
      summary: data.summary || null,
      occurred_at: data.occurred_at || new Date().toISOString(),
      user_id: context.userId,
    };
    if (data.channel) payload.channel = data.channel;
    if (data.mood) payload.mood = data.mood;
    if (data.location) payload.location = data.location;

    let { data: created, error } = await context.supabase
      .from("interactions")
      .insert(payload)
      .select()
      .single();

    if (error) {
      // Fallback for minimal column schema
      const fallbackPayload = {
        person_id: data.person_id,
        type: data.type,
        summary: data.summary || null,
        occurred_at: data.occurred_at || new Date().toISOString(),
        user_id: context.userId,
      };
      const res = await context.supabase
        .from("interactions")
        .insert(fallbackPayload)
        .select()
        .single();
      if (res.error) throw new Error(res.error.message);
      created = res.data;
    }
    return { interaction: created };
  });

export const deleteInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("interactions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });