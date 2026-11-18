-- Migración aditiva para aplicar después de supabase_setup.sql en desarrollo.
begin;

create table public.study_levels (code text primary key);
insert into public.study_levels values ('A1'), ('A2'), ('B1'), ('B2'), ('C1');
alter table public.learning_profiles drop constraint learning_profiles_level_check;
alter table public.learning_profiles add foreign key (level) references public.study_levels(code);

create table public.study_teachers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table public.study_analytics_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null
);
create table public.classroom_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  invite_code uuid not null unique default gen_random_uuid()
);
create table public.classroom_members (
  group_id uuid references public.classroom_groups(id) on delete cascade,
  student_id uuid references auth.users(id) on delete cascade,
  alias text not null check (char_length(alias) between 1 and 60),
  primary key (group_id, student_id)
);
create table public.classroom_missions (id text primary key, skill text not null);
insert into public.classroom_missions values
  ('a2-delivery','Resolver problemas'), ('a2-clarify','Interacción natural'),
  ('a2-schedule','Interacción natural'), ('a2-travel','Resolver problemas'),
  ('b1-support','Empatía y servicio'), ('b1-interview','Comunicación profesional'),
  ('b1-tech','Resolver problemas'), ('b1-housing','Resolver problemas'),
  ('b1-team','Colaboración'), ('b1-misunderstanding','Interacción natural'),
  ('b2-negotiate','Negociación'), ('b2-disagree','Argumentación'),
  ('b2-data','Pensamiento crítico'), ('b2-project','Comunicación profesional'),
  ('c1-crisis','Comunicación profesional'), ('c1-reason','Pensamiento crítico');

create table public.classroom_assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.classroom_groups(id) on delete cascade,
  mission_id text not null references public.classroom_missions(id),
  assigned_at timestamptz not null default now(),
  unique (group_id, mission_id),
  unique (id, group_id)
);
create table public.classroom_results (
  attempt_id uuid primary key,
  assignment_id uuid not null,
  group_id uuid not null,
  student_id uuid not null,
  mode text not null check (mode in ('free','course')),
  first_count smallint not null check (first_count between 0 and 3),
  assisted_count smallint not null check (assisted_count between 0 and 3),
  revealed_count smallint not null check (revealed_count between 0 and 3),
  written boolean not null,
  review_due date not null,
  submitted_at timestamptz not null default now(),
  check (first_count + assisted_count + revealed_count = 3),
  check (mode <> 'course' or written),
  foreign key (assignment_id, group_id) references public.classroom_assignments(id, group_id) on delete cascade,
  foreign key (group_id, student_id) references public.classroom_members(group_id, student_id) on delete cascade
);
create index classroom_groups_owner on public.classroom_groups(owner_id);
create index classroom_members_student on public.classroom_members(student_id);
create index classroom_results_group_recent on public.classroom_results(group_id, submitted_at desc);

alter table public.study_levels enable row level security;
alter table public.study_teachers enable row level security;
alter table public.study_analytics_preferences enable row level security;
alter table public.classroom_groups enable row level security;
alter table public.classroom_members enable row level security;
alter table public.classroom_missions enable row level security;
alter table public.classroom_assignments enable row level security;
alter table public.classroom_results enable row level security;

revoke all on public.study_levels, public.study_teachers, public.study_analytics_preferences,
  public.classroom_groups, public.classroom_members, public.classroom_missions,
  public.classroom_assignments, public.classroom_results from public, anon, authenticated;
grant select on public.study_analytics_preferences to authenticated;
create policy own_consent_read on public.study_analytics_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy own_event_insert on public.study_events;
create policy own_event_insert on public.study_events for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.study_analytics_preferences where user_id = (select auth.uid()) and enabled
  ));

create schema xanny_private;
revoke all on schema xanny_private from public, anon, authenticated;

create function xanny_private.require_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Sesión obligatoria' using errcode = '42501'; end if;
  return actor;
end;
$$;

create function xanny_private.education_role(actor uuid) returns text
language sql stable set search_path = '' as $$
  select case
    when exists (select 1 from public.study_admins where user_id = actor) then 'admin'
    when exists (select 1 from public.study_teachers where user_id = actor) then 'teacher'
    else 'student' end;
$$;

create function xanny_private.manages(actor uuid, target_group uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.classroom_groups where id = target_group and
    (xanny_private.education_role(actor) = 'admin' or
     (owner_id = actor and xanny_private.education_role(actor) = 'teacher')));
$$;

-- El bloqueo comparte el orden de escritura con la revocación de consentimiento.
create function xanny_private.require_event_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare agreed boolean;
begin
  select enabled into agreed from public.study_analytics_preferences where user_id = new.user_id for share;
  if new.user_id is distinct from auth.uid() or agreed is distinct from true then
    raise exception 'Analítica sin consentimiento' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger require_event_consent before insert on public.study_events
  for each row execute function xanny_private.require_event_consent();

