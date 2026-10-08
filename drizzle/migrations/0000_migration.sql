
-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  language text NOT NULL DEFAULT 'ar',
  theme text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- user_settings
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key text NOT NULL,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_settings_updated BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ai_providers (no raw secret here)
CREATE TABLE public.ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  provider_type text NOT NULL DEFAULT 'OPENAI_COMPATIBLE',
  base_url text NOT NULL,
  token_hint text,
  encrypted_secret_ref text,
  status text NOT NULL DEFAULT 'UNKNOWN',
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_providers_user_idx ON public.ai_providers(user_id);
GRANT SELECT, UPDATE, DELETE ON public.ai_providers TO authenticated;
GRANT ALL ON public.ai_providers TO service_role;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own providers select" ON public.ai_providers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own providers update" ON public.ai_providers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own providers delete" ON public.ai_providers FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER ai_providers_updated BEFORE UPDATE ON public.ai_providers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- provider_secrets: ciphertext only, never accessible to clients (service_role only)
CREATE TABLE public.provider_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL UNIQUE REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  key_version text NOT NULL,
  ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.provider_secrets FROM anon, authenticated;
GRANT ALL ON public.provider_secrets TO service_role;
ALTER TABLE public.provider_secrets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER provider_secrets_updated BEFORE UPDATE ON public.provider_secrets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ai_models
CREATE TABLE public.ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  external_model_id text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'UNKNOWN',
  is_available boolean NOT NULL DEFAULT true,
  price_class text NOT NULL DEFAULT 'UNKNOWN',
  context_length integer,
  capabilities_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, external_model_id)
);
CREATE INDEX ai_models_user_idx ON public.ai_models(user_id);
CREATE INDEX ai_models_provider_idx ON public.ai_models(provider_id);
GRANT SELECT, UPDATE, DELETE ON public.ai_models TO authenticated;
GRANT ALL ON public.ai_models TO service_role;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own models select" ON public.ai_models FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own models update" ON public.ai_models FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own models delete" ON public.ai_models FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER ai_models_updated BEFORE UPDATE ON public.ai_models FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- routing_preferences
CREATE TABLE public.routing_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  mode text NOT NULL DEFAULT 'AUTO',
  preferred_provider_id uuid REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  preferred_model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  fallback_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.routing_preferences TO authenticated;
GRANT ALL ON public.routing_preferences TO service_role;
ALTER TABLE public.routing_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own routing" ON public.routing_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER routing_updated BEFORE UPDATE ON public.routing_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- conversations
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  active_provider_id uuid REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  active_model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  routing_mode text NOT NULL DEFAULT 'AUTO',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_user_idx ON public.conversations(user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conversations" ON public.conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER conversations_updated BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'COMPLETE',
  provider_id uuid REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON public.messages(conversation_id, created_at);
CREATE INDEX messages_user_idx ON public.messages(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON public.messages FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE TRIGGER messages_updated BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- provider_health_checks
CREATE TABLE public.provider_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  status text NOT NULL,
  latency_ms integer,
  safe_error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX health_provider_idx ON public.provider_health_checks(provider_id, created_at DESC);
GRANT SELECT, INSERT ON public.provider_health_checks TO authenticated;
GRANT ALL ON public.provider_health_checks TO service_role;
ALTER TABLE public.provider_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own health select" ON public.provider_health_checks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own health insert" ON public.provider_health_checks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- usage_events
CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  provider_id uuid REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_user_idx ON public.usage_events(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own usage select" ON public.usage_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own usage insert" ON public.usage_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- audit_logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_user_idx ON public.audit_logs(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit select" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own audit insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- new user bootstrap
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.routing_preferences (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
