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
      "\nIMPORTANT: Respond ONLY with valid raw JSON. No markdown, no code fences, no introductory text.";
  }

  const body: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages: payloadMessages,
    temperature: 0.3,
    max_tokens: 1500,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API Error (${res.status}): ${err}`);
  }

  const data = await res.json();
  let content: string = data.choices?.[0]?.message?.content ?? "";

  // Strip markdown code fences if model ignored instructions
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
      supabase
        .from("people")
        .select("id, name, company, role, location, tags, bio, birthday")
        .eq("user_id", userId)
        .eq("archived", false)
        .limit(500),
      supabase
        .from("person_fields")
        .select("person_id, category, key, value")
        .eq("user_id", userId),
    ]);

    const people = pplRes.data ?? [];
    const fields = fldRes.data ?? [];
    const enriched = people.map((p) => ({
      ...p,
      fields: fields.filter((f) => f.person_id === p.id),
    }));
    if (enriched.length === 0) return { people: [], reason: "No contacts yet." };

    const raw = await callAI(
      [
        {
          role: "system",
          content:
            "You match contacts against a natural-language query. Return JSON with `ids` (array of matching person ids, strongest first) and `reason` (one sentence). Consider name, company, role, location, tags, bio, and custom fields. Be fuzzy but never invent people.",
        },
        {
          role: "user",
          content: `Query: ${data.query}\n\nContacts:\n${JSON.stringify(enriched)}`,
        },
      ],
      true,
    );

    try {
      const parsed = JSON.parse(raw) as { ids: string[]; reason: string };
      const idSet = new Set(parsed.ids);
      return { people: people.filter((p) => idSet.has(p.id)), reason: parsed.reason };
    } catch {
      const q = data.query.toLowerCase();
      return {
        people: people.filter((p) => p.name.toLowerCase().includes(q)),
        reason: "Keyword match",
      };
    }
  });

// ─── Meeting Brief ─────────────────────────────────────────────────────────────
export const meetingPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { person_id: string }) =>
    z.object({ person_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: person } = await supabase
      .from("people")
      .select("*")
      .eq("id", data.person_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!person) throw new Error("Contact not found");

    const [ints, nts, flds, prms] = await Promise.all([
      supabase
        .from("interactions")
        .select("*")
        .eq("person_id", data.person_id)
        .order("occurred_at", { ascending: false })
        .limit(20),
      supabase.from("notes").select("*").eq("person_id", data.person_id),
      supabase.from("person_fields").select("*").eq("person_id", data.person_id),
      supabase.from("promises").select("*").eq("person_id", data.person_id).eq("status", "open"),
    ]);

    const brief = await callAI([
      {
        role: "system",
        content:
          "You are an executive relationship assistant. Write a tight, glanceable meeting brief in plain markdown with sections: **Context**, **Last conversation**, **Open loops**, **Talking points**, **Personal touches**. Be specific, bullet-pointed, no fluff.",
      },
      {
        role: "user",
        content: `Meeting brief for: ${person.name}\n\nProfile: ${JSON.stringify(person)}\nRecent interactions: ${JSON.stringify(ints.data ?? [])}\nNotes: ${JSON.stringify(nts.data ?? [])}\nCustom fields: ${JSON.stringify(flds.data ?? [])}\nOpen promises: ${JSON.stringify(prms.data ?? [])}`,
      },
    ]);
    return { brief };
  });

// ─── Summarize Raw Notes ───────────────────────────────────────────────────────
export const summarizeNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { text: string }) =>
    z.object({ text: z.string().min(10).max(20000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const content = await callAI(
      [
        {
          role: "system",
          content:
            "Extract structure from raw meeting notes. Return JSON: { summary: string, actions: [{owner, description}], follow_ups: [{title, when}] }.",
        },
        { role: "user", content: data.text },
      ],
      true,
    );
    try {
      return JSON.parse(content) as {
        summary: string;
        actions: Array<{ owner: string; description: string }>;
        follow_ups: Array<{ title: string; when: string }>;
      };
    } catch {
      return { summary: content, actions: [], follow_ups: [] };
    }
  });

// ─── Daily Nudges (Insights Engine) ───────────────────────────────────────────
export const dailyNudges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data?: unknown) => data)
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [pplRes, intRes, prmRes] = await Promise.all([
      supabase
        .from("people")
        .select("id, name, target_cadence_days, birthday, anniversary, relationship_type")
        .eq("user_id", userId)
        .eq("archived", false),
      supabase
        .from("interactions")
        .select("person_id, occurred_at")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(500),
      supabase
        .from("promises")
        .select("person_id, description, due_at, created_at")
        .eq("user_id", userId)
        .eq("status", "open"),
    ]);

    const people = pplRes.data ?? [];
    if (people.length === 0) return { nudges: [] };

    const now = Date.now();
    const lastByPerson = new Map<string, string>();
    for (const i of intRes.data ?? []) {
      if (!lastByPerson.has(i.person_id)) lastByPerson.set(i.person_id, i.occurred_at);
    }

    const today = new Date();
    const in7Days = new Date(now + 7 * 86400000);
    const summary = people.map((p) => {
      const last = lastByPerson.get(p.id);
      const days = last ? Math.floor((now - new Date(last).getTime()) / 86400000) : null;
      const overdue = days == null || days > (p.target_cadence_days ?? 30);

      // Check if birthday is this week
      let birthdayThisWeek = false;
      if (p.birthday) {
        const bd = new Date(p.birthday);
        const thisYearBd = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        birthdayThisWeek = thisYearBd >= today && thisYearBd <= in7Days;
      }

      return {
        id: p.id,
        name: p.name,
        relationship_type: p.relationship_type,
        target_cadence_days: p.target_cadence_days,
        days_since_last_contact: days,
        overdue,
        birthday_this_week: birthdayThisWeek,
        birthday: p.birthday,
        anniversary: p.anniversary,
      };
    });

    // Sort: birthday this week first, then most overdue
    const prioritized = [...summary].sort((a, b) => {
      if (a.birthday_this_week && !b.birthday_this_week) return -1;
      if (!a.birthday_this_week && b.birthday_this_week) return 1;
      if (a.overdue && !b.overdue) return -1;
      if (!a.overdue && b.overdue) return 1;
      return (b.days_since_last_contact ?? 9999) - (a.days_since_last_contact ?? 9999);
    });

    const raw = await callAI(
      [
        {
          role: "system",
          content: `You are the user's personal relationship coach. Today is ${today.toDateString()}.

