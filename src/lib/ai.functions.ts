import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GROQ_MODEL = "llama-3.3-70b-versatile";

async function callAI(
  messages: Array<{ role: string; content: string }>,
  jsonMode = false,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "GROQ_API_KEY is not configured. Add GROQ_API_KEY=gsk_... to your .env file and restart the server.",
    );
  }

  const payloadMessages = messages.map((m) => ({ ...m }));
  if (jsonMode && payloadMessages[0]?.role === "system") {
    payloadMessages[0].content +=
      "\nIMPORTANT: Respond ONLY with valid raw JSON. No markdown, no code fences, no intro text.";
  }

  const body: any = {
    model: GROQ_MODEL,
    messages: payloadMessages,
    temperature: 0.3,
    max_tokens: 2000,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Groq API Error (${res.status}): ${await res.text()}`);

  const data = await res.json();
  let content: string = data.choices?.[0]?.message?.content ?? "";
  content = content.trim();
  if (content.startsWith("```json")) content = content.slice(7);
  else if (content.startsWith("```")) content = content.slice(3);
  if (content.endsWith("```")) content = content.slice(0, -3);
  return content.trim();
}

// ─── Smart Search ──────────────────────────────────────────────────────────────
export const smartSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { query: string }) =>
    z.object({ query: z.string().min(1).max(500) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [pplRes, fldRes] = await Promise.all([
      supabase.from("people").select("id, name, company, role, location, tags, bio, birthday").eq("user_id", userId).eq("archived", false).limit(500),
      supabase.from("person_fields").select("person_id, category, key, value").eq("user_id", userId),
    ]);
    const people = pplRes.data ?? [];
    const fields = fldRes.data ?? [];
    const enriched = people.map((p) => ({ ...p, fields: fields.filter((f) => f.person_id === p.id) }));
    if (enriched.length === 0) return { people: [], reason: "No contacts yet." };

    const raw = await callAI([
      { role: "system", content: "Match contacts against a natural-language query. Return JSON: { ids: string[], reason: string }. Be fuzzy but never invent people." },
      { role: "user", content: `Query: ${data.query}\n\nContacts:\n${JSON.stringify(enriched)}` },
    ], true);

    try {
      const parsed = JSON.parse(raw) as { ids: string[]; reason: string };
      const idSet = new Set(parsed.ids);
      return { people: people.filter((p) => idSet.has(p.id)), reason: parsed.reason };
    } catch {
      const q = data.query.toLowerCase();
      return { people: people.filter((p) => p.name.toLowerCase().includes(q)), reason: "Keyword match" };
    }
  });

// ─── Meeting Brief ─────────────────────────────────────────────────────────────
export const meetingPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { person_id: string }) => z.object({ person_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: person } = await supabase.from("people").select("*").eq("id", data.person_id).eq("user_id", userId).maybeSingle();
    if (!person) throw new Error("Contact not found");
    const [ints, nts, flds, prms] = await Promise.all([
      supabase.from("interactions").select("*").eq("person_id", data.person_id).order("occurred_at", { ascending: false }).limit(20),
      supabase.from("notes").select("*").eq("person_id", data.person_id),
      supabase.from("person_fields").select("*").eq("person_id", data.person_id),
      supabase.from("promises").select("*").eq("person_id", data.person_id).eq("status", "open"),
    ]);
    const brief = await callAI([
      { role: "system", content: "You are an executive relationship assistant. Write a tight meeting brief in plain markdown with sections: **Context**, **Last conversation**, **Open loops**, **Talking points**, **Personal touches**. Bullet points, no fluff." },
      { role: "user", content: `Meeting brief for: ${person.name}\n\nProfile: ${JSON.stringify(person)}\nInteractions: ${JSON.stringify(ints.data ?? [])}\nNotes: ${JSON.stringify(nts.data ?? [])}\nFields: ${JSON.stringify(flds.data ?? [])}\nOpen promises: ${JSON.stringify(prms.data ?? [])}` },
    ]);
    return { brief };
  });

// ─── Summarize Raw Notes ───────────────────────────────────────────────────────
export const summarizeNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { text: string }) => z.object({ text: z.string().min(10).max(20000) }).parse(data))
  .handler(async ({ data }) => {
    const content = await callAI([
      { role: "system", content: "Extract structure from raw meeting notes. Return JSON: { summary: string, actions: [{owner, description}], follow_ups: [{title, when}] }." },
      { role: "user", content: data.text },
    ], true);
    try { return JSON.parse(content); } catch { return { summary: content, actions: [], follow_ups: [] }; }
  });

