import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeHealthScore } from "./health";

export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data?: unknown) => data)
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [pplRes, remRes, promRes, intRes] = await Promise.all([
      supabase.from("people").select("*").eq("user_id", userId).eq("archived", false),
      supabase
        .from("reminders")
        .select("*, people(id, name)")
        .eq("user_id", userId)
        .eq("status", "open")
        .lte("due_at", new Date(Date.now() + 7 * 86400000).toISOString())
        .order("due_at"),
      supabase
        .from("promises")
        .select("*, people(id, name)")
        .eq("user_id", userId)
        .eq("status", "open")
        .order("created_at"),
      supabase
        .from("interactions")
        .select("person_id, occurred_at")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(500),
    ]);

    const people = pplRes.data ?? [];
    const reminders = remRes.data ?? [];
    const promises = promRes.data ?? [];
    const interactions = intRes.data ?? [];

    const lastByPerson = new Map<string, string>();
    for (const i of interactions) {
      if (!lastByPerson.has(i.person_id)) lastByPerson.set(i.person_id, i.occurred_at);
    }

    const now = new Date();
    const todayKey = `${now.getMonth() + 1}-${now.getDate()}`;
    const in7 = new Date(now.getTime() + 7 * 86400000);

    type Person = (typeof people)[number];
    const birthdays: Array<{ person: Person; when: string; kind: "birthday" | "anniversary" }> = [];
    const reachOut: Array<{ person: Person; score: number; daysSince: number | null }> = [];
    const scoresById: Record<string, number> = {};

    for (const p of people) {
      for (const [field, kind] of [
        ["birthday", "birthday"] as const,
        ["anniversary", "anniversary"] as const,
      ]) {
        const val = p[field as "birthday" | "anniversary"];
        if (!val) continue;
        const d = new Date(val);
        const thisYear = new Date(now.getFullYear(), d.getMonth(), d.getDate());
        if (`${d.getMonth() + 1}-${d.getDate()}` === todayKey) {
          birthdays.push({ person: p, when: now.toISOString(), kind });
        } else if (thisYear >= now && thisYear <= in7) {
          birthdays.push({ person: p, when: thisYear.toISOString(), kind });
        }
      }

      const lastIso = lastByPerson.get(p.id);
      const daysSince = lastIso
        ? Math.floor((now.getTime() - new Date(lastIso).getTime()) / 86400000)
        : null;
      const score = computeHealthScore({
        targetCadenceDays: p.target_cadence_days,
        daysSinceLastInteraction: daysSince,
        interactionsLast90Days: 0,
        notesCount: 0,
        fieldsCount: 0,
        promisesKept: 0,
        promisesTotal: 0,
        hasBirthday: !!p.birthday,
        hasAnniversary: !!p.anniversary,
      });
      scoresById[p.id] = score;

      const overdue = daysSince == null ? true : daysSince > p.target_cadence_days;
      if (overdue) reachOut.push({ person: p, score, daysSince });
    }

    reachOut.sort((a, b) => a.score - b.score);

    return {
      birthdays,
      reachOut: reachOut.slice(0, 8),
      reminders,
      promises,
      totalPeople: people.length,
      scoresById,
    };
  });

export const getAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data?: unknown) => data)
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 90 * 86400000).toISOString();
    const [pplRes, intRes, promRes] = await Promise.all([
      supabase.from("people").select("*").eq("user_id", userId).eq("archived", false),
      supabase
        .from("interactions")
        .select("person_id, occurred_at, type")
        .eq("user_id", userId)
        .gte("occurred_at", since)
        .limit(1000),
      supabase.from("promises").select("status").eq("user_id", userId),
    ]);

    const people = pplRes.data ?? [];
    const interactions = intRes.data ?? [];
    const promises = promRes.data ?? [];

    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    const contactedThisMonth = new Set(
      interactions.filter((i) => new Date(i.occurred_at) >= monthAgo).map((i) => i.person_id),
    ).size;

    const weeks: Array<{ week: string; count: number }> = [];
    for (let w = 11; w >= 0; w--) {
      const start = new Date(now.getTime() - (w + 1) * 7 * 86400000);
      const end = new Date(now.getTime() - w * 7 * 86400000);
      const count = interactions.filter((i) => {
        const t = new Date(i.occurred_at);
        return t >= start && t < end;
      }).length;
      weeks.push({ week: `${start.getMonth() + 1}/${start.getDate()}`, count });
    }

    const lastByPerson = new Map<string, string>();
    for (const i of interactions.sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    )) {
      if (!lastByPerson.has(i.person_id)) lastByPerson.set(i.person_id, i.occurred_at);
    }

    const withDays = people.map((p) => {
      const last = lastByPerson.get(p.id);
      const days = last ? Math.floor((now.getTime() - new Date(last).getTime()) / 86400000) : null;
      return { person: p, days };
    });
    const longestIgnored = withDays
      .filter((x) => x.days != null)
      .sort((a, b) => (b.days ?? 0) - (a.days ?? 0))
      .slice(0, 5);

    return {
      totalPeople: people.length,
      contactedThisMonth,
      totalInteractions90: interactions.length,
      weeks,
      longestIgnored,
      keptPromises: promises.filter((p) => p.status === "kept").length,
      totalPromises: promises.length,
    };
  });
