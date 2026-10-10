-- Telegram metadata is user-readable; credentials and webhook validation are server-only.
CREATE TABLE public.telegram_bots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 bot_id bigint NOT NULL UNIQUE, username text NOT NULL, allowed_user_id bigint NOT NULL CHECK(allowed_user_id>0),
 conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'CONNECTED' CHECK(status IN ('CONNECTED','ENABLED','DISABLED','ERROR')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX telegram_bots_user_idx ON public.telegram_bots(user_id,created_at DESC);
ALTER TABLE public.telegram_bots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_bots FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.telegram_bots TO authenticated;
GRANT ALL ON public.telegram_bots TO service_role;
CREATE POLICY telegram_bots_owner ON public.telegram_bots FOR SELECT TO authenticated USING((SELECT auth.uid())=user_id);
CREATE TABLE public.telegram_bot_secrets (
 bot_id uuid PRIMARY KEY REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
 ciphertext text NOT NULL, key_version text NOT NULL, webhook_hash text
);
ALTER TABLE public.telegram_bot_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_bot_secrets FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.telegram_bot_secrets TO service_role;
CREATE TABLE public.telegram_inbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bot_id uuid NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, update_id bigint NOT NULL,
 chat_id bigint NOT NULL CHECK(chat_id>0), text text NOT NULL CHECK(length(text)<=4000), response text,
 user_message_id uuid NOT NULL DEFAULT gen_random_uuid(), assistant_message_id uuid NOT NULL DEFAULT gen_random_uuid(),
 status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','PROCESSING','READY','SENDING','SENT','FAILED','INTERRUPTED','SEND_UNCERTAIN')),
 error_code text, lease_token uuid, lease_until timestamptz, attempts integer NOT NULL DEFAULT 0,
 telegram_message_id bigint, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(bot_id,update_id)
);
ALTER TABLE public.telegram_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_inbox FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.telegram_inbox TO authenticated;
GRANT ALL ON public.telegram_inbox TO service_role;
CREATE POLICY telegram_inbox_owner ON public.telegram_inbox FOR SELECT TO authenticated USING((SELECT auth.uid())=user_id);
CREATE INDEX telegram_inbox_claim_idx ON public.telegram_inbox(status,created_at);
CREATE INDEX telegram_inbox_user_idx ON public.telegram_inbox(user_id,created_at DESC);
CREATE INDEX telegram_inbox_bot_idx ON public.telegram_inbox(bot_id,created_at);

CREATE FUNCTION public.wakeel_claim_telegram() RETURNS SETOF public.telegram_inbox LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 UPDATE public.telegram_inbox SET status=CASE WHEN status='SENDING' THEN 'SEND_UNCERTAIN' ELSE 'INTERRUPTED' END,error_code='LEASE_EXPIRED'
 WHERE status IN ('PROCESSING','SENDING') AND lease_until<now();
 RETURN QUERY UPDATE public.telegram_inbox q SET
 status=CASE WHEN q.status='QUEUED' THEN 'PROCESSING' ELSE q.status END,
 lease_token=gen_random_uuid(),lease_until=now()+interval '120 seconds',attempts=q.attempts+1
 WHERE q.id=(SELECT i.id FROM public.telegram_inbox i JOIN public.telegram_bots b ON b.id=i.bot_id
 WHERE b.status='ENABLED' AND i.status IN ('QUEUED','READY') AND (i.lease_until IS NULL OR i.lease_until<now())
 AND NOT EXISTS(SELECT 1 FROM public.telegram_inbox active WHERE active.bot_id=i.bot_id AND active.id<>i.id AND active.status IN ('PROCESSING','READY','SENDING') AND active.lease_until>now())
 ORDER BY i.created_at FOR UPDATE OF i SKIP LOCKED LIMIT 1) RETURNING q.*;
END; $$;
CREATE FUNCTION public.wakeel_renew_telegram(p_id uuid,p_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 UPDATE public.telegram_inbox SET lease_until=now()+interval '120 seconds' WHERE id=p_id AND lease_token=p_token AND lease_until>now() AND status IN ('PROCESSING','READY'); RETURN FOUND;
END; $$;
CREATE FUNCTION public.wakeel_ready_telegram(p_id uuid,p_token uuid,p_response text,p_model_id uuid DEFAULT NULL,p_provider_id uuid DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE row public.telegram_inbox; conv uuid;
BEGIN
 UPDATE public.telegram_inbox SET response=left(p_response,20000),status='READY'
 WHERE id=p_id AND lease_token=p_token AND lease_until>now() AND status='PROCESSING' RETURNING * INTO row;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT conversation_id INTO conv FROM public.telegram_bots WHERE id=row.bot_id AND user_id=row.user_id;
 IF conv IS NOT NULL THEN
  INSERT INTO public.messages(id,conversation_id,user_id,role,content,metadata_json) VALUES(row.user_message_id,conv,row.user_id,'user',row.text,jsonb_build_object('telegram_update',row.update_id)) ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.messages(id,conversation_id,user_id,role,content,model_id,provider_id,metadata_json) VALUES(row.assistant_message_id,conv,row.user_id,'assistant',left(p_response,20000),p_model_id,p_provider_id,jsonb_build_object('telegram_update',row.update_id)) ON CONFLICT(id) DO NOTHING;
 END IF;
 RETURN true;
END; $$;
CREATE FUNCTION public.wakeel_begin_telegram_send(p_id uuid,p_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 UPDATE public.telegram_inbox SET status='SENDING' WHERE id=p_id AND lease_token=p_token AND lease_until>now() AND status='READY'; RETURN FOUND;
END; $$;
REVOKE EXECUTE ON FUNCTION public.wakeel_claim_telegram(),public.wakeel_renew_telegram(uuid,uuid),public.wakeel_ready_telegram(uuid,uuid,text,uuid,uuid),public.wakeel_begin_telegram_send(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wakeel_claim_telegram(),public.wakeel_renew_telegram(uuid,uuid),public.wakeel_ready_telegram(uuid,uuid,text,uuid,uuid),public.wakeel_begin_telegram_send(uuid,uuid) TO service_role;