// ─── Daily Nudges ──────────────────────────────────────────────────────────────
export const dailyNudges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data?: unknown) => data)
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [pplRes, intRes, prmRes] = await Promise.all([
      supabase.from("people").select("id, name, target_cadence_days, birthday, anniversary, relationship_type").eq("user_id", userId).eq("archived", false),
      supabase.from("interactions").select("person_id, occurred_at").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(500),
      supabase.from("promises").select("person_id, description, due_at").eq("user_id", userId).eq("status", "open"),
    ]);
    const people = pplRes.data ?? [];
    if (people.length === 0) return { nudges: [] };
    const now = Date.now();
    const lastByPerson = new Map<string, string>();
    for (const i of intRes.data ?? []) { if (!lastByPerson.has(i.person_id)) lastByPerson.set(i.person_id, i.occurred_at); }
    const today = new Date();
    const in7Days = new Date(now + 7 * 86400000);
    const summary = people.map((p) => {
      const last = lastByPerson.get(p.id);
      const days = last ? Math.floor((now - new Date(last).getTime()) / 86400000) : null;
      let birthdayThisWeek = false;
      if (p.birthday) { const bd = new Date(p.birthday); const thisYearBd = new Date(today.getFullYear(), bd.getMonth(), bd.getDate()); birthdayThisWeek = thisYearBd >= today && thisYearBd <= in7Days; }
      return { id: p.id, name: p.name, relationship_type: p.relationship_type, target_cadence_days: p.target_cadence_days, days_since_last_contact: days, overdue: days == null || days > (p.target_cadence_days ?? 30), birthday_this_week: birthdayThisWeek, birthday: p.birthday };
    }).sort((a, b) => { if (a.birthday_this_week !== b.birthday_this_week) return a.birthday_this_week ? -1 : 1; if (a.overdue !== b.overdue) return a.overdue ? -1 : 1; return (b.days_since_last_contact ?? 9999) - (a.days_since_last_contact ?? 9999); });
    const raw = await callAI([
      { role: "system", content: `You are a personal relationship coach. Today is ${today.toDateString()}. Suggest exactly 3 specific, actionable nudges. Each must reference a REAL person by their id. Return JSON: { nudges: [{ person_id, name, headline, reason, suggested_action, priority: "high"|"medium"|"low" }] }` },
      { role: "user", content: `Contacts:\n${JSON.stringify(summary.slice(0, 15))}\n\nOpen promises:\n${JSON.stringify(prmRes.data ?? [])}` },
    ], true);
    try { const p = JSON.parse(raw); return { nudges: p.nudges ?? [] }; } catch { return { nudges: [] }; }
  });

// ─── Conversation Starters ─────────────────────────────────────────────────────
export const getConversationStarters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { person_id: string }) => z.object({ person_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: person } = await supabase.from("people").select("*").eq("id", data.person_id).eq("user_id", userId).maybeSingle();
    if (!person) throw new Error("Contact not found");
    const [ints, nts, flds] = await Promise.all([
      supabase.from("interactions").select("type, summary, occurred_at").eq("person_id", data.person_id).order("occurred_at", { ascending: false }).limit(10),
      supabase.from("notes").select("body, content, created_at").eq("person_id", data.person_id).limit(5),
      supabase.from("person_fields").select("category, key, value").eq("person_id", data.person_id),
    ]);
    const raw = await callAI([
      { role: "system", content: "Generate 3 personalized conversation starters. Return JSON: { starters: [{ opener: string, context: string, tone: 'warm'|'professional'|'playful' }] }. Make them specific and human — not generic." },
      { role: "user", content: `For: ${person.name}\nProfile: ${JSON.stringify(person)}\nInteractions: ${JSON.stringify(ints.data ?? [])}\nNotes: ${JSON.stringify(nts.data ?? [])}\nDetails: ${JSON.stringify(flds.data ?? [])}` },
    ], true);
    try { const p = JSON.parse(raw); return { starters: p.starters ?? [] }; } catch { return { starters: [] }; }
  });

