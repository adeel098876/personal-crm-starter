import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GROQ_MODEL = "llama-3.3-70b-versatile";

async function callAI(
  messages: Array<{ role: string; content: string }>,
  jsonSchema?: unknown,
) {
  const apiKey =
    process.env.GROQ_API_KEY ||
    process.env.VITE_GROQ_API_KEY ||
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GROQ_API_KEY);

  if (!apiKey || apiKey.trim() === "" || apiKey === "your-groq-api-key-here") {
    throw new Error(
      "GROQ_API_KEY is not set. Please set your GROQ_API_KEY in your .env file.",
    );
  }

  const payloadMessages = messages.map((m) => ({ ...m }));

  if (jsonSchema && payloadMessages[0]?.role === "system") {
    payloadMessages[0].content +=
      "\nIMPORTANT: You MUST respond with valid raw JSON only. Do not wrap in markdown code blocks or add introductory text.";
  }

  const body: any = {
    model: GROQ_MODEL,
    messages: payloadMessages,
    temperature: 0.2,
    max_tokens: 1500,
  };

  if (jsonSchema) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Groq API Error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  
  // Clean markdown code blocks if model returned them despite system prompt
  let cleaned = content.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

export const smartSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { query: string }) =>
    z.object({ query: z.string().min(1).max(500) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pplRes = await supabase
      .from("people")
      .select("id, name, company, role, location, tags, bio, birthday")
      .eq("user_id", userId)
      .eq("archived", false)
      .limit(500);
    const fldRes = await supabase
      .from("person_fields")
      .select("person_id, category, key, value")
      .eq("user_id", userId);

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
            "You match contacts against a natural-language query. Return the ids of matching people, strongest match first. Consider name, company, role, location, tags, bio, and custom fields. Be generous with fuzzy matches but never invent people.",
        },
        {
          role: "user",
          content: `Query: ${data.query}\n\nContacts JSON:\n${JSON.stringify(enriched)}`,
        },
      ],
      {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" } },
          reason: { type: "string" },
        },
        required: ["ids", "reason"],
      },
    );

    let parsed: { ids: string[]; reason: string } = { ids: [], reason: "" };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback keyword filter if JSON parsing fails
      const qLower = data.query.toLowerCase();
      const matched = people.filter((p) => p.name.toLowerCase().includes(qLower));
      return { people: matched, reason: `Keyword match for "${data.query}"` };
    }
    const idSet = new Set(parsed.ids);
    const matched = people.filter((p) => idSet.has(p.id));
    return { people: matched, reason: parsed.reason };
  });

export const meetingPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { person_id: string }) =>
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
      supabase
        .from("promises")
        .select("*")
        .eq("person_id", data.person_id)
        .eq("status", "open"),
    ]);

    const brief = await callAI([
      {
        role: "system",
        content:
          "You are the user's executive assistant. Write a tight, glanceable meeting brief in markdown with these sections: **Context**, **Last conversation**, **Open loops**, **Talking points**, **Personal notes**. Be specific, use bullet points, no fluff, no greetings.",
      },
      {
        role: "user",
        content: `Prepare a brief for my upcoming meeting with ${person.name}.\n\nPerson: ${JSON.stringify(person)}\nRecent interactions: ${JSON.stringify(ints.data ?? [])}\nNotes: ${JSON.stringify(nts.data ?? [])}\nStructured fields: ${JSON.stringify(flds.data ?? [])}\nOpen promises: ${JSON.stringify(prms.data ?? [])}`,
      },
    ]);
    return { brief };
  });

export const summarizeNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { text: string }) =>
    z.object({ text: z.string().min(10).max(20000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const content = await callAI(
      [
        {
          role: "system",
          content:
            "Extract structure from raw meeting notes. Return JSON with a concise summary, key action items with owner (me or them), and suggested follow-up reminders with a date if implied.",
        },
        { role: "user", content: data.text },
      ],
      {
        type: "object",
        properties: {
          summary: { type: "string" },
          actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                owner: { type: "string" },
                description: { type: "string" },
              },
              required: ["owner", "description"],
            },
          },
          follow_ups: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                when: { type: "string" },
              },
              required: ["title", "when"],
            },
          },
        },
        required: ["summary", "actions", "follow_ups"],
      },
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

export const dailyNudges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    const summary = people.map((p) => {
      const last = lastByPerson.get(p.id);
      const days = last ? Math.floor((now - new Date(last).getTime()) / 86400000) : null;
      return {
        id: p.id,
        name: p.name,
        type: p.relationship_type,
        cadence: p.target_cadence_days,
        days_since_last_contact: days,
        birthday: p.birthday,
        anniversary: p.anniversary,
      };
    });

    const raw = await callAI(
      [
        {
          role: "system",
          content:
            "You are the user's executive assistant for relationships. Suggest at most 3 specific, concrete actions to take today. Each must reference a real person by id from the input. Be direct, warm, non-corporate. Prioritize birthdays this week, overdue relationships (days_since_last_contact > cadence), and unresolved promises.",
        },
        {
          role: "user",
          content: `People: ${JSON.stringify(summary)}\n\nOpen promises: ${JSON.stringify(prmRes.data ?? [])}\n\nToday: ${new Date().toISOString()}`,
        },
      ],
      {
        type: "object",
        properties: {
          nudges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                person_id: { type: "string" },
                headline: { type: "string" },
                reason: { type: "string" },
                suggested_action: { type: "string" },
              },
              required: ["person_id", "headline", "reason", "suggested_action"],
            },
          },
        },
        required: ["nudges"],
      },
    );
    try {
      return JSON.parse(raw) as {
        nudges: Array<{
          person_id: string;
          headline: string;
          reason: string;
          suggested_action: string;
        }>;
      };
    } catch {
      return { nudges: [] };
    }
  });