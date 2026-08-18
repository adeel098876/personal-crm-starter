import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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

const ContactInput = z.object({
  external_id: z.string().optional().nullable(),
  name: z.string().min(1).max(200),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  birthday: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

const PredictionSchema = z.object({
  index: z.number().int(),
  relationship_type: z.enum(relationshipTypes),
  target_cadence_days: z.number().int().min(1).max(365),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(200),
});

export type ContactPrediction = z.infer<typeof PredictionSchema> & {
  contact: z.infer<typeof ContactInput>;
};

export const previewAndImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        source: z.enum(["vcard", "csv", "google"]),
        contacts: z.array(ContactInput).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Dedupe against existing (by external_id or email)
    const externalIds = data.contacts.map((c) => c.external_id).filter(Boolean) as string[];
    const emails = data.contacts.map((c) => c.email).filter(Boolean) as string[];

    const [existingExt, existingEmail] = await Promise.all([
      externalIds.length
        ? supabase
            .from("people")
            .select("external_id")
            .eq("user_id", userId)
            .eq("import_source", data.source)
            .in("external_id", externalIds)
        : Promise.resolve({ data: [] as { external_id: string | null }[] }),
      emails.length
        ? supabase.from("people").select("email").eq("user_id", userId).in("email", emails)
        : Promise.resolve({ data: [] as { email: string | null }[] }),
    ]);

    const dupeExt = new Set((existingExt.data ?? []).map((r) => r.external_id).filter(Boolean));
    const dupeEmail = new Set((existingEmail.data ?? []).map((r) => r.email).filter(Boolean));

    const fresh = data.contacts.filter((c) => {
      if (c.external_id && dupeExt.has(c.external_id)) return false;
      if (c.email && dupeEmail.has(c.email)) return false;
      return true;
    });

    const skippedDuplicates = data.contacts.length - fresh.length;

    if (fresh.length === 0) {
      const { data: batch } = await supabase
        .from("import_batches")
        .insert({
          user_id: userId,
          source: data.source,
          status: "completed",
          total_parsed: data.contacts.length,
          total_skipped: skippedDuplicates,
          stats: { reason: "all_duplicates" },
        })
        .select()
        .single();
      return {
        batch,
        autoImported: 0,
        skippedDuplicates,
        review: [] as ContactPrediction[],
      };
    }

    const autoRows = fresh.map((c) => ({
      user_id: userId,
      name: c.name,
      email: c.email || null,
      phone: c.phone || null,
      company: c.company || null,
      role: c.role || null,
      birthday: c.birthday || null,
      bio: c.notes || null,
      location: c.address || null,
      relationship_type: "friend",
      target_cadence_days: 30,
      import_source: data.source,
      external_id: c.external_id || null,
      tags: [],
    }));

    let imported = 0;
    if (autoRows.length > 0) {
      const { error, count } = await supabase.from("people").insert(autoRows, { count: "exact" });
      if (error) throw new Error(error.message);
      imported = count ?? autoRows.length;
    }

    const { data: batch } = await supabase
      .from("import_batches")
      .insert({
        user_id: userId,
        source: data.source,
        status: "completed",
        total_parsed: data.contacts.length,
        total_imported: imported,
        total_skipped: skippedDuplicates,
        total_review: 0,
        stats: { threshold: "none_direct_import" },
      })
      .select()
      .single();

    return {
      batch,
      autoImported: imported,
      skippedDuplicates,
      review: [] as ContactPrediction[],
    };
  });

export const commitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        batch_id: z.string().uuid().optional(),
        source: z.enum(["vcard", "csv", "google"]),
        items: z
          .array(
            z.object({
              contact: ContactInput,
              relationship_type: z.enum(relationshipTypes),
              target_cadence_days: z.number().int().min(1).max(365),
              skip: z.boolean().default(false),
            }),
          )
          .max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rows = data.items
      .filter((i) => !i.skip)
      .map((i) => ({
        user_id: userId,
        name: i.contact.name,
        email: i.contact.email || null,
        phone: i.contact.phone || null,
        company: i.contact.company || null,
        role: i.contact.role || null,
        birthday: i.contact.birthday || null,
        bio: i.contact.notes || null,
        location: i.contact.address || null,
        relationship_type: i.relationship_type,
        target_cadence_days: i.target_cadence_days,
        import_source: data.source,
        external_id: i.contact.external_id || null,
        tags: [],
      }));

    let imported = 0;
    if (rows.length > 0) {
      const { error, count } = await supabase
        .from("people")
        .insert(rows as any, { count: "exact" });
      if (error) throw new Error(error.message);
      imported = count ?? rows.length;
    }

    if (data.batch_id) {
      await supabase
        .from("import_batches")
        .update({
          status: "completed",
          total_imported: imported,
        })
        .eq("id", data.batch_id)
        .eq("user_id", userId);
    }

    return { imported, skipped: data.items.length - rows.length };
  });

export const listImports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data?: unknown) => data)
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("import_batches")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return { batches: data ?? [] };
  });