// ─── Draft Message ─────────────────────────────────────────────────────────────
export const draftMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      person_id: z.string().uuid(),
      occasion: z.enum(["birthday", "checkin", "followup", "thankyou", "apology", "congratulations"]),
      tone: z.enum(["warm", "professional", "casual"]).default("warm"),
      extra_context: z.string().max(500).optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: person } = await supabase.from("people").select("*").eq("id", data.person_id).eq("user_id", userId).maybeSingle();
    if (!person) throw new Error("Contact not found");
    const [ints, nts] = await Promise.all([
      supabase.from("interactions").select("type, summary, occurred_at").eq("person_id", data.person_id).order("occurred_at", { ascending: false }).limit(5),
      supabase.from("notes").select("body, content").eq("person_id", data.person_id).limit(3),
    ]);
    const occasionLabels: Record<string, string> = { birthday: "a birthday message", checkin: "a casual check-in", followup: "a follow-up", thankyou: "a thank you", apology: "an apology", congratulations: "a congratulations message" };
    const message = await callAI([
      { role: "system", content: `Draft ${occasionLabels[data.occasion]} to ${person.name}. Tone: ${data.tone}. 2-4 sentences max. Use real context to make it personal. Sound human.` },
      { role: "user", content: `${person.name} (${person.relationship_type})\nProfile: ${JSON.stringify(person)}\nInteractions: ${JSON.stringify(ints.data ?? [])}\nNotes: ${JSON.stringify(nts.data ?? [])}${data.extra_context ? `\nExtra: ${data.extra_context}` : ""}` },
    ]);
    return { message };
  });

// ─── Relationship Diagnosis ────────────────────────────────────────────────────
export const diagnoseRelationship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { person_id: string }) => z.object({ person_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: person } = await supabase.from("people").select("*").eq("id", data.person_id).eq("user_id", userId).maybeSingle();
    if (!person) throw new Error("Contact not found");
    const [ints, prms, nts] = await Promise.all([
      supabase.from("interactions").select("type, summary, occurred_at").eq("person_id", data.person_id).order("occurred_at", { ascending: false }).limit(30),
      supabase.from("promises").select("description, status, created_at").eq("person_id", data.person_id),
      supabase.from("notes").select("body, content, created_at").eq("person_id", data.person_id).limit(10),
    ]);
    const raw = await callAI([
      { role: "system", content: `Analyze the relationship health. Return JSON: { score_label: "Thriving"|"Healthy"|"Drifting"|"At Risk"|"Dormant", summary: string, strengths: string[], risks: string[], top_action: string }. Be honest and specific.` },
      { role: "user", content: `Relationship with: ${person.name}\nProfile: ${JSON.stringify(person)}\nInteractions: ${JSON.stringify(ints.data ?? [])}\nPromises: ${JSON.stringify(prms.data ?? [])}\nNotes: ${JSON.stringify(nts.data ?? [])}` },
    ], true);
    try { return JSON.parse(raw); } catch { return { score_label: "Unknown", summary: raw, strengths: [], risks: [], top_action: "" }; }
  });

