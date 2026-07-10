
-- Utility: updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- people
CREATE TABLE public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  nicknames TEXT[] NOT NULL DEFAULT '{}',
  photo_url TEXT,
  relationship_type TEXT NOT NULL DEFAULT 'friend',
  company TEXT,
  role TEXT,
  location TEXT,
  email TEXT,
  phone TEXT,
  birthday DATE,
  anniversary DATE,
  how_we_met TEXT,
  target_cadence_days INTEGER NOT NULL DEFAULT 30,
  tags TEXT[] NOT NULL DEFAULT '{}',
  bio TEXT,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own people" ON public.people FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX people_user_idx ON public.people (user_id, archived);
CREATE INDEX people_name_idx ON public.people (user_id, name);
CREATE TRIGGER people_updated_at BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- person_fields (structured attributes)
CREATE TABLE public.person_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people ON DELETE CASCADE,
  category TEXT NOT NULL, -- family, pet, favorite, allergy, interest, custom
  key TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_fields TO authenticated;
GRANT ALL ON public.person_fields TO service_role;
ALTER TABLE public.person_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own person_fields" ON public.person_fields FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX person_fields_person_idx ON public.person_fields (person_id);

-- notes
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notes" ON public.notes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX notes_person_idx ON public.notes (person_id, pinned, created_at DESC);
CREATE TRIGGER notes_updated_at BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- interactions
CREATE TABLE public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people ON DELETE CASCADE,
  type TEXT NOT NULL, -- call, message, meeting, email, coffee, gift, note, milestone
  channel TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT,
  mood TEXT,
  location TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interactions TO authenticated;
GRANT ALL ON public.interactions TO service_role;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own interactions" ON public.interactions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX interactions_person_idx ON public.interactions (person_id, occurred_at DESC);
CREATE INDEX interactions_user_time_idx ON public.interactions (user_id, occurred_at DESC);

-- reminders
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  person_id UUID REFERENCES public.people ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  recurrence TEXT, -- null, daily, weekly, monthly, yearly
  status TEXT NOT NULL DEFAULT 'open', -- open, done, snoozed, dismissed
  kind TEXT NOT NULL DEFAULT 'custom', -- birthday, anniversary, promise, follow_up, custom
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reminders" ON public.reminders FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX reminders_user_due_idx ON public.reminders (user_id, status, due_at);
CREATE TRIGGER reminders_updated_at BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- promises
CREATE TABLE public.promises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people ON DELETE CASCADE,
  description TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open', -- open, kept, broken, cancelled
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promises TO authenticated;
GRANT ALL ON public.promises TO service_role;
ALTER TABLE public.promises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own promises" ON public.promises FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX promises_user_status_idx ON public.promises (user_id, status, due_at);
CREATE TRIGGER promises_updated_at BEFORE UPDATE ON public.promises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- health_snapshots
CREATE TABLE public.health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people ON DELETE CASCADE,
  score INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_snapshots TO authenticated;
GRANT ALL ON public.health_snapshots TO service_role;
ALTER TABLE public.health_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own health_snapshots" ON public.health_snapshots FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX health_snapshots_person_idx ON public.health_snapshots (person_id, computed_at DESC);
