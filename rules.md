# Coding Rules

Always follow these rules.

## General

- Never rewrite working code.
- Only modify files required for the task.
- Prefer composition over duplication.
- Use TypeScript strict mode.
- Avoid any.
- Keep components under 300 lines.
- Keep functions under 50 lines.
- Never hardcode secrets.

---

## React

- Functional Components only.
- Hooks only.
- No class components.
- Prefer TanStack Router.
- Prefer Server Functions.

---

## UI

Always use

- Tailwind
- shadcn/ui

No inline CSS.

---

## AI

Never call the AI provider directly from React. The provider is Groq
(`llama-3.3-70b-versatile`, key from server-side `GROQ_API_KEY` only).

Always

React

↓

TanStack Server Function (`src/lib/ai.functions.ts`)

↓

Groq API

Never expose `GROQ_API_KEY` to the client (no `VITE_GROQ_API_KEY`).

---

## Database

Never bypass RLS.

Never query another user's data.

Always use auth.uid().

---

## State

Prefer:

React Query

↓

Context

↓

Local State

Avoid global state unless necessary.

---

## Performance

Lazy load pages.

Memoize expensive components.

Virtualize large lists.

---

## Naming

Components

PascalCase

Hooks

useSomething

Functions

camelCase

Constants

UPPER_CASE
