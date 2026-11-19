\set ON_ERROR_STOP on
\ir aula.sql
reset role;
\ir ../supabase_progress_sync.sql

set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
select revision as old_revision from public.learning_profiles \gset
select set_config('xanny.verify.revision', :'old_revision', false);
select public.xanny_sync_progress(auth.uid(),'Nuevo alias','C1',
  '{"version":1,"level":"C1","completed":{},"xp":25}', :'old_revision');

do $$
begin
  if (select revision from public.learning_profiles) = current_setting('xanny.verify.revision')::uuid then
    raise exception 'No avanzó la revisión';
  end if;
  begin
    perform public.xanny_sync_progress(auth.uid(),'Alias anterior','A1','{"version":1,"level":"A1"}',
      current_setting('xanny.verify.revision')::uuid);
    raise exception 'La revisión obsoleta sobrescribió el progreso';
  exception when serialization_failure then null;
  end;
  begin
    perform public.xanny_sync_progress(auth.uid(),'Alias','C1','{"version":1,"level":"C1","drafts":{"x":"Privado"}}',
      (select revision from public.learning_profiles));
    raise exception 'La copia admitió borradores';
  exception when check_violation then null;
  end;
end;
$$;
select public.xanny_account_deletion_request(auth.uid(),true);

select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',false);
do $$
begin
  if exists(select 1 from public.account_deletion_requests)
    or exists(select 1 from public.learning_profiles where id = '10000000-0000-0000-0000-000000000001') then
    raise exception 'Una cuenta pudo consultar datos de otra';
  end if;
  begin
    perform public.xanny_sync_progress('10000000-0000-0000-0000-000000000001','Ajeno','A1','{"version":1,"level":"A1"}',null);
    raise exception 'Una cuenta pudo sincronizar datos de otra';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.xanny_account_deletion_request('10000000-0000-0000-0000-000000000001',false);
    raise exception 'Una cuenta pudo cancelar la solicitud de otra';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
do $$
begin
  if has_function_privilege('anon','public.xanny_sync_progress(uuid,text,text,jsonb,uuid)','execute')
    or has_function_privilege('anon','public.xanny_account_deletion_request(uuid,boolean)','execute') then
    raise exception 'Las operaciones de cuenta son accesibles sin sesión';
  end if;
end;
$$;