-- Restaurar se confirma en el cliente. Guardar aplica control de versión atómico.
revoke insert (id, nickname, level, snapshot), update (id, nickname, level, snapshot)
  on public.learning_profiles from authenticated;
drop policy own_profile_create on public.learning_profiles;
drop policy own_profile_update on public.learning_profiles;
create function public.xanny_save_progress(
  p_alias text, p_level text, p_snapshot jsonb, p_expected timestamptz
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := xanny_private.require_user();
        saved public.learning_profiles;
begin
  if p_expected is null then
    insert into public.learning_profiles(id, nickname, level, snapshot)
      values (actor, p_alias, p_level, p_snapshot)
      on conflict (id) do nothing returning * into saved;
  else
    update public.learning_profiles set nickname = p_alias, level = p_level, snapshot = p_snapshot
      where id = actor and updated_at = p_expected returning * into saved;
  end if;
  if saved.id is null then raise exception 'La copia cambió. Vuelve a consultarla.' using errcode = '40001'; end if;
  return jsonb_build_object('nickname', saved.nickname, 'level', saved.level, 'updated_at', saved.updated_at);
end;
$$;

create function public.xanny_analytics_consent(p_enabled boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid := xanny_private.require_user();
begin
  if p_enabled is null then raise exception 'Consentimiento inválido' using errcode = '22023'; end if;
  insert into public.study_analytics_preferences(user_id, enabled) values (actor, p_enabled)
    on conflict (user_id) do update set enabled = excluded.enabled;
  if not p_enabled then delete from public.study_events where user_id = actor; end if;
  return p_enabled;
end;
$$;

create function public.xanny_classroom_context() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := xanny_private.require_user();
begin
  return jsonb_build_object('role', xanny_private.education_role(actor), 'groups', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id, 'name', g.name,
      'manage', xanny_private.manages(actor, g.id),
      'invite', case when xanny_private.manages(actor, g.id) then g.invite_code else null end,
      'assignments', coalesce((
        select jsonb_agg(jsonb_build_object('id', a.id, 'missionId', a.mission_id,
          'sent', exists (select 1 from public.classroom_results r where r.assignment_id = a.id and r.student_id = actor))
          order by a.assigned_at desc)
        from public.classroom_assignments a where a.group_id = g.id
      ), '[]'::jsonb)
    ) order by g.name, g.id)
    from public.classroom_groups g
    where xanny_private.manages(actor, g.id) or exists (
      select 1 from public.classroom_members m where m.group_id = g.id and m.student_id = actor)
  ), '[]'::jsonb));
end;
$$;

