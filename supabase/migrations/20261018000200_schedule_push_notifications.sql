create extension if not exists pg_cron;
create extension if not exists pg_net;

do $migration$
begin
  if not exists (
    select 1 from vault.decrypted_secrets where name = 'tasky_cron_secret'
  ) then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', ''),
      'tasky_cron_secret',
      'Authenticates the scheduled Tasky push notification function.'
    );
  end if;
end;
$migration$;

create or replace function public.is_tasky_cron_authorized(p_secret text)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'tasky_cron_secret'
      and decrypted_secret = p_secret
  );
$function$;

revoke all on function public.is_tasky_cron_authorized(text) from public, anon, authenticated;
grant execute on function public.is_tasky_cron_authorized(text) to service_role;

do $migration$
begin
  if exists (
    select 1 from cron.job where jobname = 'tasky-send-due-notifications'
  ) then
    perform cron.unschedule('tasky-send-due-notifications');
  end if;

  perform cron.schedule(
    'tasky-send-due-notifications',
    '* * * * *',
    $job$
      select net.http_post(
        url := 'https://xbheuldreytlwxcnfkxb.supabase.co/functions/v1/send-due-notifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-tasky-cron-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'tasky_cron_secret'
          )
        ),
        body := '{}'::jsonb
      );
    $job$
  );
end;
$migration$;
