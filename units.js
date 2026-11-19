/* Controlador de unidades. El historial reutiliza la persistencia y los repasos existentes. */
const LearningUnits = (() => {
  const types = {
    vocabulary:['Vocabulario','cards'], grammar:['Gramática','book'],
    reading:['Lectura','book'], listening:['Escucha','headphones'],
    interaction:['Interacción','mic'], writing:['Escritura','pen'],
    review:['Repaso y transferencia','history'], assessment:['Evaluación','flag']
  };
  const keyOf = (unit, session) => unit.id + '/' + session.id;
  const normalize = value => String(value || '').normalize('NFKC').trim().toLowerCase().replace(/[.!?]$/, '');

  function create({getProgress, day, plusDays, shuffle, render, enter, save, activity, speak, esc, toast, words}) {
    let activeUnit;
    let run;
    const progress = () => getProgress();
    const icon = LearningUI.icon;
    const mascot = LearningUI.mascot;
    const completed = (unit, item) => Boolean(Object.values(progress().unitSessions[keyOf(unit, item)] || {})
      .some(entry => Number(entry?.completed) > 0));
    const count = unit => unit.sessions.filter(session => completed(unit, session)).length;
    const due = (unit, item) => progress().unitReviews[keyOf(unit, item)]?.due <= day();
    const strong = (label, data) => `<div><strong>${data}</strong><span>${label}</span></div>`;
    function focus(id) {
      document.getElementById(id)?.focus({preventScroll:true});
    }
    function refresh(id) {
      render();
      if (id) focus(id);
    }

    function unitSummary() {
      const plans = UNIT_DATA.flatMap(unit => unit.sessions.map(session => ({unit, session})));
      const pending = plans.filter(({unit, session}) => due(unit, session));
      const done = plans.filter(({unit, session}) => completed(unit, session)).length;
      return `<section class="card units-progress"><h2 class="section-h">Unidades de aprendizaje</h2><p>${done} de ${plans.length} sesiones finalizadas · ${pending.length} repasos pendientes</p><button class="button ghost sm" data-a="nav" data-id="units">Abrir unidades ${icon('arrow')}</button></section>`;
    }

    function catalogue() {
      const pending = UNIT_DATA.flatMap(unit => unit.sessions.filter(item => due(unit, item))
        .map(item => ({unit, item})));
      return `<header class="units-intro"><div><h1 class="page-title">Unidades de aprendizaje</h1><p>Ocho sesiones conectadas por una situación real. Practica, aplica lo aprendido y vuelve a repasarlo.</p></div>${mascot('welcome')}</header>
      ${pending.length ? `<section class="card unit-due"><h2 class="section-h">Repasos pendientes</h2><ul>${pending.map(({unit,item}) =>
        `<li><span><strong>${esc(item.name)}</strong><small>${unit.level} · ${esc(unit.name)}</small></span><button class="button ghost sm" data-a="unitSession" data-id="${unit.id}" data-session="${item.id}">Repasar ${icon('history')}</button></li>`).join('')}</ul></section>` : ''}
      <div class="unit-cards">${UNIT_DATA.map(unit => {
        const done = count(unit);
        return `<article class="card unit-card unit-card--${unit.level.toLowerCase()}"><div class="unit-card-top"><span class="unit-symbol">${icon(unit.icon)}</span><span class="unit-level">${unit.level}</span></div><h2>${esc(unit.name)}</h2><p>${esc(unit.description)}</p><div class="unit-card-foot"><span>${done} de ${unit.sessions.length} sesiones</span><button class="button primary" data-a="unitOpen" data-id="${unit.id}">${done ? 'Ver sesiones' : 'Explorar unidad'} ${icon('arrow')}</button></div></article>`;
      }).join('')}</div>`;
    }

    function openUnit(id) {
      activeUnit = UNIT_DATA.find(unit => unit.id === id);
      if (!activeUnit) return;
      run = null;
      enter('unit');
    }

    function overview() {
      if (!activeUnit) return catalogue();
      const unit = activeUnit;
      return `<button class="button ghost sm mb" data-a="nav" data-id="units">${icon('back')} Todas las unidades</button>
        <header class="units-intro"><div><span class="unit-level">${unit.level}</span><h1 class="page-title">${esc(unit.name)}</h1><p>${esc(unit.outcome)}</p></div><span class="unit-symbol">${icon(unit.icon)}</span></header>
        <ol class="unit-sessions">${unit.sessions.map((item, i) => {
          const done = completed(unit, item);
          const review = due(unit, item);
          const name = review ? 'Repasar' : done ? 'Practicar de nuevo' : 'Empezar sesión';
          const [label, glyph] = types[item.type];
          const state = review ? 'Repaso pendiente' : done ? 'Finalizada' : 'Por empezar';
          return `<li class="card unit-session-row"><span class="unit-symbol">${icon(glyph)}</span><div><span class="unit-session-type">Sesión ${i+1} · ${label}</span><h2>${esc(item.name)}</h2><p>${esc(item.goal)}</p><span class="unit-state">${done ? icon('check') : icon('clock')} ${state}</span></div><button class="button ${done ? 'ghost' : 'primary'}" data-a="unitSession" data-id="${unit.id}" data-session="${item.id}" aria-label="${name}: ${esc(item.name)}">${name} ${icon('arrow')}</button></li>`;
        }).join('')}</ol>`;
    }

    function openSession(id, sessionId) {
      const unit = UNIT_DATA.find(item => item.id === id);
      const session = unit?.sessions.find(item => item.id === sessionId);
      if (!session) return;
      activeUnit = unit;
      const key = keyOf(unit, session);
      const previous = progress().unitRecent[key] || [];
      const errors = progress().unitErrors;
      const reviewing = due(unit, session);
      const frequent = question => {
        const entry = errors[key + '/' + question.id];
        return entry && !entry.resolved ? Number(entry.times) || 0 : 0;
      };
      const pool = shuffle(session.questions).sort((a, b) =>
        (reviewing ? frequent(b) - frequent(a) : 0) ||
        Number(previous.includes(a.id)) - Number(previous.includes(b.id)));
      const selected = pool.slice(0, session.type === 'assessment' ? 4 : 3);
      progress().unitRecent[key] = selected.map(question => question.id);
      save();
      run = {
        session, key, questions: selected, order: selected.map(q => shuffle((q.options || q.parts || []).map((_,i)=>i))),
        stage:'activity', index:0, responses:[], attempts:0, selected:null, tokens:[], answer:'',
        help:false, transcript:false, transcriptUsed:false, glossary:false, model:false,
        role:AdaptiveLearning.mode(progress().learningMode), feedback:null
      };
      enter('unit');
      focus('unitPrompt');
    }

    function sourceBlock(session) {
      if (Array.isArray(session.source)) {
        return `<details class="card unit-source" ${run.glossary ? 'open' : ''} data-unit-disclosure="glossary"><summary>${icon('book')} Apuntes de la sesión</summary><dl>${session.source.map(([term, meaning, example]) =>
          `<div><dt>${esc(term)}</dt><dd>${esc(meaning)}<br><span lang="en">${esc(example)}</span></dd></div>`).join('')}</dl></details>`;
      }
      const doc = session.source;
      if (session.type === 'listening') {
        return `<section class="card unit-source"><h2>${esc(doc.title)}</h2><div class="button-group"><button class="button primary" data-a="unitAudio">${icon('voice')} Reproducir audio</button><button class="button ghost" data-a="unitAudioSlow">Escuchar despacio</button><button class="button ghost" data-a="unitTranscript" id="unitTranscriptButton" aria-controls="unitTranscript" aria-expanded="${run.transcript}">Transcripción</button></div><p id="unitTranscript" lang="en" ${run.transcript ? '' : 'hidden'}>${esc(doc.text)}</p></section>`;
      }
      return `<section class="card unit-source"><h2 lang="en">${esc(doc.title)}</h2><p lang="en">${esc(doc.text)}</p></section>`;
    }

    function unitDraft() {
      return typeof progress().unitDrafts[run.key] === 'string' ? progress().unitDrafts[run.key] : '';
    }

    function writingBlock(session) {
      const writing = session.writing;
      const required = run.role === 'course';
      return `<section class="card unit-activity"><h2 id="unitPrompt" tabindex="-1">Tu respuesta escrita</h2><p>${esc(writing.prompt)}</p><p id="unitWritingHelp">${required ? 'Curso evaluado. Entrega al menos ocho palabras.' : 'Puedes practicar con un borrador o finalizar sin entregar.'} El texto se queda en este navegador.</p><label class="label-input" for="unitDraft">Escribe en inglés</label><textarea id="unitDraft" class="field unit-draft" aria-describedby="unitWritingHelp unitWritingError" maxlength="5000" ${required ? 'required' : ''}>${esc(unitDraft())}</textarea><p id="unitWritingError" role="alert"></p><div class="button-group"><button class="button ghost" id="unitModel" data-a="unitModel" aria-expanded="${run.model}" aria-controls="unitWritingModel">Comparar con un ejemplo</button><button class="button primary" data-a="unitFinish">Finalizar sesión ${icon('check')}</button></div><div id="unitWritingModel" class="info-note mt" ${run.model ? '' : 'hidden'}><h3>Modelo y criterios</h3><p lang="en">${esc(writing.model)}</p><ul>${writing.criteria.map(item => `<li>${esc(item)}</li>`).join('')}</ul><p>La entrega se registra sin calificación lingüística.</p></div></section>`;
    }

    function answers(q) {
      if (q.type === 'word') return `<label class="label-input" for="unitShort">Respuesta de una palabra</label><input id="unitShort" type="text" class="field" autocomplete="off" spellcheck="false" maxlength="80" lang="en" value="${esc(run.answer)}" ${run.solved ? 'disabled' : ''}>`;
      const order = run.order[run.index];
      if (q.type === 'order') {
        return `<p id="unitSequenceTitle">Tu secuencia</p><ol class="unit-token-answer" aria-labelledby="unitSequenceTitle" lang="en">${run.tokens.map(i => `<li>${esc(q.parts[i])}</li>`).join('')}</ol>
          <div class="unit-tokens" role="group" aria-label="Fragmentos de la frase">${order.map(i => `<button class="button ghost" id="unitToken-${i}" type="button" data-a="unitToken" data-index="${i}" lang="en" ${run.solved || run.tokens.includes(i) ? 'disabled' : ''}>${esc(q.parts[i])}</button>`).join('')}</div><button class="button ghost sm mt" id="unitUndo" data-a="unitUndo" ${run.solved || !run.tokens.length ? 'disabled' : ''}>Quitar último fragmento</button>`;
      }
      return `<div class="unit-options" role="group" aria-label="Opciones de respuesta">${order.map(i => `<button class="unit-option" id="unitOption-${i}" data-a="unitOption" data-index="${i}" lang="en" aria-pressed="${run.selected===i}" ${run.solved ? 'disabled' : ''}>${esc(q.options[i])}</button>`).join('')}</div>`;
    }

    function feedback(q) {
      const outcome = run.feedback;
      if (!outcome) return '';
      if (outcome === 'help' || outcome === 'retry') {
        return `<div class="unit-feedback unit-feedback--help" id="unitFeedback" role="status" tabindex="-1">${mascot(outcome)}<div><strong>${outcome === 'retry' ? 'Inténtalo una vez más' : 'Pista de Xanny'}</strong><p>${esc(q.hint)}</p></div></div>`;
      }
      const solution = q.type === 'word' ? q.answers.join(' / ') : q.type === 'order' ? q.parts.join(' ') : q.answer;
      return `<div class="unit-feedback unit-feedback--${outcome === 'revealed' ? 'review' : 'right'}" id="unitFeedback" role="status" tabindex="-1">${mascot(outcome === 'revealed' ? 'retry' : 'success')}<div><strong>${AdaptiveLearning.outcomes[outcome]}</strong><p lang="en">${esc(solution)}</p><p>${esc(q.explanation)}</p></div></div>`;
    }

    function activityBlock() {
      const q = run.questions[run.index];
      return `<section class="card unit-activity"><div class="unit-question-progress"><span>Pregunta ${run.index+1} de ${run.questions.length}</span><progress max="${run.questions.length}" value="${run.index + Number(Boolean(run.solved))}" aria-label="Preguntas resueltas"></progress></div><h2 id="unitPrompt" tabindex="-1" lang="${/^(Ordena|Escribe)/.test(q.prompt) ? 'es' : 'en'}">${esc(q.prompt)}</h2>${answers(q)}${feedback(q)}
        <div class="button-group mt">${run.solved ? `<button class="button primary" data-a="unitNext">${run.index+1 === run.questions.length ? 'Continuar' : 'Siguiente pregunta'} ${icon('arrow')}</button>` :
        `<button class="button primary" id="unitCheck" data-a="unitCheck">Comprobar respuesta ${icon('check')}</button><button class="button ghost" data-a="unitHint">${icon('light')} Pedir una pista</button>`}</div></section>`;
    }

    function doneBlock() {
      const result = run.results;
      const next = activeUnit.sessions[activeUnit.sessions.indexOf(run.session)+1];
      return `<section class="card unit-summary" role="region" aria-labelledby="unitPrompt">${mascot(run.finishedUnit ? 'finish' : 'success')}<div><h2 id="unitPrompt" tabindex="-1">${run.finishedUnit ? 'Unidad completada' : 'Sesión finalizada'}</h2><p>Tu resultado y la fecha de repaso quedan guardados.</p><div class="unit-outcomes">${strong('Primer intento',result.first)}${strong('Con ayuda',result.assisted)}${strong('Solución explicada',result.revealed)}</div>${run.session.writing ? `<p>${run.written ? 'Respuesta escrita entregada, sin calificación lingüística.' : 'Sin entrega escrita en esta sesión.'}</p>` : ''}<p>Próximo repaso <time datetime="${esc(run.nextDue)}">${esc(run.nextDue)}</time></p><div class="button-group"><button class="button ghost" data-a="unitOpen" data-id="${activeUnit.id}">Ver sesiones</button>${next ? `<button class="button primary" data-a="unitSession" data-id="${activeUnit.id}" data-session="${next.id}">Siguiente sesión ${icon('arrow')}</button>` : ''}</div></div></section>`;
    }

    function detail() {
      if (!run) return overview();
      const item = run.session;
      const base = `<button class="button ghost sm mb" data-a="unitOpen" data-id="${activeUnit.id}">${icon('back')} Volver a las sesiones</button><header class="unit-page-label"><div><span class="unit-session-type">${activeUnit.level} · ${types[item.type][0]} · ${AdaptiveLearning.modes[run.role]}</span><h1 class="page-title">${esc(item.name)}</h1><p>${esc(item.goal)}</p></div><span class="unit-symbol">${icon(types[item.type][1])}</span></header>`;
      if (run.stage === 'done') return base + doneBlock();
      if (run.stage === 'writing') return base + writingBlock(item);
      return base + `<div class="unit-layout">${sourceBlock(item)}${activityBlock()}</div>`;
    }

    function attempt() {
      if (run.solved) return;
      const q = run.questions[run.index];
      let correct;
      if (q.type === 'choice') {
        if (run.selected === null) return toast('Selecciona una opción.');
        correct = q.options[run.selected] === q.answer;
      } else if (q.type === 'word') {
        if (!normalize(run.answer)) { focus('unitShort'); return toast('Escribe tu respuesta.'); }
        correct = q.answers.some(word => word === normalize(run.answer));
      } else {
        if (run.tokens.length !== q.parts.length) return toast('Coloca todos los fragmentos.');
        correct = run.tokens.every((token, position) => token === position);
      }
      const key = run.key + '/' + q.id;
      if (!correct && run.attempts === 0) {
        run.attempts++;
        run.help = true;
        run.feedback = 'retry';
        run.selected = null;
        run.tokens = [];
        AdaptiveLearning.recordError(progress().unitErrors, key, day());
        save();
        refresh('unitFeedback');
        return;
      }
      const outcome = correct ? run.help || run.transcriptUsed ? 'assisted' : 'first' : 'revealed';
      if (outcome === 'first') {
        AdaptiveLearning.recordRecovery(progress().unitErrors, key, day());
        save();
      }
      run.responses.push({outcome});
      run.solved = true;
      run.feedback = outcome;
      refresh('unitFeedback');
    }

    function finish() {
      if (run.stage === 'done' || run.responses.length !== run.questions.length) return;
      const written = run.stage === 'writing' && words(unitDraft()).length >= 8;
      if (run.stage === 'writing' && run.role === 'course' && !written) {
        const notice = document.getElementById('unitWritingError');
        if (notice) notice.textContent = 'Escribe al menos ocho palabras para entregar tu respuesta.';
        focus('unitDraft');
        return;
      }
      const previousCount = count(activeUnit);
      const result = AdaptiveLearning.countResults(run.responses);
      const date = day();
      const previous = progress().unitReviews[run.key];
      const schedule = AdaptiveLearning.schedule(previous, {first:result.first,total:run.responses.length,variant:0}, date, plusDays);
      progress().unitReviews[run.key] = {interval:schedule.interval,due:schedule.due};
      AdaptiveLearning.recordCompletion(progress().unitSessions, run.key, run.role, result, written, date);
      run.results = result;
      run.nextDue = schedule.due;
      run.written = written;
      run.stage = 'done';
      run.finishedUnit = previousCount < activeUnit.sessions.length && count(activeUnit) === activeUnit.sessions.length;
      activity(result.first * 4 + result.assisted * 2);
      refresh('unitPrompt');
    }

    function next() {
      if (!run.solved) return;
      if (run.index + 1 === run.questions.length) {
        if (run.session.writing) {run.stage = 'writing'; refresh('unitPrompt');}
        else finish();
        return;
      }
      Object.assign(run, {index:run.index+1, selected:null, tokens:[], answer:'', attempts:0,
        help:false, solved:false, feedback:null, transcriptUsed:run.transcript});
      refresh('unitPrompt');
    }

    function action(name, {id, session, index}) {
      if (name === 'unitOpen') return openUnit(id);
      if (name === 'unitSession') return openSession(id, session);
      if (!run) return;
      const q = run.questions[run.index];
      const i = Number(index);
      switch (name) {
        case 'unitAudio': case 'unitAudioSlow': if(run.session.type==='listening')speak(run.session.source.text, name==='unitAudioSlow' ? .72 : .92); break;
        case 'unitTranscript':
          if (run.session.type !== 'listening') break;
          run.transcript = !run.transcript;
          if (run.transcript && !run.solved) run.transcriptUsed = true;
          refresh('unitTranscriptButton');
          break;
        case 'unitOption':
          if (!run.solved && q.options?.[i]) {run.selected = i; refresh('unitOption-'+i);}
          break;
        case 'unitToken':
          if (!run.solved && q.parts?.[i] && !run.tokens.includes(i)) {
            run.tokens.push(i);
            const remaining = run.order[run.index].find(value=>!run.tokens.includes(value));
            refresh(remaining === undefined ? 'unitCheck' : 'unitToken-'+remaining);
          }
          break;
        case 'unitUndo': if (!run.solved) {const last = run.tokens.pop(); refresh('unitToken-'+last);} break;
        case 'unitHint': if(!run.solved) {run.help = true; run.feedback = 'help'; refresh('unitFeedback');} break;
        case 'unitCheck': if(run.stage==='activity') attempt(); break;
        case 'unitNext': if(run.stage==='activity') next(); break;
        case 'unitFinish': if(run.stage==='writing') finish(); break;
        case 'unitModel': if(run.stage==='writing'){run.model = !run.model;refresh('unitModel');} break;
      }
    }

    function input(id, value) {
      if (!run) return;
      if (id === 'unitShort') run.answer = value;
      if (id === 'unitDraft') {
        progress().unitDrafts[run.key] = value.slice(0,5000);
        save();
        const notice = document.getElementById('unitWritingError');
        if (notice) notice.textContent = '';
      }
    }

    return {catalogue, detail, unitSummary, action, input,
      disclosure: open => {if(run)run.glossary = open;},
      clear: () => {activeUnit = null; run = null;}};
  }

  return {create};
})();
