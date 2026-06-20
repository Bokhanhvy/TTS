
-- =========================================================
-- 1. PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles: owner can read"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Profiles: owner can update"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles: owner can insert"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- =========================================================
-- 2. ROLES
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Roles: user reads own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Admins can read everyone's roles
CREATE POLICY "Roles: admin reads all"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 3. AUTO-CREATE PROFILE + DEFAULT ROLE ON SIGNUP
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_credits (user_id, plan_id, credits_remaining, credits_used)
  SELECT NEW.id, p.id, p.monthly_credits, 0 FROM public.plans p WHERE p.code = 'free' LIMIT 1
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- =========================================================
-- 4. PLANS + CREDITS
-- =========================================================
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  price_cents INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans: public read"
  ON public.plans FOR SELECT TO anon, authenticated
  USING (is_active = true);
CREATE POLICY "Plans: admin write"
  ON public.plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.plans (code, name, monthly_credits, price_cents, sort_order, features) VALUES
  ('free',    'Free',    100,    0, 1, '["100 credits / month","Standard voices","Basic translation"]'::jsonb),
  ('basic',   'Basic',   1000,  499, 2, '["1,000 credits / month","All premium voices","Priority queue"]'::jsonb),
  ('premium', 'Premium', 10000,1999, 3, '["10,000 credits / month","All premium voices","Priority queue","Commercial use"]'::jsonb);

CREATE TABLE public.user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_credits TO authenticated;
GRANT ALL ON public.user_credits TO service_role;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Credits: owner read"
  ON public.user_credits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Credits: admin read all"
  ON public.user_credits FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.credit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_logs TO authenticated;
GRANT ALL ON public.credit_logs TO service_role;
ALTER TABLE public.credit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX credit_logs_user_idx ON public.credit_logs (user_id, created_at DESC);

CREATE POLICY "Credit logs: owner read"
  ON public.credit_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Credit logs: admin read all"
  ON public.credit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 5. TTS HISTORY
-- =========================================================
CREATE TABLE public.tts_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  voice_name TEXT NOT NULL,
  voice_gender TEXT,
  voice_age INTEGER,
  language TEXT NOT NULL,
  language_code TEXT,
  audio_path TEXT,
  audio_mime TEXT DEFAULT 'audio/mpeg',
  duration_ms INTEGER,
  char_count INTEGER,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tts_history TO authenticated;
GRANT ALL ON public.tts_history TO service_role;
ALTER TABLE public.tts_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX tts_history_user_idx ON public.tts_history (user_id, created_at DESC);

CREATE POLICY "History: owner read"
  ON public.tts_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "History: owner insert"
  ON public.tts_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "History: owner delete"
  ON public.tts_history FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "History: admin read all"
  ON public.tts_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 6. AUTH TRIGGER
-- =========================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- 7. STORAGE POLICIES for tts-audio bucket (bucket created via tool)
-- =========================================================
-- Path convention: <user_id>/<filename>.mp3
CREATE POLICY "tts-audio: owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tts-audio' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "tts-audio: owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tts-audio' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "tts-audio: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tts-audio' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "tts-audio: admin read all"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tts-audio' AND public.has_role(auth.uid(), 'admin'));
