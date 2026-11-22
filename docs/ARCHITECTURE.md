# Architecture

## Stack
- **Frontend:** React, TypeScript, TanStack Start / Router, Tailwind CSS, shadcn/ui, PWA
- **Backend:** Supabase (Auth + PostgreSQL), accessed through TanStack server functions
- **AI (optional):** Groq, called server-side from `src/lib/ai.functions.ts`

## Data flow
Browser → TanStack server function → Supabase (Row Level Security) → PostgreSQL

## AI flow
Browser → `src/lib/ai.functions.ts` (server) → Groq API (`llama-3.3-70b-versatile`)
`GROQ_API_KEY` is only read on the server and never reaches the browser.

## Database tables
profiles, people, person_fields, notes, interactions, reminders, promises,
health_snapshots, import_batches, push_subscriptions, vapid_keys

Every table has Row Level Security so users can only access their own rows.
`vapid_keys` is server-only (service role).

## Security boundaries
- Browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` only
- Server: `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `DISPATCH_REMINDERS_SECRET`
