-- Manual SQL acceptance: no test rows survive this transaction.
-- Run through a trusted administrator connection, never from the client app.
BEGIN;
DO $$
DECLARE a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('wakeel.test_owner', a::text, true);
  PERFORM set_config('wakeel.test_other', b::text, true);
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
    (a,a::text||'@example.invalid','{}'),(b,b::text||'@example.invalid','{}');
  IF (SELECT count(*) FROM public.profiles WHERE id IN(a,b)) <> 2
    OR (SELECT count(*) FROM public.routing_preferences WHERE user_id IN(a,b)) <> 2 THEN
    RAISE EXCEPTION 'Bootstrap failed';
  END IF;
  INSERT INTO public.conversations(user_id,title) VALUES(a,'Transient acceptance fixture');
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE a uuid := current_setting('wakeel.test_owner')::uuid;
        b uuid := current_setting('wakeel.test_other')::uuid; t text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',b::text,true);
  IF EXISTS(SELECT 1 FROM public.conversations WHERE user_id=a) THEN
    RAISE EXCEPTION 'Cross-user read allowed';
  END IF;
  BEGIN
    INSERT INTO public.conversations(user_id,title) VALUES(a,'Forged owner');
    RAISE EXCEPTION 'Forged ownership accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  FOREACH t IN ARRAY ARRAY['provider_secrets','github_credentials','mcp_credentials','mcp_oauth_states','app_events','wakeel_job_queue'] LOOP
    BEGIN
      EXECUTE format('SELECT * FROM public.%I LIMIT 1',t);
      RAISE EXCEPTION 'Secret table accessible: %',t;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
  BEGIN
    PERFORM public.wakeel_claim_job();
    RAISE EXCEPTION 'Worker RPC accessible';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claim.sub',a::text,true);
  IF (SELECT count(*) FROM public.conversations WHERE user_id=a) <> 1 THEN
    RAISE EXCEPTION 'Owner read denied';
  END IF;
END $$;
RESET ROLE;
SELECT 'PASS: live bootstrap, owner read, cross-user isolation, forged ownership and internal-table/RPC denial' AS result;
ROLLBACK;
