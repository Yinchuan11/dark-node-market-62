-- Set up cron jobs for checking deposits and expiring requests
SELECT cron.schedule(
  'check-btc-deposits',
  '* * * * *', -- every minute
  $$
  SELECT
    net.http_post(
        url:='https://iqeubhhqdurqoaxnnyng.supabase.co/functions/v1/check-btc-shared',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxZXViaGhxZHVycW9heG5ueW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDQyOTksImV4cCI6MjA2OTAyMDI5OX0.r2GZmcITEN4KuC6woCLnPEMgZTdBrOAZv2IFovedoBs"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

SELECT cron.schedule(
  'check-ltc-deposits',
  '* * * * *', -- every minute
  $$
  SELECT
    net.http_post(
        url:='https://iqeubhhqdurqoaxnnyng.supabase.co/functions/v1/check-ltc-shared',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxZXViaGhxZHVycW9heG5ueW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDQyOTksImV4cCI6MjA2OTAyMDI5OX0.r2GZmcITEN4KuC6woCLnPEMgZTdBrOAZv2IFovedoBs"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

SELECT cron.schedule(
  'expire-deposit-requests',
  '*/5 * * * *', -- every 5 minutes
  $$
  SELECT
    net.http_post(
        url:='https://iqeubhhqdurqoaxnnyng.supabase.co/functions/v1/expire-deposit-requests',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxZXViaGhxZHVycW9heG5ueW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDQyOTksImV4cCI6MjA2OTAyMDI5OX0.r2GZmcITEN4KuC6woCLnPEMgZTdBrOAZv2IFovedoBs"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);