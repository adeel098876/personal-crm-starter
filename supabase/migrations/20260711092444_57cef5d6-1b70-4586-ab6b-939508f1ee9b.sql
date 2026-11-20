-- Enable extensions we need
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Push subscriptions (one per device/browser)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ensure all columns and constraints exist if table was created in an earlier migration
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_user_id_endpoint_key'
  ) THEN
    ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND policyname = 'Users manage their push subscriptions'
  ) THEN
    CREATE POLICY "Users manage their push subscriptions"
      ON public.push_subscriptions FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- VAPID keys (backend only; no client role has any grant)
CREATE TABLE IF NOT EXISTS public.vapid_keys (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'mailto:notifications@kinetic.app',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vapid_keys
  ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'mailto:notifications@kinetic.app';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vapid_keys_id_check'
  ) THEN
    BEGIN
      ALTER TABLE public.vapid_keys ADD CONSTRAINT vapid_keys_id_check CHECK (id = 1);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

GRANT ALL ON public.vapid_keys TO service_role;
ALTER TABLE public.vapid_keys ENABLE ROW LEVEL SECURITY;
-- No policies — locked to service_role only.

-- Import batches
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total_parsed INTEGER NOT NULL DEFAULT 0,
  total_imported INTEGER NOT NULL DEFAULT 0,
  total_skipped INTEGER NOT NULL DEFAULT 0,
  total_review INTEGER NOT NULL DEFAULT 0,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ensure all columns and constraints exist if table was created in an earlier migration
ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'import_batches_source_check'
  ) THEN
    BEGIN
      ALTER TABLE public.import_batches ADD CONSTRAINT import_batches_source_check CHECK (source IN ('vcard','csv','google'));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'import_batches_status_check'
  ) THEN
    BEGIN
      ALTER TABLE public.import_batches ADD CONSTRAINT import_batches_status_check CHECK (status IN ('draft','completed','cancelled'));
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'import_batches' AND policyname = 'Users manage their import batches'
  ) THEN
    CREATE POLICY "Users manage their import batches"
      ON public.import_batches FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_import_batches_updated_at ON public.import_batches;
CREATE TRIGGER update_import_batches_updated_at
  BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- People: dedupe columns
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS import_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE INDEX IF NOT EXISTS people_user_source_external_idx
  ON public.people(user_id, import_source, external_id)
  WHERE external_id IS NOT NULL;

-- Profiles: push preferences
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_quiet_hours JSONB NOT NULL DEFAULT '{"start_hour":22,"end_hour":8,"timezone":"UTC"}'::jsonb;

-- Cron: dispatch due-reminder push notifications every 5 minutes.
-- The target URL and shared secret are read from database GUCs so that no
-- credentials or environment-specific URLs are baked into this migration.
-- Operators must set these before the cron can fire:
--   ALTER DATABASE <db> SET app.dispatch_url = 'https://<host>/api/public/dispatch-reminders';
--   ALTER DATABASE <db> SET app.dispatch_reminders_secret = '<shared secret>';
-- The endpoint refuses to run unless DISPATCH_REMINDERS_SECRET is configured,
-- so an unset secret fails safe instead of allowing unauthenticated dispatch.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('dispatch-reminder-push')
    FROM cron.job
    WHERE jobname = 'dispatch-reminder-push';

    PERFORM cron.schedule(
      'dispatch-reminder-push',
      '*/5 * * * *',
      $cron_job$
      SELECT net.http_post(
        url := COALESCE(
          current_setting('app.dispatch_url', true),
          'http://localhost/api/public/dispatch-reminders'
        ),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', COALESCE(current_setting('app.dispatch_reminders_secret', true), '')
        ),
        body := '{}'::jsonb
      ) AS request_id;
      $cron_job$
    );
  END IF;
END $$;