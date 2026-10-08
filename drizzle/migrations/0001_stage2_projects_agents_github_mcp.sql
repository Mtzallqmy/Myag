
-- ================= PROJECTS =================
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  source_type text NOT NULL DEFAULT 'UPLOAD',
  status text NOT NULL DEFAULT 'PROCESSING',
  workspace_ref text,
  repository_id uuid,
  language_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  framework_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_count integer NOT NULL DEFAULT 0,
  size_bytes bigint NOT NULL DEFAULT 0,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_user_idx ON public.projects(user_id, updated_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own projects select" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own projects update" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own projects delete" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  path text NOT NULL,
  file_name text NOT NULL,
  extension text,
  mime_type text,
  size_bytes bigint NOT NULL DEFAULT 0,
  sha256 text,
  language text,
  is_binary boolean NOT NULL DEFAULT false,
  line_count integer NOT NULL DEFAULT 0,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, path)
);
CREATE INDEX project_files_project_idx ON public.project_files(project_id, path);
GRANT SELECT ON public.project_files TO authenticated;
GRANT ALL ON public.project_files TO service_role;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own files select" ON public.project_files FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER project_files_updated BEFORE UPDATE ON public.project_files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.project_symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.project_files(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  symbol_type text NOT NULL,
  name text NOT NULL,
  qualified_name text,
  start_line integer NOT NULL,
  end_line integer,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX project_symbols_project_idx ON public.project_symbols(project_id, name);
GRANT SELECT ON public.project_symbols TO authenticated;
GRANT ALL ON public.project_symbols TO service_role;
ALTER TABLE public.project_symbols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own symbols select" ON public.project_symbols FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.project_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.project_files(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  chunk_index integer NOT NULL,
  start_line integer NOT NULL DEFAULT 1,
  content text NOT NULL,
  embedding jsonb,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (file_id, chunk_index)
);
CREATE INDEX project_chunks_project_idx ON public.project_chunks(project_id);
GRANT SELECT ON public.project_chunks TO authenticated;
GRANT ALL ON public.project_chunks TO service_role;
ALTER TABLE public.project_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chunks select" ON public.project_chunks FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ================= AGENT JOBS =================
CREATE TABLE public.agent_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'SUGGEST',
  status text NOT NULL DEFAULT 'PLANNING',
  request_text text NOT NULL,
  plan_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_step integer NOT NULL DEFAULT 0,
  progress integer NOT NULL DEFAULT 0,
  requires_approval boolean NOT NULL DEFAULT false,
  cost_estimate numeric,
  result_summary text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX agent_jobs_user_idx ON public.agent_jobs(user_id, created_at DESC);
CREATE INDEX agent_jobs_project_idx ON public.agent_jobs(project_id, created_at DESC);
GRANT SELECT ON public.agent_jobs TO authenticated;
GRANT ALL ON public.agent_jobs TO service_role;
ALTER TABLE public.agent_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own jobs select" ON public.agent_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER agent_jobs_updated BEFORE UPDATE ON public.agent_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.agent_job_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.agent_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  step_number integer NOT NULL,
  step_type text NOT NULL,
  status text NOT NULL DEFAULT 'RUNNING',
  summary text NOT NULL DEFAULT '',
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX agent_job_steps_job_idx ON public.agent_job_steps(job_id, step_number);
GRANT SELECT ON public.agent_job_steps TO authenticated;
GRANT ALL ON public.agent_job_steps TO service_role;
ALTER TABLE public.agent_job_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own steps select" ON public.agent_job_steps FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.change_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.agent_jobs(id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  diff_text text NOT NULL DEFAULT '',
  files_changed_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'PROPOSED',
  branch_name text,
  commit_sha text,
  pr_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX change_sets_project_idx ON public.change_sets(project_id, created_at DESC);
GRANT SELECT ON public.change_sets TO authenticated;
GRANT ALL ON public.change_sets TO service_role;
ALTER TABLE public.change_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own change sets select" ON public.change_sets FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid REFERENCES public.agent_jobs(id) ON DELETE CASCADE,
  change_set_id uuid REFERENCES public.change_sets(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  risk_level text NOT NULL DEFAULT 'MEDIUM',
  summary text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  executed_at timestamptz
);
CREATE INDEX approvals_user_idx ON public.approvals(user_id, status, created_at DESC);
GRANT SELECT ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own approvals select" ON public.approvals FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.validation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.agent_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL,
  command_label text NOT NULL,
  duration_ms integer,
  summary text NOT NULL DEFAULT '',
  output_excerpt text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX validation_runs_job_idx ON public.validation_runs(job_id);
GRANT SELECT ON public.validation_runs TO authenticated;
GRANT ALL ON public.validation_runs TO service_role;
ALTER TABLE public.validation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own validation select" ON public.validation_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ================= GITHUB =================
CREATE TABLE public.github_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  auth_type text NOT NULL DEFAULT 'PAT',
  installation_id text,
  account_login text NOT NULL,
  account_id bigint,
  token_hint text,
  scopes text,
  status text NOT NULL DEFAULT 'ACTIVE',
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX github_connections_user_idx ON public.github_connections(user_id);
GRANT SELECT, DELETE ON public.github_connections TO authenticated;
GRANT ALL ON public.github_connections TO service_role;
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own gh select" ON public.github_connections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own gh delete" ON public.github_connections FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER github_connections_updated BEFORE UPDATE ON public.github_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.github_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL UNIQUE REFERENCES public.github_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  key_version text NOT NULL,
  ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.github_credentials FROM anon, authenticated;
