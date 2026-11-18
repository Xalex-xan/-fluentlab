/* Datos de estudio que pueden formar parte de una copia en la nube. */
const StudyProfile = (() => {
  const syncFields = [
    'version', 'level', 'xp', 'completed', 'wins', 'listeningDone', 'speakingDone',
    'writingDone', 'srs', 'reviewRewarded', 'days', 'placementHistory',
    'recentQuestions', 'errorLog', 'lastListen', 'missionHistory', 'missionSkills',
    'missionVariants', 'missionErrors', 'missionReviews', 'missionResults', 'missionTimeline'
  ];
  const eventKinds = new Set([
    'mission_started', 'lesson_started', 'mission_completed', 'lesson_completed',
    'listening_completed', 'mission_error', 'mission_skill'
  ]);
  const scoreKinds = new Set(['mission_completed', 'lesson_completed', 'listening_completed', 'mission_skill']);

  function snapshot(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
    return Object.fromEntries(syncFields.filter(field => Object.hasOwn(source, field))
      .map(field => [field, source[field]]));
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

  return {snapshot, event, addMissionSession};
})();