// ─── AI Roster Engine ──────────────────────────────────────────────────────────
export const analyzeRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data?: unknown) => data)
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [pplRes, intRes, prmRes, notesRes] = await Promise.all([
      supabase.from("people").select("id, name, relationship_type, target_cadence_days, birthday, anniversary, tags").eq("user_id", userId).eq("archived", false),
      supabase.from("interactions").select("person_id, occurred_at, type").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(1000),
      supabase.from("promises").select("person_id, status").eq("user_id", userId),
      supabase.from("notes").select("person_id").eq("user_id", userId),
    ]);

    const people = pplRes.data ?? [];
    if (people.length === 0) return { analyses: [] };

    const now = Date.now();
    const lastByPerson = new Map<string, string>();
    const countByPerson = new Map<string, number>();
    for (const i of intRes.data ?? []) {
      if (!lastByPerson.has(i.person_id)) lastByPerson.set(i.person_id, i.occurred_at);
      countByPerson.set(i.person_id, (countByPerson.get(i.person_id) ?? 0) + 1);
    }
    const notesByPerson = new Map<string, number>();
    for (const n of notesRes.data ?? []) notesByPerson.set(n.person_id, (notesByPerson.get(n.person_id) ?? 0) + 1);
    const promisesByPerson = new Map<string, { kept: number; total: number }>();
    for (const p of prmRes.data ?? []) {
      const cur = promisesByPerson.get(p.person_id) ?? { kept: 0, total: 0 };
      cur.total++;
      if (p.status === "kept") cur.kept++;
      promisesByPerson.set(p.person_id, cur);
    }

    // Build summary for AI — send in chunks of 20 to keep prompt manageable
    const CHUNK = 20;
    const allAnalyses: Array<{ id: string; score_label: string; ai_score: number; reason: string; trend: string }> = [];

    for (let start = 0; start < people.length; start += CHUNK) {
      const chunk = people.slice(start, start + CHUNK);
      const summaries = chunk.map((p) => {
        const last = lastByPerson.get(p.id);
        const daysSince = last ? Math.floor((now - new Date(last).getTime()) / 86400000) : null;
        const count90 = (intRes.data ?? []).filter((i) => i.person_id === p.id && (now - new Date(i.occurred_at).getTime()) < 90 * 86400000).length;
        const proms = promisesByPerson.get(p.id);
        return {
          id: p.id,
          name: p.name,
          relationship_type: p.relationship_type,
          cadence: p.target_cadence_days,
          days_since_last: daysSince,
          interactions_90d: count90,
          notes_count: notesByPerson.get(p.id) ?? 0,
          promises_kept: proms?.kept ?? 0,
          promises_total: proms?.total ?? 0,
          has_birthday: !!p.birthday,
        };
      });

      const raw = await callAI([
        {
          role: "system",
          content: `You are an AI relationship health engine. Analyze each contact and return a JSON array.
For each contact, produce:
- id: the contact's id (copy verbatim)
- score_label: "Thriving" | "Healthy" | "Drifting" | "At Risk" | "Dormant"
- ai_score: integer 0-100 (your holistic health score)
- reason: one specific sentence explaining the rating
- trend: "improving" | "stable" | "declining"

Scoring guidance:
- Thriving (85-100): on cadence, strong interaction history, notes, promises kept
- Healthy (65-84): mostly on cadence, occasional gaps
- Drifting (40-64): missed cadence, sparse interactions
- At Risk (20-39): significantly overdue, no recent contact
- Dormant (0-19): never contacted or extremely long absence

Return ONLY JSON: { analyses: [...] }`,
        },
        { role: "user", content: JSON.stringify(summaries) },
      ], true);

      try {
        const parsed = JSON.parse(raw) as { analyses: Array<{ id: string; score_label: string; ai_score: number; reason: string; trend: string }> };
        allAnalyses.push(...(parsed.analyses ?? []));
      } catch {
        // Fallback: mark chunk with basic label
        chunk.forEach((p) => {
          const last = lastByPerson.get(p.id);
          const days = last ? Math.floor((now - new Date(last).getTime()) / 86400000) : null;
          const overdue = days == null || days > p.target_cadence_days;
          allAnalyses.push({ id: p.id, score_label: overdue ? "Drifting" : "Healthy", ai_score: overdue ? 45 : 70, reason: "Analysis unavailable", trend: "stable" });
        });
      }
    }

    return { analyses: allAnalyses };
  });

// ─── AI Import Classification ──────────────────────────────────────────────────
const ContactRaw = z.object({
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

const RELATIONSHIP_TYPES = ["family", "friend", "partner", "coworker", "manager", "client", "mentor", "mentee", "investor", "acquaintance", "other"] as const;

export const classifyImportContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      contacts: z.array(ContactRaw).max(500),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const contacts = data.contacts;
    if (contacts.length === 0) return { classified: [] };

    const CHUNK = 25;
    const allClassified: Array<{
      index: number;
      relationship_type: string;
      target_cadence_days: number;
      inferred_role: string | null;
      confidence: number;
      reason: string;
    }> = [];

    for (let i = 0; i < contacts.length; i += CHUNK) {
      const chunk = contacts.slice(i, i + CHUNK);
      const raw = await callAI([
        {
          role: "system",
          content: `You classify imported contacts for a personal CRM. For each contact (given as index → data), predict:
- relationship_type: one of: ${RELATIONSHIP_TYPES.join(", ")}
- target_cadence_days: how often to reach out (family/partner: 7, close friend: 14, friend: 30, coworker: 14, client/investor: 30, mentor: 30, acquaintance: 90)
- inferred_role: inferred job title/role if not provided (null if unknown)
- confidence: 0.0-1.0
- reason: one sentence

Signals: email domain (company email → coworker/client), company field, job title, notes content, name patterns.

Return JSON: { predictions: [{ index, relationship_type, target_cadence_days, inferred_role, confidence, reason }] }`,
        },
        {
          role: "user",
          content: chunk.map((c, idx) => `${idx}: ${JSON.stringify(c)}`).join("\n"),
        },
      ], true);

      try {
        const parsed = JSON.parse(raw) as {
          predictions: Array<{ index: number; relationship_type: string; target_cadence_days: number; inferred_role: string | null; confidence: number; reason: string }>;
        };
        for (const p of parsed.predictions ?? []) {
          allClassified.push({ ...p, index: p.index + i });
        }
      } catch {
        // Fallback
        chunk.forEach((_, j) => {
          allClassified.push({ index: i + j, relationship_type: "acquaintance", target_cadence_days: 90, inferred_role: null, confidence: 0.3, reason: "AI classification unavailable" });
        });
      }
    }

    return { classified: allClassified };
  });