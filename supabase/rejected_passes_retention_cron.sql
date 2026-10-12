-- ==============================================================================
-- PASSI: 48-HOUR RETENTION & AUTO-DELETE CRON JOB FOR REJECTED PASSES
-- ==============================================================================
-- Instructions: Run this script in your Supabase SQL Editor.
-- It configures an automated hourly cron job that permanently hard-deletes
-- all rejected passes whose updated_at timestamp is older than 48 hours.

-- 1. Enable pg_cron extension in PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Grant usage on schema cron to postgres role if necessary
GRANT USAGE ON SCHEMA cron TO postgres;

-- 3. Safely unschedule previous job if it already exists to avoid duplicate schedules
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delete-expired-rejected-passes') THEN
    PERFORM cron.unschedule('delete-expired-rejected-passes');
  END IF;
END $$;

-- 4. Schedule the hourly purge job (runs at minute 0 of every hour)
SELECT cron.schedule(
  'delete-expired-rejected-passes',
  '0 * * * *',
  $$DELETE FROM public.passes WHERE entry_status = 'rejected' AND updated_at < NOW() - INTERVAL '48 hours'$$
);

-- 5. Query active cron jobs to confirm schedule
SELECT jobid, schedule, command, active, jobname 
FROM cron.job 
WHERE jobname = 'delete-expired-rejected-passes';
