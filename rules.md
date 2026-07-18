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

Never call OpenAI directly from React.

Always

React

↓

Supabase Edge Function

↓

OpenAI

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
