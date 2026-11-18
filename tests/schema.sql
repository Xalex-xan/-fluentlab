\set ON_ERROR_STOP on
-- Modelo mínimo de los roles y la identidad que proporciona Supabase.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
insert into auth.users values ('10000000-0000-0000-0000-000000000001'), ('20000000-0000-0000-0000-000000000002');

\ir ../supabase_setup.sql

do $$
begin
  if has_table_privilege('anon', 'public.learning_profiles', 'SELECT')
    or has_function_privilege('anon', 'public.fluentlab_teacher_overview()', 'EXECUTE') then
    raise exception 'El rol anónimo tiene acceso a datos privados';
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
insert into public.learning_profiles (id, nickname, level, snapshot)
values (auth.uid(), 'Estudiante uno', 'A2', '{"version": 1, "completed": {}}')
returning nickname, level, updated_at;
insert into public.learning_profiles (id, nickname, level, snapshot)
values (auth.uid(), 'Alias actualizado', 'B1', '{"version": 1, "completed": {}}')
on conflict (id) do update
set nickname = excluded.nickname, level = excluded.level, snapshot = excluded.snapshot
returning nickname, level, updated_at;
insert into public.study_events (user_id, kind, module_id, score)
values (auth.uid(), 'mission_started', 'a2-delivery', null),
       (auth.uid(), 'mission_error', 'a2-delivery/0/1', null),
       (auth.uid(), 'mission_skill', 'resolver-problemas', 67);

do $$
begin
  begin
    perform public.fluentlab_teacher_overview();
    raise exception 'Un estudiante pudo abrir el resumen docente';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.study_admins values (auth.uid());
    raise exception 'Un estudiante pudo darse permisos docentes';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.learning_profiles set snapshot = '{"version": 1, "drafts": {}}';
    raise exception 'Se aceptó un borrador local';
  exception when check_violation then null;
  end;
  begin
    insert into public.study_events (user_id, kind, module_id, score)
    values (auth.uid(), 'mission_skill', 'resolver-problemas', 105);
    raise exception 'Se aceptó una puntuación inválida';
  exception when check_violation then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', false);
do $$
begin
  if exists (select 1 from public.learning_profiles) then
    raise exception 'Un usuario pudo leer la copia de otro';
  end if;
  update public.learning_profiles set nickname = 'Cambio ajeno';
  if found then
    raise exception 'Un usuario pudo editar la copia de otro';
  end if;
  begin
    insert into public.study_events (user_id, kind, module_id)
    values ('10000000-0000-0000-0000-000000000001', 'mission_started', 'a2-delivery');
    raise exception 'Se pudo atribuir un evento a otro usuario';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
insert into public.study_admins values ('20000000-0000-0000-0000-000000000002');
set role authenticated;
do $$
begin
  if (public.fluentlab_teacher_overview()->>'profiles')::integer <> 1 or
     not exists (select 1 from public.fluentlab_teacher_roster() where alias = 'Alias actualizado' and activities = 3) then
    raise exception 'El resumen o el listado docente está incompleto';
  end if;
end;
$$;
