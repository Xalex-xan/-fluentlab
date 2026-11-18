\set ON_ERROR_STOP on
\ir schema.sql
reset role;
\ir ../supabase_aula_33.sql

insert into auth.users values
  ('30000000-0000-0000-0000-000000000003'), -- segundo alumno
  ('40000000-0000-0000-0000-000000000004'), -- profesor de la clase
  ('50000000-0000-0000-0000-000000000005'); -- profesor de otra clase
insert into public.study_teachers values ('40000000-0000-0000-0000-000000000004'), ('50000000-0000-0000-0000-000000000005');

do $$
begin
  if has_function_privilege('anon', 'public.xanny_classroom_context()', 'EXECUTE')
    or has_function_privilege('anon', 'public.xanny_save_progress(text,text,jsonb,timestamptz)', 'EXECUTE')
    or has_table_privilege('authenticated','public.classroom_results','SELECT')
    or has_table_privilege('authenticated','public.learning_profiles','DELETE')
    or has_table_privilege('authenticated','public.study_teachers','INSERT') then
    raise exception 'Privilegio directo inesperado';
  end if;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', false);
select public.xanny_create_group('Clase de pruebas') as group_id \gset
select set_config('xanny.test.group', :'group_id', false);
select (public.xanny_classroom_context()->'groups'->0->>'invite') as invite_code \gset
select public.xanny_assign_mission(:'group_id', 'a2-delivery') as assignment \gset
select set_config('xanny.test.assignment', :'assignment', false);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
select public.xanny_join_group(:'invite_code', 'Alumno 1');
select public.xanny_analytics_consent(true);
insert into public.study_events (user_id, kind, module_id, score) values (auth.uid(), 'mission_completed', 'a2-delivery', 67);
select updated_at as original from public.learning_profiles \gset
select public.xanny_save_progress('Alumno 1','C1','{"version":1,"completed":{"a1-1":"2026-01-03"}}', :'original');
select set_config('xanny.test.original', :'original', false);

do $$
begin
  if (select level from public.learning_profiles) <> 'C1'
    or public.xanny_classroom_context()->'groups'->0->>'invite' is not null then
    raise exception 'Nivel C1 o visibilidad del código inválida';
  end if;
  begin
    perform public.xanny_create_group('Creación no autorizada');
    raise exception 'El alumno creó un grupo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.xanny_save_progress('Alumno 1','A1','{"version":1}', current_setting('xanny.test.original')::timestamptz);
    raise exception 'Se sobrescribió una copia modificada';
  exception when serialization_failure then null;
  end;
  begin
    perform public.xanny_classroom_report(current_setting('xanny.test.group')::uuid);
    raise exception 'El alumno leyó el informe de su clase';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select public.xanny_submit_result('60000000-0000-0000-0000-000000000006', :'assignment', 'course', 2::smallint, 1::smallint, 0::smallint, true, current_date);
select public.xanny_submit_result('60000000-0000-0000-0000-000000000006', :'assignment', 'course', 2::smallint, 1::smallint, 0::smallint, true, current_date);
do $$
begin
  begin
    perform public.xanny_submit_result('60000000-0000-0000-0000-000000000009',
      current_setting('xanny.test.assignment')::uuid, 'course', 2::smallint, 1::smallint, 0::smallint, false, current_date);
    raise exception 'El curso aceptó un resultado sin escritura';
  exception when check_violation then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', false);
do $$
begin
  if exists (select 1 from public.learning_profiles)
    or jsonb_array_length(public.xanny_classroom_context()->'groups') <> 0 then
    raise exception 'El alumno ajeno pudo ver datos';
  end if;
  begin
    perform public.xanny_submit_result('60000000-0000-0000-0000-000000000008',
      current_setting('xanny.test.assignment')::uuid, 'free', 3::smallint, 0::smallint, 0::smallint, false, current_date);
    raise exception 'El alumno ajeno envió un resultado';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.study_events(user_id,kind,module_id) values (auth.uid(),'mission_started','a2-delivery');
    raise exception 'Se registró actividad sin consentimiento';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select public.xanny_save_progress('Alumno 2','A2','{"version":1,"completed":{}}', null);
select public.xanny_join_group(:'invite_code', 'Alumno 2');
do $$
begin
  if (public.xanny_classroom_context()->'groups'->0->'assignments'->0->>'sent')::boolean then
    raise exception 'El segundo alumno vio la entrega del primero';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000005', false);
do $$
begin
  if jsonb_array_length(public.xanny_classroom_context()->'groups') <> 0 then
    raise exception 'El profesor ajeno pudo listar otro grupo';
  end if;
  begin
    perform public.xanny_assign_mission(current_setting('xanny.test.group')::uuid, 'b1-tech');
    raise exception 'El profesor ajeno pudo asignar';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.xanny_classroom_report(current_setting('xanny.test.group')::uuid);
    raise exception 'El profesor ajeno pudo leer el informe';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', false);
do $$
declare report jsonb := public.xanny_classroom_report(current_setting('xanny.test.group')::uuid);
begin
  if (report->>'members')::int <> 2 or (report->'totals'->>'completed')::int <> 1
    or (report->'totals'->>'attempts')::int <> 1 or (report->'totals'->>'assisted')::int <> 1
    or (report->>'pending')::int <> 1 or report->'skills'->0->>'skill' <> 'Resolver problemas'
    or exists (select 1 from public.learning_profiles) then
    raise exception 'El informe es incorrecto o se expuso progreso privado';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
select public.xanny_analytics_consent(false);
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', false);
do $$
declare overview jsonb := public.fluentlab_teacher_overview();
begin
  if (overview->>'accounts')::int <> 2 or (overview->>'active7d')::int <> 0
    or (public.xanny_classroom_report(current_setting('xanny.test.group')::uuid)->>'members')::int <> 2 then
    raise exception 'El administrador no recibió el resumen correcto';
  end if;
end;
$$;
