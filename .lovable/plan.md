# Relationship CRM — Web MVP Plan

A personal relationship operating system. Web-first (installable on iPhone via PWA). Native SwiftUI port comes later; this plan ships a polished, fast web product using Lovable Cloud (auth + database) and Lovable AI (assistant + smart search).

## Product principles

- Feels like a private tool, never social media.
- Keyboard-fast (⌘K everywhere), quiet UI, high information density.
- Nothing important is ever forgotten: everything is captured, timestamped, and surfaced at the right moment.
- AI is an assistant, not a chatbot tab — it lives inside the dashboard and per-person views.

## MVP scope (first build)

Confirmed by you: Contacts + rich profiles + timeline, Reminders + daily dashboard, AI assistant + smart search, Relationship health score + analytics.

### 1. Auth & account

- Email/password + Google sign-in via Lovable Cloud.
- Single-user workspace (Family/team sharing = later).

### 2. People (contacts)

- Rich profile: photo, name, nicknames, relationship type (family/friend/coworker/client/…), company/role, location, birthday, anniversary.
- Structured fields: family members, kids, pets, favorite food/coffee, allergies, interests, preferred contact method.
- Free-form markdown notes, pinned notes, tags.
- Custom fields per person.

### 3. Timeline per person

- Interactions: call, message, meeting, email, coffee, gift, note, milestone.
- Each entry: date, type, channel, summary, mood, location, attachments (links + images).
- Manual quick-add + "log interaction" button on person page.
- Full-text searchable.

### 4. Reminders & promises

- One-off + recurring reminders (birthday, anniversary, "check in every 2 weeks").
- Promises: "I owe X the deck" → tracked until marked done.
- Follow-ups auto-suggested after a logged meeting.

### 5. Daily dashboard (home)

- Today's birthdays & anniversaries.
- People to reach out to (based on cadence + last contact).
- Open promises & due follow-ups.
- Upcoming meetings (manual entry in MVP; calendar sync later).
- 3 AI-suggested actions for today.

### 6. AI assistant (Lovable AI, `openai/gpt-5.5`)

- **AI Features (Freemium Model)**
  AI features follow a freemium model.
  **Free Plan**
  - Limited AI usage per day/month (e.g., 5 AI requests per day or 30 per month).
  - Basic Smart Search.
  - Basic Meeting Preparation.
  - Basic Note Summarization.
  - Limited Daily AI Suggestions.
  **Pro Subscription**
  - Unlimited AI requests.
  - Advanced Smart Search.
  - High-quality meeting preparation.
  - Advanced note summarization.
  - Intelligent follow-up suggestions.
  - Personalized relationship insights.
  - AI-powered writing assistance (messages, follow-ups, birthday wishes, etc.).
  - Priority access to future AI features.
  AI requests should be tracked per user and automatically enforce usage limits based on their subscription tier.7. Relationship health score

- Per-person score 0–100 from: recency of contact, frequency vs. target cadence, promises kept, important dates remembered, timeline depth.
- Visual ring on each person card; trend arrow (up/down over 30 days).

Suggested next action when score drops.

## 7.Cost Optimization

The MVP should be designed so it can be developed and launched with **little to no monthly infrastructure cost** by taking advantage of generous free tiers.

Prioritize:

- Free-tier hosting
- Free-tier database
- Free authentication
- Open-source libraries
- Efficient API usage
- AI request limits to control costs

The application should be easy to scale later without requiring a major architectural rewrite.

### 8. Analytics

- People contacted this month, longest-ignored, strongest/weakening relationships, network growth, cadence heatmap.
- Simple charts (Recharts).

### 9. Global search (⌘K)

- Fuzzy across people, notes, timeline entries, tags.
- "Ask AI" fallback for natural-language queries.

## Out of scope for MVP (explicitly deferred)

Voice recordings, PDF/document uploads, gift tracker, location-based reminders, calendar/email/contacts sync, family/team sharing, mobile push notifications, monetization/billing, viral/referral loops. These are documented for a v2 plan.

## Technical design

**Technology Stack**

