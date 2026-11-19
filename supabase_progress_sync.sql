-- Sincronización por revisión y solicitudes de baja. Aplicar después del Aula 3.3.
begin;

alter table public.learning_profiles add column revision uuid not null default gen_random_uuid();

create or replace function public.xanny_profile_timestamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  new.revision = gen_random_uuid();
  return new;
end;
$$;

create function public.xanny_sync_progress(
  p_account uuid, p_alias text, p_level text, p_snapshot jsonb, p_revision uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := xanny_private.require_user();
  saved public.learning_profiles;
begin
  if actor is distinct from p_account then
    raise exception 'La sesión pertenece a otra cuenta' using errcode = '42501';
  end if;
  if p_snapshot->>'level' is distinct from p_level then
    raise exception 'Nivel incompatible con el progreso' using errcode = '22023';
  end if;

  if p_revision is null then
    insert into public.learning_profiles(id, nickname, level, snapshot)
      values (actor, btrim(p_alias), p_level, p_snapshot)
      on conflict (id) do nothing returning * into saved;
  else
    update public.learning_profiles
      set nickname = btrim(p_alias), level = p_level, snapshot = p_snapshot
      where id = actor and revision = p_revision returning * into saved;
  end if;

  if saved.id is null then
    raise exception 'La copia cambió en otro dispositivo' using errcode = '40001';
  end if;
  return jsonb_build_object('nickname', saved.nickname, 'updated_at', saved.updated_at, 'revision', saved.revision);
end;
$$;

create table public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant select on public.account_deletion_requests to authenticated;
create policy own_deletion_request on public.account_deletion_requests for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.xanny_account_deletion_request(p_account uuid, p_requested boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := xanny_private.require_user();
begin
  if actor is distinct from p_account then
    raise exception 'La sesión pertenece a otra cuenta' using errcode = '42501';
  end if;
  if p_requested is null then
    raise exception 'Solicitud inválida' using errcode = '22023';
  end if;
  if p_requested then
    insert into public.account_deletion_requests(user_id) values (actor) on conflict (user_id) do nothing;
  else
    delete from public.account_deletion_requests where user_id = actor;
  end if;
  return p_requested;
end;
$$;

revoke all on function public.xanny_sync_progress(uuid,text,text,jsonb,uuid),
  public.xanny_account_deletion_request(uuid,boolean) from public, anon, authenticated;
grant execute on function public.xanny_sync_progress(uuid,text,text,jsonb,uuid),
  public.xanny_account_deletion_request(uuid,boolean) to authenticated;

commit;
