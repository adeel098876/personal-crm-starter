import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MODEL = "openai/gpt-5.5";
const AUTO_IMPORT_THRESHOLD = 0.8;

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

async function callAiJson(
  messages: Array<{ role: string; content: string }>,
  schema: unknown,
): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI not configured (missing LOVABLE_API_KEY).");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: { name: "response", strict: true, schema },
      },
    }),
  });
  if (res.status === 429) throw new Error("AI rate limit — try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
  if (!res.ok) throw new Error(`AI error (${res.status})`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

async function predictBatch(
  contacts: Array<z.infer<typeof ContactInput>>,
): Promise<Array<z.infer<typeof PredictionSchema>>> {
  if (contacts.length === 0) return [];
  // Send in batches of 30 to keep AI response fast + reliable.
  const CHUNK = 30;
  const all: Array<z.infer<typeof PredictionSchema>> = [];
  for (let i = 0; i < contacts.length; i += CHUNK) {
    const chunk = contacts.slice(i, i + CHUNK);
    const raw = await callAiJson(
      [
        {
          role: "system",
          content: `You classify contacts for a personal relationship CRM. For each contact, predict:
- relationship_type: one of ${relationshipTypes.join(", ")}
- target_cadence_days: how often the user should reach out (family/partner: 7-14, close friend: 14-30, coworker: 14-30, client/investor: 30-60, mentor: 30-60, acquaintance: 90-180)
- confidence: 0.0-1.0 based on how much signal you have (name-only = <0.5, name+email/company = 0.6-0.8, rich context = 0.9+)
- reason: one short sentence

Signals to use: company (business context → coworker/client), title, notes, email domain (gmail/personal = friend, corporate = coworker), personal email vs work email.`,
        },
        {
          role: "user",
          content: `Contacts (index → data):\n${chunk
            .map((c, idx) => `${idx}: ${JSON.stringify(c)}`)
            .join("\n")}`,
        },
      ],
      {
        type: "object",
        additionalProperties: false,
        properties: {
          predictions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                index: { type: "integer" },
                relationship_type: { type: "string", enum: [...relationshipTypes] },
                target_cadence_days: { type: "integer" },
                confidence: { type: "number" },
                reason: { type: "string" },
              },
              required: ["index", "relationship_type", "target_cadence_days", "confidence", "reason"],
            },
          },
        },
        required: ["predictions"],
      },
    );
    try {
      const parsed = JSON.parse(raw) as { predictions: Array<z.infer<typeof PredictionSchema>> };
      for (const p of parsed.predictions) all.push({ ...p, index: p.index + i });
    } catch {
      // Fallback: mark this chunk as low confidence unknown
      chunk.forEach((_, j) =>
        all.push({
          index: i + j,
          relationship_type: "acquaintance",
          target_cadence_days: 90,
          confidence: 0.3,
          reason: "AI parse failed",
        }),
      );
    }
  }
  return all;
}

/**
 * Preview: takes parsed contacts, runs AI predictions, dedupes against
 * existing contacts, and auto-imports high-confidence ones.
 * Returns the review queue (low-confidence remainders).
 */
export const previewAndImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
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
        ? supabase
            .from("people")
            .select("email")
            .eq("user_id", userId)
            .in("email", emails)
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

    const predictions = await predictBatch(fresh);
    const byIndex = new Map(predictions.map((p) => [p.index, p]));

    const autoRows: any[] = [];
    const review: ContactPrediction[] = [];

    fresh.forEach((c, idx) => {
      const p = byIndex.get(idx);
      if (!p) return;
      if (p.confidence >= AUTO_IMPORT_THRESHOLD) {
        autoRows.push({
          user_id: userId,
          name: c.name,
          email: c.email || null,
          phone: c.phone || null,
          company: c.company || null,
          role: c.role || null,
          birthday: c.birthday || null,
          bio: c.notes || null,
          location: c.address || null,
          relationship_type: p.relationship_type,
          target_cadence_days: p.target_cadence_days,
          import_source: data.source,
          external_id: c.external_id || null,
          tags: [],
        });
      } else {
        review.push({ ...p, contact: c });
      }
    });

    let imported = 0;
    if (autoRows.length > 0) {
      const { error, count } = await supabase
        .from("people")
        .insert(autoRows, { count: "exact" });
      if (error) throw new Error(error.message);
      imported = count ?? autoRows.length;
    }

    const { data: batch } = await supabase
      .from("import_batches")
      .insert({
        user_id: userId,
        source: data.source,
        status: review.length ? "draft" : "completed",
        total_parsed: data.contacts.length,
        total_imported: imported,
        total_skipped: skippedDuplicates,
        total_review: review.length,
        stats: { threshold: AUTO_IMPORT_THRESHOLD },
      })
      .select()
      .single();

    return {
      batch,
      autoImported: imported,
      skippedDuplicates,
      review,
    };
  });

/**
 * Commit the reviewed contacts: user has approved (possibly edited) predictions.
 */
export const commitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
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
      const { error, count } = await supabase.from("people").insert(rows, { count: "exact" });
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
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("import_batches")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return { batches: data ?? [] };
  });