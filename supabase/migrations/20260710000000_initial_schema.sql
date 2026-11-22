-- =============================================================================
-- Personal CRM Starter: initial database schema
--
-- Single, self-contained migration. Run it once on a fresh Supabase project
-- (SQL Editor, or `npx supabase db push`).
--
-- Security model:
--   * Every table has Row Level Security (RLS) enabled.
--   * Users can only read/write rows where user_id = their own auth.uid().
--   * The `anon` role gets no access at all.
--   * `vapid_keys` is server-only (service role); no client role can touch it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Shared helper: keep updated_at current
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- profiles (one row per auth user, created automatically on sign-up)
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name     TEXT,
  avatar_url       TEXT,
  push_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  push_quiet_hours JSONB   NOT NULL DEFAULT '{"start_hour":22,"end_hour":8,"timezone":"UTC"}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Only the trigger should call these; nobody should call them over the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- people
-- -----------------------------------------------------------------------------
CREATE TABLE public.people (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  nicknames           TEXT[] NOT NULL DEFAULT '{}',
  photo_url           TEXT,
  relationship_type   TEXT NOT NULL DEFAULT 'friend',
  company             TEXT,
  role                TEXT,
  location            TEXT,
  email               TEXT,
  phone               TEXT,
  birthday            DATE,
  anniversary         DATE,
  how_we_met          TEXT,
  target_cadence_days INTEGER NOT NULL DEFAULT 30,
  tags                TEXT[] NOT NULL DEFAULT '{}',
  bio                 TEXT,
  archived            BOOLEAN NOT NULL DEFAULT FALSE,
  import_source       TEXT,   -- set by the importer (vcard / csv / google)
  external_id         TEXT,   -- id in the source system, used for de-duplication
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX people_user_idx ON public.people (user_id, archived);
CREATE INDEX people_name_idx ON public.people (user_id, name);
CREATE INDEX people_user_source_external_idx
  ON public.people (user_id, import_source, external_id)
  WHERE external_id IS NOT NULL;

CREATE TRIGGER people_updated_at
  BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- person_fields (structured facts: family, pets, favourites, interests, ...)
-- -----------------------------------------------------------------------------
CREATE TABLE public.person_fields (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  person_id  UUID NOT NULL REFERENCES public.people (id) ON DELETE CASCADE,
  category   TEXT NOT NULL,   -- family, pet, favorite, allergy, interest, custom
  key        TEXT NOT NULL,
  value      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX person_fields_person_idx ON public.person_fields (person_id);

-- -----------------------------------------------------------------------------
-- notes
-- -----------------------------------------------------------------------------
CREATE TABLE public.notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  person_id  UUID NOT NULL REFERENCES public.people (id) ON DELETE CASCADE,
  body       TEXT NOT NULL DEFAULT '',
  pinned     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notes_person_idx ON public.notes (person_id, pinned, created_at DESC);

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- interactions
-- -----------------------------------------------------------------------------
CREATE TABLE public.interactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  person_id   UUID NOT NULL REFERENCES public.people (id) ON DELETE CASCADE,
  type        TEXT NOT NULL,   -- call, message, meeting, email, coffee, gift, note, milestone
  channel     TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary     TEXT,
  mood        TEXT,
  location    TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX interactions_person_idx    ON public.interactions (person_id, occurred_at DESC);
CREATE INDEX interactions_user_time_idx ON public.interactions (user_id, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- reminders
-- -----------------------------------------------------------------------------
CREATE TABLE public.reminders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  person_id    UUID REFERENCES public.people (id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  notes        TEXT,
  due_at       TIMESTAMPTZ NOT NULL,
  recurrence   TEXT,                           -- null, daily, weekly, monthly, yearly
  status       TEXT NOT NULL DEFAULT 'open',   -- open, done, snoozed, dismissed
  kind         TEXT NOT NULL DEFAULT 'custom', -- birthday, anniversary, promise, follow_up, custom
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reminders_user_due_idx ON public.reminders (user_id, status, due_at);
-- Used by the push dispatcher, which scans open reminders across all users.
CREATE INDEX reminders_open_due_idx ON public.reminders (due_at) WHERE status = 'open';

CREATE TRIGGER reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- promises
-- -----------------------------------------------------------------------------
CREATE TABLE public.promises (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  person_id    UUID NOT NULL REFERENCES public.people (id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  due_at       TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'open',   -- open, kept, broken, cancelled
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX promises_user_status_idx ON public.promises (user_id, status, due_at);

CREATE TRIGGER promises_updated_at
  BEFORE UPDATE ON public.promises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- health_snapshots (history of relationship-strength scores)
-- -----------------------------------------------------------------------------
CREATE TABLE public.health_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  person_id   UUID NOT NULL REFERENCES public.people (id) ON DELETE CASCADE,
  score       INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX health_snapshots_person_idx ON public.health_snapshots (person_id, computed_at DESC);

-- -----------------------------------------------------------------------------
-- import_batches (contact imports: vCard / CSV / Google)
-- -----------------------------------------------------------------------------
CREATE TABLE public.import_batches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source         TEXT NOT NULL CHECK (source IN ('vcard', 'csv', 'google')),
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'cancelled')),
  total_parsed   INTEGER NOT NULL DEFAULT 0,
  total_imported INTEGER NOT NULL DEFAULT 0,
  total_skipped  INTEGER NOT NULL DEFAULT 0,
  total_review   INTEGER NOT NULL DEFAULT 0,
  stats          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER import_batches_updated_at
  BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- push_subscriptions (Web Push, one row per browser/device)
-- -----------------------------------------------------------------------------
CREATE TABLE public.push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  user_agent   TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint)
);

CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- vapid_keys (server-only: Web Push signing keys, created lazily by the server)
-- -----------------------------------------------------------------------------
CREATE TABLE public.vapid_keys (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  public_key  TEXT NOT NULL,
  private_key TEXT NOT NULL,
  subject     TEXT NOT NULL DEFAULT 'mailto:admin@example.com',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Row Level Security + privileges
-- =============================================================================

-- Per-user tables: RLS on, `anon` locked out, `authenticated` limited to own rows.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'people', 'person_fields', 'notes', 'interactions', 'reminders',
    'promises', 'health_snapshots', 'import_batches', 'push_subscriptions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);

    IF t = 'profiles' THEN
      EXECUTE 'CREATE POLICY "Users manage own profile" ON public.profiles
               FOR ALL TO authenticated
               USING ((SELECT auth.uid()) = id)
               WITH CHECK ((SELECT auth.uid()) = id)';
    ELSE
      EXECUTE format(
        'CREATE POLICY "Users manage own rows" ON public.%I
           FOR ALL TO authenticated
           USING ((SELECT auth.uid()) = user_id)
           WITH CHECK ((SELECT auth.uid()) = user_id)', t);
    END IF;
  END LOOP;
END
$$;

-- vapid_keys: RLS on, no policies, and no client-role privileges at all.
ALTER TABLE public.vapid_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vapid_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.vapid_keys TO service_role;