create function public.xanny_create_group(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := xanny_private.require_user();
        new_id uuid;
begin
  if xanny_private.education_role(actor) not in ('teacher','admin') then
    raise exception 'Acceso docente obligatorio' using errcode = '42501';
  end if;
  insert into public.classroom_groups(owner_id, name) values (actor, btrim(p_name))
    returning id into new_id;
  return new_id;
end;
$$;

create function public.xanny_join_group(p_code uuid, p_alias text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := xanny_private.require_user();
        target_group uuid;
begin
  if xanny_private.education_role(actor) <> 'student' then
    raise exception 'La inscripción requiere una cuenta de estudiante' using errcode = '42501';
  end if;
  select g.id into target_group from public.classroom_groups g where g.invite_code = p_code;
  if target_group is null then raise exception 'Código de clase inválido' using errcode = '22023'; end if;
  insert into public.classroom_members(group_id, student_id, alias)
    values (target_group, actor, btrim(p_alias)) on conflict (group_id, student_id) do nothing;
  return target_group;
end;
$$;

create function public.xanny_rotate_invite(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not xanny_private.manages(xanny_private.require_user(), p_group) then
    raise exception 'Clase no autorizada' using errcode = '42501';
  end if;
  update public.classroom_groups set invite_code = gen_random_uuid() where id = p_group;
end;
$$;

create function public.xanny_assign_mission(p_group uuid, p_mission text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare assignment uuid;
begin
  if not xanny_private.manages(xanny_private.require_user(), p_group) then
    raise exception 'Clase no autorizada' using errcode = '42501';
  end if;
  insert into public.classroom_assignments(group_id, mission_id) values (p_group, p_mission)
    on conflict (group_id, mission_id) do nothing;
  select id into assignment from public.classroom_assignments where group_id = p_group and mission_id = p_mission;
  return assignment;
end;
$$;

create function public.xanny_submit_result(
  p_attempt uuid, p_assignment uuid, p_mode text, p_first smallint, p_assisted smallint,
  p_revealed smallint, p_written boolean, p_review_due date
) returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := xanny_private.require_user();
        target_group uuid;
begin
  select a.group_id into target_group from public.classroom_assignments a
    join public.classroom_members m on m.group_id = a.group_id and m.student_id = actor
    where a.id = p_assignment;
  if target_group is null or xanny_private.education_role(actor) <> 'student' then
    raise exception 'Actividad no autorizada' using errcode = '42501';
  end if;
  if p_review_due not between current_date - 2 and current_date + 30 then
    raise exception 'Fecha de repaso inválida' using errcode = '22023';
  end if;
  insert into public.classroom_results(attempt_id, assignment_id, group_id, student_id, mode,
    first_count, assisted_count, revealed_count, written, review_due)
    values (p_attempt, p_assignment, target_group, actor, p_mode, p_first, p_assisted, p_revealed, p_written, p_review_due)
    on conflict (attempt_id) do nothing;
  if not exists (select 1 from public.classroom_results where attempt_id = p_attempt and
    student_id = actor and assignment_id = p_assignment and mode = p_mode and first_count = p_first and
    assisted_count = p_assisted and revealed_count = p_revealed and written = p_written and review_due = p_review_due) then
    raise exception 'El identificador ya está en uso' using errcode = '23505';
  end if;
end;
$$;

create function public.xanny_classroom_report(p_group uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not xanny_private.manages(xanny_private.require_user(), p_group) then
    raise exception 'Clase no autorizada' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'members', (select count(*) from public.classroom_members where group_id = p_group),
    'totals', (select jsonb_build_object('attempts', count(*), 'completed', count(distinct (student_id, assignment_id)),
      'first', coalesce(sum(first_count), 0), 'assisted', coalesce(sum(assisted_count), 0),
      'written', count(*) filter (where written))
      from public.classroom_results where group_id = p_group),
    'pending', (select count(*) from (
      select distinct on (student_id, assignment_id) review_due
      from public.classroom_results where group_id = p_group order by student_id, assignment_id, submitted_at desc
    ) as latest where review_due <= current_date),
    'roster', coalesce((
      select jsonb_agg(jsonb_build_object('alias', m.alias, 'completed', (
        select count(distinct assignment_id) from public.classroom_results r
        where r.group_id = m.group_id and r.student_id = m.student_id
      )) order by m.alias)
      from public.classroom_members m where m.group_id = p_group
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.submitted_at desc) from (
        select m.alias, a.mission_id as mission, r.first_count as first, r.assisted_count as assisted,
          r.revealed_count as revealed, r.written, r.submitted_at
        from public.classroom_results r
        join public.classroom_members m on m.group_id = r.group_id and m.student_id = r.student_id
        join public.classroom_assignments a on a.id = r.assignment_id
        where r.group_id = p_group order by r.submitted_at desc limit 40
      ) r
    ), '[]'::jsonb),
    'skills', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.week desc, s.skill) from (
        select m.skill, date_trunc('week', r.submitted_at at time zone 'UTC')::date as week,
          count(*) as attempts, sum(r.first_count) as first, sum(r.assisted_count) as assisted
        from public.classroom_results r
        join public.classroom_assignments a on a.id = r.assignment_id
        join public.classroom_missions m on m.id = a.mission_id
        where r.group_id = p_group and r.submitted_at >= now() - interval '84 days'
        group by m.skill, date_trunc('week', r.submitted_at at time zone 'UTC')::date
      ) s
    ), '[]'::jsonb));
end;
$$;

create or replace function public.fluentlab_teacher_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if xanny_private.education_role(xanny_private.require_user()) <> 'admin' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'accounts', (select count(*) from auth.users where xanny_private.education_role(id) = 'student'),
    'profiles', (select count(*) from public.learning_profiles where xanny_private.education_role(id) = 'student'),
    'active7d', (select count(distinct e.user_id) from public.study_events e join public.study_analytics_preferences p
      on p.user_id = e.user_id and p.enabled where e.created_at >= now() - interval '7 days'
      and xanny_private.education_role(e.user_id) = 'student'),
    'events7d', (select count(*) from public.study_events e join public.study_analytics_preferences p
      on p.user_id = e.user_id and p.enabled where e.created_at >= now() - interval '7 days'
      and xanny_private.education_role(e.user_id) = 'student')
  );
end;
$$;

revoke all on all functions in schema xanny_private from public, anon, authenticated;
revoke all on function public.xanny_save_progress(text,text,jsonb,timestamptz), public.xanny_analytics_consent(boolean),
  public.xanny_classroom_context(), public.xanny_create_group(text), public.xanny_join_group(uuid,text),
  public.xanny_rotate_invite(uuid), public.xanny_assign_mission(uuid,text),
  public.xanny_submit_result(uuid,uuid,text,smallint,smallint,smallint,boolean,date), public.xanny_classroom_report(uuid)
  from public, anon, authenticated;
grant execute on function public.xanny_save_progress(text,text,jsonb,timestamptz), public.xanny_analytics_consent(boolean),
  public.xanny_classroom_context(), public.xanny_create_group(text), public.xanny_join_group(uuid,text),
  public.xanny_rotate_invite(uuid), public.xanny_assign_mission(uuid,text),
  public.xanny_submit_result(uuid,uuid,text,smallint,smallint,smallint,boolean,date), public.xanny_classroom_report(uuid)
  to authenticated;

commit;
