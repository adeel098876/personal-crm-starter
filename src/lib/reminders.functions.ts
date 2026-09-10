import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ReminderInput = z.object({
  person_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional().nullable(),
  due_at: z.string(),
  recurrence: z.enum(["daily", "weekly", "monthly", "yearly"]).optional().nullable(),
  kind: z.enum(["birthday", "anniversary", "promise", "follow_up", "custom"]).default("custom"),
});

export const listReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { status?: string } = {}) => data)
  .handler(async ({ data, context }) => {
    const status = data.status ?? "open";
    const { data: reminders, error } = await context.supabase
      .from("reminders")
      .select("*, people(id, name)")
      .eq("user_id", context.userId)
      .eq("status", status)
      .order("due_at");
    if (error) throw new Error(error.message);
    return { reminders: reminders ?? [] };
  });

export const createReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => ReminderInput.parse(data))
  .handler(async ({ data, context }) => {
    const payload: Record<string, unknown> = {
      title: data.title,
      due_at: data.due_at,
      user_id: context.userId,
      status: "open",
    };
    if (data.person_id) payload.person_id = data.person_id;
    if (data.notes) payload.notes = data.notes;
    if (data.recurrence) payload.recurrence = data.recurrence;
    if (data.kind) payload.kind = data.kind;

    const { data: initialCreated, error: initialError } = await context.supabase
      .from("reminders")
      .insert(payload)
      .select()
      .single();

    let created = initialCreated;

    if (initialError) {
      // Fallback for database instances where newer columns (kind, notes, recurrence) are not yet migrated
      const fallbackPayload: Record<string, unknown> = {
        title: data.title,
        due_at: data.due_at,
        user_id: context.userId,
        status: "open",
      };
      if (data.person_id) fallbackPayload.person_id = data.person_id;

      const res = await context.supabase
        .from("reminders")
        .insert(fallbackPayload)
        .select()
        .single();
      if (res.error) throw new Error(res.error.message);
      created = res.data;
    }
    return { reminder: created };
  });

export const completeReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("reminders")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const snoozeReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ id: z.string().uuid(), days: z.number().int().min(1).max(365) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const due = new Date(Date.now() + data.days * 86400000).toISOString();
    const { error } = await context.supabase
      .from("reminders")
      .update({ due_at: due })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createPromise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        person_id: z.string().uuid(),
        description: z.string().min(1).max(500),
        due_at: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const payload: {
      person_id: string;
      description: string;
      user_id: string;
      status: string;
      due_at?: string | null;
    } = {
      person_id: data.person_id,
      description: data.description,
      user_id: context.userId,
      status: "open",
    };
    if (data.due_at) payload.due_at = data.due_at;

    const { data: created, error } = await context.supabase
      .from("promises")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { promise: created };
  });

export const resolvePromise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["kept", "broken", "cancelled"]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let res = await context.supabase
      .from("promises")
      .update({ status: data.status, completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (res.error) {
      res = await context.supabase
        .from("promises")
        .update({ status: data.status })
        .eq("id", data.id)
        .eq("user_id", context.userId);
    }
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });
