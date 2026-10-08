CREATE TYPE public.app_role AS ENUM ('SUPER_ADMIN','ADMIN','SUPPORT','AUDITOR','READ_ONLY');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.user_plans (
  user_id uuid PRIMARY KEY,
  tier text NOT NULL DEFAULT 'FREE' CHECK (tier IN ('FREE','STANDARD','PRO','ADMIN')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_plans TO authenticated;
GRANT ALL ON public.user_plans TO service_role;
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plan readable" ON public.user_plans FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global','plan','user')),
  target text,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, scope, target)
);
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flags readable (global, own plan, own user)" ON public.feature_flags FOR SELECT TO authenticated
  USING (scope <> 'user' OR target = auth.uid()::text);

INSERT INTO public.feature_flags (key, scope, target, enabled) VALUES
 ('multi_agent','global',NULL,true),('deep_mode','global',NULL,true),('github_push','global',NULL,true),
 ('mcp_write_tools','global',NULL,true),('new_provider_adapter','global',NULL,false),
 ('experimental_router','global',NULL,false),('runtime_execution','global',NULL,false);

CREATE TABLE public.kill_switches (
  key text PRIMARY KEY CHECK (key IN ('disable_new_agent_jobs','disable_external_writes','disable_github_push','disable_mcp_writes','disable_uploads','disable_provider')),
  enabled boolean NOT NULL DEFAULT false,
  target text,
  reason text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kill_switches TO authenticated;
GRANT ALL ON public.kill_switches TO service_role;
ALTER TABLE public.kill_switches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kill switches readable" ON public.kill_switches FOR SELECT TO authenticated USING (true);
INSERT INTO public.kill_switches (key) VALUES ('disable_new_agent_jobs'),('disable_external_writes'),('disable_github_push'),('disable_mcp_writes'),('disable_uploads'),('disable_provider');

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('APPROVALS','JOBS','GITHUB','INTEGRATIONS','USAGE','SYSTEM')),
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications mark read" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own notifications delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['conversation_memory','project_memory','user_preferences_memory','task_memory'] LOOP
    EXECUTE format('CREATE TABLE public.%I (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      scope text NOT NULL,
      scope_id uuid,
      source text NOT NULL,
      summary text NOT NULL CHECK (char_length(summary) <= 2000),
      confidence real NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
      metadata jsonb NOT NULL DEFAULT ''{}''::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz
    )', t);
    EXECUTE format('CREATE INDEX %I ON public.%I (user_id, created_at DESC)', t || '_user_idx', t);
    EXECUTE format('GRANT SELECT, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "own memory read" ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY "own memory delete" ON public.%I FOR DELETE TO authenticated USING (user_id = auth.uid())', t);
  END LOOP;
END $$;

CREATE TABLE public.app_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text,
  user_id uuid,
  job_id uuid,
  provider_id uuid,
  model_id text,
  event text NOT NULL,
  status text NOT NULL,
  duration_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_events_created_idx ON public.app_events (created_at DESC);
GRANT ALL ON public.app_events TO service_role;
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agent_jobs ADD COLUMN IF NOT EXISTS orchestration jsonb;