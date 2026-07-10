import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computeHealthScore } from "./health";

const relationshipTypes = [
  "family",
  "friend",
  "partner",
  "coworker",
  "manager",
  "client",
  "mentor",
  "mentee",
  "investor",
  "acquaintance",
  "other",
] as const;

const CreatePersonInput = z.object({
  name: z.string().min(1).max(200),
  relationship_type: z.enum(relationshipTypes).default("friend"),
  company: z.string().max(200).optional().nullable(),
  role: z.string().max(200).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  birthday: z.string().optional().nullable(),
  anniversary: z.string().optional().nullable(),
  how_we_met: z.string().max(500).optional().nullable(),
  target_cadence_days: z.number().int().min(1).max(365).default(30),
  tags: z.array(z.string()).default([]),
  bio: z.string().max(2000).optional().nullable(),
});

export const listPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { search?: string } = {}) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("people")
      .select("*")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("name");
    if (data.search) q = q.ilike("name", `%${data.search}%`);
    const { data: people, error } = await q;
    if (error) throw new Error(error.message);
    return { people: people ?? [] };
  });

export const getPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: person, error } = await supabase
      .from("people")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!person) throw new Error("Not found");

    const [ints, nts, flds, rmnds, prms] = await Promise.all([
      supabase
        .from("interactions")
        .select("*")
        .eq("person_id", data.id)
        .order("occurred_at", { ascending: false })
        .limit(50),
      supabase
        .from("notes")
        .select("*")
        .eq("person_id", data.id)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("person_fields").select("*").eq("person_id", data.id),
      supabase
        .from("reminders")
        .select("*")
        .eq("person_id", data.id)
        .eq("status", "open")
        .order("due_at"),
      supabase
        .from("promises")
        .select("*")
        .eq("person_id", data.id)
        .order("created_at", { ascending: false }),
    ]);

    const interactions = ints.data ?? [];
    const notes = nts.data ?? [];
    const fields = flds.data ?? [];
    const reminders = rmnds.data ?? [];
    const promises = prms.data ?? [];

    const now = Date.now();
    const last = interactions[0];
    const daysSince = last
      ? Math.floor((now - new Date(last.occurred_at).getTime()) / 86400000)
      : null;
    const cutoff = now - 90 * 86400000;
    const interactions90 = interactions.filter(
      (i) => new Date(i.occurred_at).getTime() >= cutoff,
    ).length;
    const promisesKept = promises.filter((p) => p.status === "kept").length;

    const score = computeHealthScore({
      targetCadenceDays: person.target_cadence_days,
      daysSinceLastInteraction: daysSince,
      interactionsLast90Days: interactions90,
      notesCount: notes.length,
      fieldsCount: fields.length,
      promisesKept,
      promisesTotal: promises.length,
      hasBirthday: !!person.birthday,
      hasAnniversary: !!person.anniversary,
    });

    return {
      person,
      interactions,
      notes,
      fields,
      reminders,
      promises,
      health: { score, daysSinceLastInteraction: daysSince },
    };
  });

export const createPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreatePersonInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      ...data,
      email: data.email === "" ? null : data.email,
      birthday: data.birthday || null,
      anniversary: data.anniversary || null,
      user_id: userId,
    };
    const { data: created, error } = await supabase
      .from("people")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { person: created };
  });

export const updatePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ id: z.string().uuid() })
      .merge(CreatePersonInput.partial())
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const payload = {
      ...rest,
      email: rest.email === "" ? null : rest.email,
      birthday: rest.birthday || null,
      anniversary: rest.anniversary || null,
    };
    const { data: updated, error } = await supabase
      .from("people")
      .update(payload)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { person: updated };
  });

export const deletePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("people")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        person_id: z.string().uuid(),
        body: z.string().min(1).max(10000),
        pinned: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: note, error } = await context.supabase
      .from("notes")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { note };
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notes")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        person_id: z.string().uuid(),
        category: z.string().min(1).max(50),
        key: z.string().min(1).max(100),
        value: z.string().max(500).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: field, error } = await context.supabase
      .from("person_fields")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { field };
  });

export const deleteField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("person_fields")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });