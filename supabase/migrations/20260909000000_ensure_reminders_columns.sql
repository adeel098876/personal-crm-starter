-- Ensure reminders table has all expected columns
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS recurrence TEXT;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
