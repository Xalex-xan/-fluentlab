-- Lista de alta para xanny-dev. Instalar una vez; activar el hook desde Auth después de cargar los buzones autorizados.
begin;

create table xanny_private.pilot_mailboxes (
  email text primary key check (
    email = lower(btrim(email)) and char_length(email) between 3 and 254 and
    email ~ '^[^@[:space:]]+@[^@[:space:]]+$'
  )
);
alter table xanny_private.pilot_mailboxes enable row level security;
revoke all on xanny_private.pilot_mailboxes from public, anon, authenticated, service_role, supabase_auth_admin;
grant usage on schema xanny_private to supabase_auth_admin;
grant select on xanny_private.pilot_mailboxes to supabase_auth_admin;
create policy auth_reads_pilot_mailboxes on xanny_private.pilot_mailboxes
  for select to supabase_auth_admin using (true);

create function public.xanny_pilot_before_signup(event jsonb)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select case when event #>> '{user,app_metadata,provider}' = 'email'
    and exists (
      select 1 from xanny_private.pilot_mailboxes
      where email = lower(btrim(event #>> '{user,email}'))
    )
  then '{}'::jsonb
  else jsonb_build_object('error',jsonb_build_object(
    'http_code',403,'message','El registro de este piloto está limitado a buzones autorizados.'))
  end;
$$;

revoke all on function public.xanny_pilot_before_signup(jsonb)
  from public, anon, authenticated, service_role, supabase_auth_admin;
grant execute on function public.xanny_pilot_before_signup(jsonb) to supabase_auth_admin;

commit;
