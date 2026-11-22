-- =============================================================================
-- OPTIONAL: scheduled push notifications for due reminders
--
-- The app works without this. Run it only if you want phone/browser push
-- notifications. It is NOT in supabase/migrations/ on purpose, because it needs
-- your deployed URL and a secret, and it needs the pg_cron + pg_net extensions.
--
-- Before running:
--   1. Deploy the app (e.g. on Vercel).
--   2. Set DISPATCH_REMINDERS_SECRET in your server environment to a long random
--      string (for example: `openssl rand -hex 32`).
--   3. Replace the two placeholders below:
--        YOUR-DOMAIN.example.com   -> your deployed app's domain
--        REPLACE_WITH_YOUR_SECRET  -> the exact same secret as step 2
--   4. Run this file in the Supabase SQL Editor.
--
-- To stop notifications later:
--   SELECT cron.unschedule('dispatch-reminder-push');
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous version of this job so re-running the file is safe.
DO $$
BEGIN
  PERFORM cron.unschedule('dispatch-reminder-push')
  FROM cron.job
  WHERE jobname = 'dispatch-reminder-push';
END
$$;

SELECT cron.schedule(
  'dispatch-reminder-push',
  '*/5 * * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://YOUR-DOMAIN.example.com/api/public/dispatch-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'REPLACE_WITH_YOUR_SECRET'
    ),
    body    := '{}'::jsonb
  );
  $job$
);
