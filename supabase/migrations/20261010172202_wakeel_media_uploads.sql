-- Private general attachments, separate from the canonical editable project workspace.
CREATE TABLE public.wakeel_uploads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 150), mime text NOT NULL,
 size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 52428800), object_path text NOT NULL UNIQUE,
 purpose text NOT NULL CHECK (purpose IN ('FILE','VISION')), status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','READY')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wakeel_uploads_owner_created ON public.wakeel_uploads(user_id,created_at DESC);
ALTER TABLE public.wakeel_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wakeel_uploads FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.wakeel_uploads TO authenticated;
GRANT ALL ON public.wakeel_uploads TO service_role;
CREATE POLICY wakeel_uploads_owner_read ON public.wakeel_uploads FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('wakeel-uploads','wakeel-uploads',false,52428800,ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/mpeg','audio/mp4','application/pdf','application/zip','text/plain','application/octet-stream'])
 ON CONFLICT(id) DO NOTHING;
-- No client write/delete/storage policies; signed upload URLs are issued by the authenticated API only.
-- Atomic reservation keeps simultaneous uploads inside both the count and byte quota.
CREATE FUNCTION public.wakeel_reserve_upload(p_owner uuid,p_name text,p_mime text,p_size bigint,p_purpose text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE result uuid := gen_random_uuid(); total bigint; files int;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_owner::text,7193));
 SELECT count(*),COALESCE(sum(CASE WHEN status='READY' THEN size_bytes ELSE 52428800 END),0) INTO files,total FROM public.wakeel_uploads WHERE user_id=p_owner;
 IF files>=50 OR total+52428800>524288000 THEN RAISE EXCEPTION 'UPLOAD_QUOTA_EXCEEDED'; END IF;
 INSERT INTO public.wakeel_uploads(id,user_id,name,mime,size_bytes,purpose,object_path)
 VALUES(result,p_owner,p_name,p_mime,p_size,p_purpose,p_owner::text||'/'||result::text);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.wakeel_reserve_upload(uuid,text,text,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wakeel_reserve_upload(uuid,text,text,bigint,text) TO service_role;
