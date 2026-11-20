import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const INTERACTION_TYPES = [
  "call",
  "message",
  "meeting",
  "email",
  "coffee",
  "gift",
  "note",
  "milestone",
] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number];

const InteractionInput = z.object({
  person_id: z.string().uuid(),
  type: z.enum([
    "call",
    "message",
    "meeting",
    "email",
    "coffee",
    "gift",
    "note",
    "milestone",
  ] as const),
  channel: z.string().max(50).optional().nullable(),
  occurred_at: z.string().optional(),
  summary: z.string().max(2000).optional().nullable(),
  mood: z.string().max(50).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
});

export const logInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => InteractionInput.parse(data))
  .handler(async ({ data, context }) => {
    const payload = {
      person_id: data.person_id,
      type: data.type,
      summary: data.summary || null,
      occurred_at: data.occurred_at || new Date().toISOString(),
      user_id: context.userId,
      ...(data.channel ? { channel: data.channel } : {}),
      ...(data.mood ? { mood: data.mood } : {}),
      ...(data.location ? { location: data.location } : {}),
    };

    const { data: created, error } = await context.supabase
      .from("interactions")
      .insert(payload)
      .select()
      .single();

    if (error || !created) {
      throw new Error(error?.message || "Failed to log interaction");
    }
    return { interaction: created };
  });

export const deleteInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("interactions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
