\set ON_ERROR_STOP on
\ir sync-schema.sql

-- Incluye datos históricos para comprobar que el cambio no los reescribe.
update public.learning_profiles set snapshot = snapshot || '{"legacyField":1}'
  where id = '10000000-0000-0000-0000-000000000001';
alter table public.study_events disable trigger require_event_consent;
insert into public.study_events (user_id, kind, module_id) values
  ('10000000-0000-0000-0000-000000000001','mission_started','a2-delivery');
alter table public.study_events enable trigger require_event_consent;

\ir ../supabase_pilot_hardening.sql

do $$
begin
  if has_function_privilege('authenticated','public.xanny_save_progress(text,text,jsonb,timestamptz)','execute') then
    raise exception 'La RPC heredada sigue expuesta';
  end if;
  if not exists (select 1 from public.learning_profiles where snapshot ? 'legacyField') then
    raise exception 'Se perdió el progreso histórico';
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
do $$
begin
  begin
    perform public.xanny_sync_progress(auth.uid(),'Alumno piloto','C1',
      '{"version":1,"level":"C1","unitDrafts":{"b1":"Texto privado"}}',(select revision from public.learning_profiles));
    raise exception 'La RPC aceptó borradores de unidades';
  exception when check_violation then null;
  end;
  begin
    perform public.xanny_sync_progress(auth.uid(),'Alumno piloto','C1',
      '{"version":1,"level":"C1","unknown":true}',(select revision from public.learning_profiles));
    raise exception 'La RPC aceptó un campo ajeno al progreso';
  exception when check_violation then null;
  end;
  perform public.xanny_sync_progress(auth.uid(),'Alumno piloto','C1',
    '{"version":1,"level":"C1","xp":25,"unitSessions":{"b1/session-1":{"course":{"completed":1}}},"unitReviews":{},"unitErrors":{},"unitRecent":{}}',
    (select revision from public.learning_profiles));
  begin
    perform public.fluentlab_teacher_roster();
    raise exception 'Un alumno pudo leer el listado administrativo';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',false);
select public.xanny_analytics_consent(true);
insert into public.study_events (user_id, kind, module_id) values (auth.uid(),'mission_started','a2-delivery');

select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000004',false);
select public.xanny_sync_progress(auth.uid(),'Docente piloto','B2','{"version":1,"level":"B2"}',null);
do $$
begin
  begin
    perform public.fluentlab_teacher_roster();
    raise exception 'Un docente pudo leer el listado administrativo';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000002',false);
do $$
begin
  if not exists (select 1 from public.fluentlab_teacher_roster()
    where alias = 'Alumno piloto' and activities = 0 and "lastActivity" is null)
    or not exists (select 1 from public.fluentlab_teacher_roster()
    where alias = 'Alumno 2' and activities = 1 and "lastActivity" is not null)
    or exists (select 1 from public.fluentlab_teacher_roster() where alias = 'Docente piloto') then
    raise exception 'El listado no respeta el consentimiento o el rol de alumno';
  end if;
end;
$$;
reset role;