Build using technologies that are **free, reliable, and commonly used by professional iOS and indie developers.**

- **Frontend:** React + TanStack Start
- **UI:** Tailwind CSS + shadcn/ui
- **Backend & Authentication:** Supabase (Free Tier)
- **Database:** PostgreSQL via Supabase (Free Tier)
- **Storage:** Supabase Storage (Free Tier)
- **Row-Level Security (RLS)** for secure user data.
- **AI:** OpenAI GPT-5.5 through Lovable AI Gateway.
- **Deployment:** Vercel (Free Tier)
- **Version Control:** GitHub

The architecture should rely on free tiers during MVP development while remaining scalable to paid plans as the user base grows. Avoid paid services unless absolutely necessary.

### Data model (Supabase, RLS scoped to `auth.uid()`)

- `profiles` — user profile (auto-created on signup).
- `people` — id, user_id, name, nicknames[], photo_url, relationship_type, company, role, location, birthday, anniversary, target_cadence_days, tags[], created_at.
- `person_fields` — id, person_id, key, value (structured attributes: family, pets, favorites, allergies, custom).
- `notes` — id, person_id, body (markdown), pinned, created_at.
- `interactions` — id, person_id, type, channel, occurred_at, summary, mood, location, metadata jsonb.
- `reminders` — id, person_id (nullable), title, due_at, recurrence, status, kind (birthday/promise/follow_up/custom).
- `promises` — id, person_id, description, due_at, status, created_at.
- `health_snapshots` — id, person_id, score, computed_at (daily rollup for trend).

Every table: `GRANT` block + RLS policy `user_id = auth.uid()`.

### Routes

```
/                       → landing / redirect to /today if signed in
/auth                   → sign in / sign up
/_authenticated/
  today                 → daily dashboard
  people                → people list + filters + ⌘K
  people/$id            → person detail (profile, timeline, notes, reminders, health)
  people/$id/edit
  reminders             → all reminders
  analytics             → charts
  settings
```

### Server functions (`createServerFn` + `requireSupabaseAuth`)

- `people.functions.ts`: list, get, create, update, delete.
- `interactions.functions.ts`: log, list by person.
- `reminders.functions.ts`: list due, create, complete, snooze.
- `health.functions.ts`: recompute score for person / all; read latest + trend.
- `ai.functions.ts`: `smartSearch(query)`, `meetingPrep(personId)`, `summarizeNotes(text)`, `dailyNudges()`.

### Health score algorithm (v1)

```
score = 100
- recency_penalty  (days since last interaction vs target_cadence_days)
- cadence_penalty  (interactions in last 90d vs expected)
+ depth_bonus      (notes count, structured fields filled)
+ reliability_bonus (promises kept / total)
+ dates_bonus      (birthday/anniversary logged & acknowledged)
clamp 0..100
```

Recomputed on interaction insert and via a daily server function; snapshot written for trend.

### AI wiring

- Chat/text default `openai/gpt-5.5` through Lovable AI Gateway.
- Smart search: structured output (Zod) → `{ filters, keywords, semantic_hint }` → applied server-side to Supabase query.
- Nudges: server fn pulls candidates (last_contact, target_cadence, open promises) and asks the model to rank/justify the top 3.
- All prompts + keys stay server-side.

### UI direction

Because you asked for "Apple / Notion / Linear / Superhuman" quality, after this plan is approved I'll generate 3 rendered design directions and let you pick one before building. Guardrails: minimal, high-density, keyboard-first, dark + light, no social-media vibes.

## Build order

1. Cloud + auth + `_authenticated` shell + empty routes.
2. Data model migrations (all tables + RLS + grants).
3. People CRUD + list + detail + profile fields + notes.
4. Interactions timeline + quick-log.
5. Reminders + promises + today dashboard.
6. Health score + person ring + trend + analytics page.
7. AI: smart search, meeting prep, note summarization, daily nudges.
8. ⌘K global search + polish + PWA manifest (installable on iPhone).

## What I need from you to start building

1. Approve this plan.
2. After approval I'll generate 3 design directions for the app shell + person detail page, and you pick one.