GRANT ALL ON public.github_credentials TO service_role;
ALTER TABLE public.github_credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.github_repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.github_connections(id) ON DELETE CASCADE,
  github_repo_id bigint NOT NULL,
  full_name text NOT NULL,
  default_branch text NOT NULL DEFAULT 'main',
  is_private boolean NOT NULL DEFAULT true,
  permissions_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  pushed_at timestamptz,
  status text NOT NULL DEFAULT 'AVAILABLE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, github_repo_id)
);
CREATE INDEX github_repositories_user_idx ON public.github_repositories(user_id, full_name);
GRANT SELECT ON public.github_repositories TO authenticated;
GRANT ALL ON public.github_repositories TO service_role;
ALTER TABLE public.github_repositories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own repos select" ON public.github_repositories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER github_repositories_updated BEFORE UPDATE ON public.github_repositories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.repository_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  repository_id uuid NOT NULL REFERENCES public.github_repositories(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  base_branch text NOT NULL,
  base_sha text,
  runtime_workspace_id text,
  status text NOT NULL DEFAULT 'IMPORTED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.repository_workspaces TO authenticated;
GRANT ALL ON public.repository_workspaces TO service_role;
ALTER TABLE public.repository_workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own repo ws select" ON public.repository_workspaces FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER repository_workspaces_updated BEFORE UPDATE ON public.repository_workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.projects ADD CONSTRAINT projects_repository_fk FOREIGN KEY (repository_id) REFERENCES public.github_repositories(id) ON DELETE SET NULL;

-- ================= MCP =================
CREATE TABLE public.mcp_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  transport text NOT NULL DEFAULT 'STREAMABLE_HTTP',
  auth_type text NOT NULL DEFAULT 'NONE',
  status text NOT NULL DEFAULT 'UNKNOWN',
  server_info_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  oauth_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error_code text,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mcp_servers_user_idx ON public.mcp_servers(user_id);
GRANT SELECT, DELETE ON public.mcp_servers TO authenticated;
GRANT ALL ON public.mcp_servers TO service_role;
ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mcp select" ON public.mcp_servers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own mcp delete" ON public.mcp_servers FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER mcp_servers_updated BEFORE UPDATE ON public.mcp_servers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.mcp_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL UNIQUE REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  credential_type text NOT NULL,
  key_version text NOT NULL,
  ciphertext text NOT NULL,
  scopes text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.mcp_credentials FROM anon, authenticated;
GRANT ALL ON public.mcp_credentials TO service_role;
ALTER TABLE public.mcp_credentials ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER mcp_credentials_updated BEFORE UPDATE ON public.mcp_credentials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.mcp_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  code_verifier_enc text NOT NULL,
  issuer text NOT NULL,
  token_endpoint text NOT NULL,
  client_id text NOT NULL,
  client_secret_enc text,
  redirect_uri text NOT NULL,
  scope text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.mcp_oauth_states FROM anon, authenticated;
GRANT ALL ON public.mcp_oauth_states TO service_role;
ALTER TABLE public.mcp_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mcp_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  input_schema_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_level text NOT NULL DEFAULT 'HIGH',
  enabled boolean NOT NULL DEFAULT false,
  approval_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, name)
);
GRANT SELECT ON public.mcp_tools TO authenticated;
GRANT ALL ON public.mcp_tools TO service_role;
ALTER TABLE public.mcp_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mcp tools select" ON public.mcp_tools FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER mcp_tools_updated BEFORE UPDATE ON public.mcp_tools FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.mcp_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  uri text NOT NULL,
  name text,
  description text,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, uri)
);
GRANT SELECT ON public.mcp_resources TO authenticated;
GRANT ALL ON public.mcp_resources TO service_role;
ALTER TABLE public.mcp_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mcp resources select" ON public.mcp_resources FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.mcp_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  arguments_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, name)
);
GRANT SELECT ON public.mcp_prompts TO authenticated;
GRANT ALL ON public.mcp_prompts TO service_role;
ALTER TABLE public.mcp_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mcp prompts select" ON public.mcp_prompts FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.integration_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  integration_key text NOT NULL,
  status text NOT NULL DEFAULT 'NOT_CONNECTED',
  ref_id uuid,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, integration_key)
);
GRANT SELECT ON public.integration_registry TO authenticated;
GRANT ALL ON public.integration_registry TO service_role;
ALTER TABLE public.integration_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own registry select" ON public.integration_registry FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER integration_registry_updated BEFORE UPDATE ON public.integration_registry FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================= STORAGE (private, user-scoped by first folder) =================
CREATE POLICY "own archives read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-archives' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own archives insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-archives' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own archives delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-archives' AND (storage.foldername(name))[1] = auth.uid()::text);

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_job_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.approvals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
