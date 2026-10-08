-- Internal application events must not inherit Supabase's default client grants.
REVOKE ALL ON public.app_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.app_events TO service_role;

-- Original archive limit is 50 MiB. Existing per-user storage policies apply.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-archives', 'project-archives', false, 52428800, ARRAY['application/zip'])
ON CONFLICT (id) DO NOTHING;
