/* Seguimiento local de misiones. El historial de 3.0 se conserva por separado. */
const AdaptiveLearning = (() => {
  const intervals = [1, 3, 7, 28];
  const modes = {free: 'Práctica libre', course: 'Curso evaluado'};
  const outcomes = {first: 'Acierto inicial', assisted: 'Acierto con ayuda', revealed: 'Solución explicada'};
  const mode = value => value === 'course' ? 'course' : 'free';
  const questionKey = (mission, variant, index) => mission.id + '/' + variant + '/' + index;

  function recordError(log, key, today) {
    const previous = log[key] || {};
    log[key] = {times: (Number(previous.times) || 0) + 1, last: today, resolved: null};
  }

  function recordRecovery(log, key, today) {
    const previous = log[key];
    if (previous && !previous.resolved) previous.resolved = today;
  }

  function countResults(responses) {
    const results = {first: 0, assisted: 0, revealed: 0};
    for (const response of responses) results[response.outcome]++;
    return results;
  }

  function recordCompletion(history, id, learningMode, results, writingSubmitted, today) {
    const entry = history[id] || {};
    const old = entry[learningMode] || {};
    history[id] = {
      ...entry,
      [learningMode]: {
        completed: (old.completed || 0) + 1,
        first: (old.first || 0) + results.first,
        assisted: (old.assisted || 0) + results.assisted,
        revealed: (old.revealed || 0) + results.revealed,
        written: (old.written || 0) + Number(writingSubmitted),
        lastDate: today
      }
    };
  }

  function summarize(history, learningMode) {
    const total = {completed: 0, first: 0, assisted: 0, revealed: 0, written: 0};
    for (const entry of Object.values(history)) {
      const bucket = entry?.[learningMode];
      for (const key of Object.keys(total)) total[key] += Number(bucket?.[key]) || 0;
    }
    return total;
  }

  function schedule(previous, result, today, dateAfter) {
    if (previous && previous.due > today) return previous;
    const clean = result.first === result.total;
    const oldStep = intervals.includes(previous?.interval) ? intervals.indexOf(previous.interval) : -1;
    const step = clean ? Math.min(oldStep + 1, intervals.length - 1) : 0;
    const interval = intervals[step];
    // La evidencia se obtiene en repasos vencidos, en ambos contextos de transferencia.
    const evidence = clean && previous && Array.isArray(previous.evidence)
      ? previous.evidence.filter(v => v === 0 || v === 1)
      : [];
    if (previous && clean && !evidence.includes(result.variant)) evidence.push(result.variant);
    const demonstratedOn = clean && oldStep === intervals.length - 1 && evidence.length === 2
      ? today
      : clean ? previous?.demonstratedOn || null : null;
    return {interval, due: dateAfter(interval), evidence, demonstratedOn};
  }

  return {modes, mode, outcomes, questionKey, recordError, recordRecovery, countResults, recordCompletion, summarize, schedule};
})();
