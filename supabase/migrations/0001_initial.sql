-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: people
CREATE TABLE IF NOT EXISTS public.people (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    role TEXT,
    birthday TEXT,
    anniversary TEXT,
    bio TEXT,
    location TEXT,
    relationship_type TEXT,
    target_cadence_days INTEGER,
    import_source TEXT,
    external_id TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: person_fields
CREATE TABLE IF NOT EXISTS public.person_fields (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    category TEXT,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: interactions
CREATE TABLE IF NOT EXISTS public.interactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    summary TEXT,
    type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: promises
CREATE TABLE IF NOT EXISTS public.promises (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    due_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: notes
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: reminders
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: import_batches
CREATE TABLE IF NOT EXISTS public.import_batches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    total_parsed INTEGER DEFAULT 0,
    total_imported INTEGER DEFAULT 0,
    total_skipped INTEGER DEFAULT 0,
    total_review INTEGER DEFAULT 0,
    stats JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: vapid_keys
CREATE TABLE IF NOT EXISTS public.vapid_keys (
    id INTEGER PRIMARY KEY DEFAULT 1,
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) Configuration

-- Enable RLS on all tables
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
-- vapid_keys is server-only, no RLS needed as it shouldn't be accessed by clients directly
ALTER TABLE public.vapid_keys ENABLE ROW LEVEL SECURITY;

-- Helper to create policies safely
CREATE OR REPLACE FUNCTION create_user_policy(table_name text) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = table_name AND policyname = 'Users can only access their own data'
    ) THEN
        EXECUTE format('
            CREATE POLICY "Users can only access their own data" ON public.%I
            FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        ', table_name);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply policies
SELECT create_user_policy('people');
SELECT create_user_policy('person_fields');
SELECT create_user_policy('interactions');
SELECT create_user_policy('promises');
SELECT create_user_policy('notes');
SELECT create_user_policy('reminders');
SELECT create_user_policy('import_batches');
SELECT create_user_policy('push_subscriptions');

-- Prevent client access to vapid_keys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'vapid_keys' AND policyname = 'No client access to vapid_keys'
    ) THEN
        CREATE POLICY "No client access to vapid_keys" ON public.vapid_keys FOR ALL USING (false);
    END IF;
END $$;
