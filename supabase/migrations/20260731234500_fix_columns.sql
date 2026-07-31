-- Migration to ensure all columns exist and work properly for promises, interactions, notes, and people

-- 1. Ensure promises table has status, due_at, completed_at, updated_at
ALTER TABLE public.promises ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE public.promises ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
ALTER TABLE public.promises ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.promises ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Ensure interactions table has type, summary, channel, mood, location, occurred_at
ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'message';
ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS mood TEXT;
ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.interactions ALTER COLUMN occurred_at SET DEFAULT now();

-- 3. Ensure notes table has body (or content fallback) and pinned
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
