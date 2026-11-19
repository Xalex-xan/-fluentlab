/* Datos de estudio que pueden formar parte de una copia en la nube. */
const StudyProfile = (() => {
  // C2 puede añadirse cuando exista contenido y su entrada en study_levels.
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const eventKinds = new Set([
    'mission_started', 'lesson_started', 'mission_completed', 'lesson_completed',
    'listening_completed', 'mission_error', 'mission_skill'
  ]);
  const scoreKinds = new Set(['mission_completed', 'lesson_completed', 'listening_completed', 'mission_skill']);

  const mapKeys = [
    'completed', 'lessonResults', 'wins', 'listeningDone', 'speakingDone', 'writingDone', 'srs',
    'reviewRewarded', 'days', 'recentQuestions', 'errorLog', 'lastListen',
    'missionHistory', 'missionSkills', 'missionVariants', 'missionErrors', 'missionReviews', 'missionResults'
  ];
  const awarded = new Set(['completed','wins','listeningDone','speakingDone','writingDone','reviewRewarded']);
  const record = v => v && typeof v === 'object' && !Array.isArray(v);
  const number = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100000000;
  const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const id = v => typeof v === 'string' && /^[a-z0-9][a-z0-9/:-]{0,90}$/.test(v);
  const variant = v => v === 0 || v === 1;
  const mode = v => v === 'free' || v === 'course';
  const skills = new Set([
    'Resolver problemas', 'Interacción natural', 'Empatía y servicio',
    'Comunicación profesional', 'Colaboración', 'Negociación', 'Argumentación', 'Pensamiento crítico'
  ]);
  const schema = {
    srs: {interval:number, reps:number, ease:number, due:date, last:date},
    missionHistory: {plays:number, totalQuestions:number, totalFirst:number,
      lastVariant:variant, lastDate:date, lastAccuracy:number},
    missionSkills: {first:number, questions:number},
    lessonResults: {sessions:number, first:number, assisted:number, revealed:number, lastDate:date},
    errorLog: {times:number, last:date, resolved:v => v === null || date(v)},
    missionReviews: {interval:number, due:date, evidence:v => Array.isArray(v) && v.length <= 2 && v.every(variant),
      demonstratedOn:v => v === null || date(v)},
    result: {completed:number, first:number, assisted:number, revealed:number, written:number, lastDate:date},
    timeline: {missionId:id, mode, first:number, assisted:number, revealed:number, written:v => typeof v === 'boolean', date},
    placement: {level:v => levels.includes(v), date, score:number, correct:number, total:number}
  };

  function pick(value, fields) {
    if (!record(value)) return null;
    const pairs = Object.entries(fields).filter(([key, valid]) => valid(value[key]))
      .map(([key]) => [key, value[key]]);
    return pairs.length ? Object.fromEntries(pairs) : null;
  }

  function sanitizeMap(field, value) {
    if (!record(value)) return {};
    return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
      const validKey = field === 'missionSkills' ? skills.has(key) : field === 'days' ? date(key) : id(key);
      if (!validKey) return [];
      let safe;
      if (awarded.has(field)) safe = date(entry) || entry === true ? entry : undefined;
      else if (field === 'days' || field === 'lastListen') safe = number(entry) ? entry : undefined;
      else if (field === 'missionVariants') safe = variant(entry) ? entry : undefined;
      else if (field === 'recentQuestions') safe = Array.isArray(entry) ? entry.filter(id).slice(0, 12) : undefined;
      else if (field === 'missionResults') safe = Object.fromEntries(['free','course'].flatMap(name => {
        const result = pick(entry?.[name], schema.result);
        return result ? [[name, result]] : [];
      }));
      else safe = pick(entry, schema[field === 'missionErrors' ? 'errorLog' : field]);
      return safe == null ? [] : [[key, safe]];
    }));
  }

  function snapshot(source) {
    if (!record(source)) return null;
    const safe = {};
    if (source.version === 1) safe.version = 1;
    if (levels.includes(source.level)) safe.level = source.level;
    if (number(source.xp)) safe.xp = source.xp;
    for (const field of mapKeys) {
      if (Object.hasOwn(source, field)) safe[field] = sanitizeMap(field, source[field]);
    }
    if (Array.isArray(source.placementHistory)) {
      safe.placementHistory = source.placementHistory.map(v => pick(v, schema.placement)).filter(Boolean).slice(-100);
    }
    if (Array.isArray(source.missionTimeline)) {
      safe.missionTimeline = source.missionTimeline.map(v => pick(v, schema.timeline))
        .filter(v => v?.missionId && v.date && v.mode).slice(-40);
    }
    return safe;
  }

  function preferEntry(field, local, guest) {
    if (local == null) return guest;
    if (guest == null) return local;
    if (field === 'days') return Math.max(local, guest);
    if (awarded.has(field)) return date(local) && (!date(guest) || local > guest) ? local : guest;
    if (field === 'missionHistory') return local.plays >= guest.plays ? local : guest;
    if (field === 'missionResults') {
      return Object.fromEntries(['free','course'].flatMap(mode => {
        const a = local[mode], b = guest[mode];
        return a || b ? [[mode, (a?.completed || 0) >= (b?.completed || 0) ? a || b : b]] : [];
      }));
    }
    if (field === 'lessonResults') return (local.sessions || 0) >= (guest.sessions || 0) ? local : guest;
    if (field === 'missionSkills') return (local.questions || 0) >= (guest.questions || 0) ? local : guest;
    if (field === 'errorLog' || field === 'missionErrors') {
      const recent = (local.last || '') >= (guest.last || '') ? local : guest;
      return {...recent, times: Math.max(local.times || 0, guest.times || 0)};
    }
    if (field === 'srs') return (local.last || '') >= (guest.last || '') ? local : guest;
    if (field === 'missionReviews') return (local.due || '') <= (guest.due || '') ? local : guest;
    return local;
  }

  function combine(account, guest) {
    const a = snapshot(account), b = snapshot(guest);
    const value = {...b, ...a, xp: Math.max(a.xp || 0, b.xp || 0)};
    for (const field of mapKeys) {
      if (!a[field] && !b[field]) continue;
      const keys = new Set([...Object.keys(a[field] || {}), ...Object.keys(b[field] || {})]);
      value[field] = Object.fromEntries([...keys].map(key => [key, preferEntry(field, a[field]?.[key], b[field]?.[key])]));
    }
    for (const field of ['missionTimeline', 'placementHistory']) {
      if (!a[field] && !b[field]) continue;
      const pairs = new Map([...(b[field] || []), ...(a[field] || [])].map(item => [JSON.stringify(item), item]));
      value[field] = [...pairs.values()].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        .slice(field === 'missionTimeline' ? -40 : -100);
    }
    return value;
  }

  function event(kind, moduleId, score) {
    if (!eventKinds.has(kind) || typeof moduleId !== 'string' || !/^[a-z0-9][a-z0-9/-]{0,79}$/.test(moduleId)) return null;
    if (scoreKinds.has(kind) && (!Number.isFinite(score) || score < 0 || score > 100)) return null;
    return {kind, module_id: moduleId, score: scoreKinds.has(kind) ? Math.round(score) : null};
  }

  function addMissionSession(timeline, missionId, mode, results, written, date) {
    const entry = {missionId, mode, first: results.first, assisted: results.assisted,
      revealed: results.revealed, written, date};
    return [...timeline.slice(-39), entry];
  }

  return {levels: Object.freeze(levels), snapshot, combine, event, addMissionSession};
})();
