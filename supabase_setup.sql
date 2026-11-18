-- Esquema inicial para un proyecto de Supabase sin tablas previas de la aplicación.
begin;

create table public.learning_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 60),
  level text not null check (level in ('A1', 'A2', 'B1', 'B2')),
  snapshot jsonb not null check (
    jsonb_typeof(snapshot) = 'object'
    and snapshot @> '{"version": 1}'
    and not (snapshot ?| array['drafts', 'missionDrafts', 'studyAnalyticsConsent', 'cloudEventsConsent'])
    and octet_length(snapshot::text) <= 2000000
  ),
  updated_at timestamptz not null default now()
);

create table public.study_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  module_id text not null check (module_id ~ '^[a-z0-9][a-z0-9/-]{0,79}$'),
  score integer,
  created_at timestamptz not null default now(),
  check (
    (kind in ('mission_started', 'lesson_started', 'mission_error') and score is null)
    or
    (kind in ('mission_completed', 'lesson_completed', 'listening_completed', 'mission_skill')
      and score is not null and score between 0 and 100)
  )
);

create table public.study_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create index study_events_by_user_date on public.study_events (user_id, created_at desc);
create index study_events_by_date on public.study_events (created_at desc);

alter table public.learning_profiles enable row level security;
alter table public.study_events enable row level security;
alter table public.study_admins enable row level security;

revoke all on public.learning_profiles, public.study_events, public.study_admins from public, anon, authenticated;
grant select on public.learning_profiles to authenticated;
grant insert (id, nickname, level, snapshot), update (id, nickname, level, snapshot)
  on public.learning_profiles to authenticated;
grant insert (user_id, kind, module_id, score) on public.study_events to authenticated;

create policy own_profile_read on public.learning_profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy own_profile_create on public.learning_profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy own_profile_update on public.learning_profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy own_event_insert on public.study_events for insert to authenticated
  with check ((select auth.uid()) = user_id);

create function public.xanny_profile_timestamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.xanny_profile_timestamp() from public, anon, authenticated;
create trigger xanny_profile_timestamp before update on public.learning_profiles
  for each row execute function public.xanny_profile_timestamp();

create function public.fluentlab_teacher_overview() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.study_admins where user_id = auth.uid()) then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'accounts', (select count(*) from auth.users),
    'profiles', (select count(*) from public.learning_profiles),
    'active7d', (select count(distinct user_id) from public.study_events where created_at >= now() - interval '7 days'),
    'events7d', (select count(*) from public.study_events where created_at >= now() - interval '7 days')
  );
end;
$$;

create function public.fluentlab_teacher_roster()
  returns table (alias text, level text, activities bigint, "lastActivity" timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.study_admins where user_id = auth.uid()) then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  return query
    select p.nickname, p.level, e.activities, e.last_activity
    from public.learning_profiles as p
    cross join lateral (
      select count(*) as activities, max(created_at) as last_activity
      from public.study_events where user_id = p.id
    ) as e
    order by p.updated_at desc
    limit 200;
end;
$$;

revoke all on function public.fluentlab_teacher_overview(), public.fluentlab_teacher_roster() from public, anon, authenticated;
grant execute on function public.fluentlab_teacher_overview(), public.fluentlab_teacher_roster() to authenticated;

commit;
