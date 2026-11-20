# Architecture

Frontend

- React
- TypeScript
- TanStack Start
- Tailwind CSS
- shadcn/ui
- PWA

Backend

- Supabase

Database

- PostgreSQL

Authentication

- Supabase Auth

Storage

- Supabase Storage

AI

Frontend

↓

TanStack Server Function (`src/lib/ai.functions.ts`)

↓

Groq API (`https://api.groq.com/openai/v1/chat/completions`)

Model: `llama-3.3-70b-versatile`

Key: server-side `GROQ_API_KEY` only (never client-exposed)

Future:

- Claude
- Gemini

Database

users

contacts

interaction_history

notes

promises

reminders

subscriptions

settings

ai_usage

attachments

notifications

Flow

React

↓

Supabase JS

↓

RLS

↓

PostgreSQL