Analyze the contact data and produce exactly 3 specific, actionable nudges. Each nudge should:
- Reference a REAL person by their id from the input
- Have a compelling headline (max 8 words)  
- Give a warm, human reason why NOW is the right time
- Suggest one specific, concrete action (not generic advice)

Prioritize: 1) Birthdays this week 2) Most overdue relationships 3) Open promises

Return JSON: { nudges: [{ person_id, name, headline, reason, suggested_action, priority: "high"|"medium"|"low" }] }`,
        },
        {
          role: "user",
          content: `Top contacts to review:\n${JSON.stringify(prioritized.slice(0, 15))}\n\nOpen promises:\n${JSON.stringify(prmRes.data ?? [])}`,
        },
      ],
      true,
    );

    try {
      const parsed = JSON.parse(raw) as {
        nudges: Array<{
          person_id: string;
          name: string;
          headline: string;
          reason: string;
          suggested_action: string;
          priority: string;
        }>;
      };
      return { nudges: parsed.nudges ?? [] };
    } catch {
      return { nudges: [] };
    }
  });

// ─── Conversation Starters ─────────────────────────────────────────────────────
export const getConversationStarters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { person_id: string }) =>
    z.object({ person_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: person } = await supabase
      .from("people")
      .select("*")
      .eq("id", data.person_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!person) throw new Error("Contact not found");

    const [ints, nts, flds] = await Promise.all([
      supabase
        .from("interactions")
        .select("type, summary, occurred_at")
        .eq("person_id", data.person_id)
        .order("occurred_at", { ascending: false })
        .limit(10),
      supabase
        .from("notes")
        .select("body, content, created_at")
        .eq("person_id", data.person_id)
        .limit(5),
      supabase.from("person_fields").select("category, key, value").eq("person_id", data.person_id),
    ]);

    const raw = await callAI(
      [
        {
          role: "system",
          content:
            "You generate personalized conversation starters based on someone's relationship history. Return JSON: { starters: [{ opener: string, context: string, tone: 'warm'|'professional'|'playful' }] } with exactly 3 starters. Make them specific, reference real context from the data, and feel natural — not generic.",
        },
        {
          role: "user",
          content: `Generate conversation starters for reaching out to ${person.name}.\n\nProfile: ${JSON.stringify(person)}\nRecent interactions: ${JSON.stringify(ints.data ?? [])}\nNotes: ${JSON.stringify(nts.data ?? [])}\nDetails: ${JSON.stringify(flds.data ?? [])}`,
        },
      ],
      true,
    );

    try {
      const parsed = JSON.parse(raw) as {
        starters: Array<{ opener: string; context: string; tone: string }>;
      };
      return { starters: parsed.starters ?? [] };
    } catch {
      return { starters: [] };
    }
  });

// ─── Draft Message ─────────────────────────────────────────────────────────────
export const draftMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        person_id: z.string().uuid(),
        occasion: z.enum([
          "birthday",
          "checkin",
          "followup",
          "thankyou",
          "apology",
          "congratulations",
        ]),
        tone: z.enum(["warm", "professional", "casual"]).default("warm"),
        extra_context: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: person } = await supabase
      .from("people")
      .select("*")
      .eq("id", data.person_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!person) throw new Error("Contact not found");

    const [ints, nts] = await Promise.all([
      supabase
        .from("interactions")
        .select("type, summary, occurred_at")
        .eq("person_id", data.person_id)
        .order("occurred_at", { ascending: false })
        .limit(5),
      supabase.from("notes").select("body, content").eq("person_id", data.person_id).limit(3),
    ]);

    const occasionLabels: Record<string, string> = {
      birthday: "a birthday message",
      checkin: "a casual check-in",
      followup: "a follow-up after our last conversation",
      thankyou: "a thank you message",
      apology: "a sincere apology",
      congratulations: "a congratulations message",
    };

    const message = await callAI([
      {
        role: "system",
        content: `You draft personal messages on behalf of the user. Write ${occasionLabels[data.occasion]} to ${person.name}. Tone: ${data.tone}. Use real context from their history to make it personal and specific. Keep it concise (2-4 sentences). Do NOT use generic filler phrases. Sound like a real human being, not a bot.`,
      },
      {
        role: "user",
        content: `Draft a message for: ${person.name} (${person.relationship_type})\nProfile: ${JSON.stringify(person)}\nRecent interactions: ${JSON.stringify(ints.data ?? [])}\nNotes: ${JSON.stringify(nts.data ?? [])}${data.extra_context ? `\nExtra context: ${data.extra_context}` : ""}`,
      },
    ]);

    return { message };
  });

// ─── Relationship Health Diagnosis ─────────────────────────────────────────────
export const diagnoseRelationship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { person_id: string }) =>
    z.object({ person_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: person } = await supabase
      .from("people")
      .select("*")
      .eq("id", data.person_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!person) throw new Error("Contact not found");

    const [ints, prms, nts] = await Promise.all([
      supabase
        .from("interactions")
        .select("type, summary, occurred_at")
        .eq("person_id", data.person_id)
        .order("occurred_at", { ascending: false })
        .limit(30),
      supabase
        .from("promises")
        .select("description, status, created_at")
        .eq("person_id", data.person_id),
      supabase
        .from("notes")
        .select("body, content, created_at")
        .eq("person_id", data.person_id)
        .limit(10),
    ]);

    const raw = await callAI(
      [
        {
          role: "system",
          content: `You are a relationship coach analyzing the health of a personal or professional relationship. Return JSON:
{
  "score_label": "Thriving" | "Healthy" | "Drifting" | "At Risk" | "Dormant",
  "summary": "2-3 sentence honest assessment",
  "strengths": ["array of 2-3 specific strengths"],
  "risks": ["array of 1-2 specific risks or gaps"],
  "top_action": "The single most important thing to do this week"
}
Be honest, specific, and use the actual data. Do not be generic.`,
        },
        {
          role: "user",
          content: `Analyze my relationship with ${person.name}.\n\nProfile: ${JSON.stringify(person)}\nInteractions (last 30): ${JSON.stringify(ints.data ?? [])}\nPromises: ${JSON.stringify(prms.data ?? [])}\nNotes: ${JSON.stringify(nts.data ?? [])}`,
        },
      ],
      true,
    );

    try {
      return JSON.parse(raw) as {
        score_label: string;
        summary: string;
        strengths: string[];
        risks: string[];
        top_action: string;
      };
    } catch {
      return {
        score_label: "Unknown",
        summary: raw,
        strengths: [],
        risks: [],
        top_action: "",
      };
    }
  });
