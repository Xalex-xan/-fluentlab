-- Cambio aditivo del piloto, posterior a la sincronización y al hook.
begin;

-- El cliente usa xanny_sync_progress con revisión UUID.
revoke execute on function public.xanny_save_progress(text,text,jsonb,timestamptz)
  from public, anon, authenticated;

-- Mismo conjunto de claves principales que StudyProfile.snapshot. El cliente
-- además filtra los valores internos. Las filas históricas se conservan.
alter table public.learning_profiles add constraint learning_profiles_pilot_snapshot_fields
  check (snapshot - array[
    'version','level','xp','completed','lessonResults','wins','listeningDone',
    'speakingDone','writingDone','srs','reviewRewarded','days','recentQuestions',
    'errorLog','lastListen','missionHistory','missionSkills','missionVariants','missionErrors',
    'missionReviews','missionResults','unitRecent','unitErrors','unitReviews','unitSessions',
    'placementHistory','missionTimeline'
  ] = '{}'::jsonb) not valid;

create or replace function public.fluentlab_teacher_roster()
  returns table (alias text, level text, activities bigint, "lastActivity" timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if xanny_private.education_role(xanny_private.require_user()) <> 'admin' then
    raise exception 'Acceso restringido' using errcode = '42501';
  end if;
  return query
    select p.nickname, p.level, e.activities, e.last_activity
    from public.learning_profiles p
    cross join lateral (
      select count(*) as activities, max(s.created_at) as last_activity
      from public.study_events s
      join public.study_analytics_preferences a on a.user_id = s.user_id and a.enabled
      where s.user_id = p.id
    ) e
    where xanny_private.education_role(p.id) = 'student'
    order by p.updated_at desc
    limit 200;
end;
$$;

commit;
