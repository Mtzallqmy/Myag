-- Add scheduling to the existing agent_jobs; do not duplicate task/business tables.
-- Only the API's service-role connection may claim/renew queue entries.
CREATE TABLE public.wakeel_job_queue (
  job_id uuid PRIMARY KEY REFERENCES public.agent_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','RUNNING','DONE','FAILED','INTERRUPTED')),
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wakeel_job_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wakeel_job_queue FROM anon,authenticated;
GRANT ALL ON public.wakeel_job_queue TO service_role;
CREATE INDEX wakeel_job_queue_claim ON public.wakeel_job_queue(status,created_at);

CREATE FUNCTION public.wakeel_enqueue_job(p_job_id uuid,p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE q public.wakeel_job_queue;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.agent_jobs WHERE id=p_job_id AND user_id=p_user_id AND status='PLANNING' AND current_step=0) THEN
    SELECT * INTO q FROM public.wakeel_job_queue WHERE job_id=p_job_id AND user_id=p_user_id;
    IF FOUND THEN RETURN jsonb_build_object('status',q.status); END IF;
    RAISE EXCEPTION 'JOB_NOT_SCHEDULABLE';
  END IF;
  INSERT INTO public.wakeel_job_queue(job_id,user_id) VALUES(p_job_id,p_user_id) ON CONFLICT(job_id) DO NOTHING;
  SELECT * INTO q FROM public.wakeel_job_queue WHERE job_id=p_job_id AND user_id=p_user_id;
  RETURN jsonb_build_object('status',q.status);
END; $$;

CREATE FUNCTION public.wakeel_claim_job() RETURNS SETOF public.wakeel_job_queue
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  -- Expired started jobs are not replayed: partial LLM/write operations need reconciliation.
  -- Queued jobs persist and are resumed automatically after a process restart.
  WITH expired AS (
    UPDATE public.wakeel_job_queue SET status='INTERRUPTED',last_error='WORKER_LEASE_EXPIRED',updated_at=now()
    WHERE status='RUNNING' AND lease_until<now() RETURNING job_id
  )
  UPDATE public.agent_jobs SET status='INTERRUPTED',error_code='WORKER_LEASE_EXPIRED',completed_at=now()
  WHERE id IN (SELECT job_id FROM expired) AND status NOT IN ('COMPLETED','FAILED','CANCELLED','AWAITING_APPROVAL');
  RETURN QUERY
    UPDATE public.wakeel_job_queue q SET status='RUNNING',lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',attempts=q.attempts+1,updated_at=now()
    WHERE q.job_id=(SELECT job_id FROM public.wakeel_job_queue WHERE status='QUEUED' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING q.*;
END; $$;

CREATE FUNCTION public.wakeel_renew_job(p_job_id uuid,p_lease_token uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  UPDATE public.wakeel_job_queue SET lease_until=now()+interval '90 seconds',updated_at=now()
  WHERE job_id=p_job_id AND lease_token=p_lease_token AND status='RUNNING' AND lease_until>now();
  RETURN FOUND;
END; $$;

CREATE FUNCTION public.wakeel_finish_job(p_job_id uuid,p_lease_token uuid,p_ok boolean,p_error text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  UPDATE public.wakeel_job_queue SET status=CASE WHEN p_ok THEN 'DONE' ELSE 'FAILED' END,last_error=p_error,lease_until=NULL,updated_at=now()
  WHERE job_id=p_job_id AND lease_token=p_lease_token AND status='RUNNING' AND lease_until>now();
  RETURN FOUND;
END; $$;

REVOKE EXECUTE ON FUNCTION public.wakeel_enqueue_job(uuid,uuid),public.wakeel_claim_job(),public.wakeel_renew_job(uuid,uuid),public.wakeel_finish_job(uuid,uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wakeel_enqueue_job(uuid,uuid),public.wakeel_claim_job(),public.wakeel_renew_job(uuid,uuid),public.wakeel_finish_job(uuid,uuid,boolean,text) TO service_role;
