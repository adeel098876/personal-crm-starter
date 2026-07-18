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

Supabase Edge Function

↓

AIService

↓

OpenAI Provider

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
