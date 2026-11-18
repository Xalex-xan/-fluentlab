const {readFileSync, existsSync} = require('node:fs');
const {join} = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const files = Object.fromEntries([
  'index.html', 'manifest.webmanifest', 'data.js', 'question-bank.js', 'mission-transfer.js',
  'missions-data.js', 'adaptive.js', 'study-profile.js', 'cloud-config.js', 'cloud.js', 'app.js', 'sw.js'
].map(path => [path, readFileSync(join(__dirname, '..', path), 'utf8')]));
const exists = path => existsSync(join(__dirname, '..', path));

function createTest(files, oldProgress) {
  const app={innerHTML:''}, events={}, windowEvents={}, fields={};
  const active=new Map();
  if(oldProgress)active.set('fluentlab_v1',JSON.stringify(oldProgress));
  const localStorage={getItem:k=>active.get(k)??null,setItem:(k,v)=>active.set(k,v),removeItem:k=>active.delete(k)};
  const location={search:'',hash:'',protocol:'https:',origin:'https://xalex-xan.github.io',pathname:'/-fluentlab/'};
  const document={
    addEventListener:(type,fn)=>(events[type]??=[]).push(fn),
    body:{classList:{toggle(){}},append(){}},head:{append(){}},
    getElementById:id=>id==='app'?app:fields[id] || null,querySelector:()=>null,
    createElement:()=>({setAttribute(){},remove(){}})
  };
  const window={scrollTo(){},addEventListener:(type,fn)=>windowEvents[type]=fn};
  const run=Function('window','document','location','navigator','localStorage','setTimeout','URLSearchParams',
    files["data.js"]+'\n'+files["question-bank.js"]+'\n'+files["mission-transfer.js"]+'\n'+files["missions-data.js"]+'\n'+files["adaptive.js"]+'\n'+files["study-profile.js"]+'\n'+files["cloud-config.js"]+'\n'+files["cloud.js"]+'\nconst XannyCloud=window.XannyCloud;\n'+files["app.js"]+'\nreturn {DATA,MISSIONS,FLUENTLAB_EXTRA,FLUENTLAB_LISTEN_EXTRA,AdaptiveLearning,StudyProfile,cloud:window.XannyCloud};');
  const data=run(window,document,location,{},localStorage,()=>{},class {has(){return false}});
  return {...data,app,click:(a,d={})=>events.click.forEach(fn=>fn({target:{closest:()=>({dataset:{a,...d}})}})),
    input:(id,value)=>events.input.forEach(fn=>fn({target:{id,value}})),navigate:(hash)=>{location.hash='#'+hash;windowEvents.hashchange();},
    change:(id,value)=>events.change.forEach(fn=>fn({target:{id,value}})), fields, stored:()=>JSON.parse(active.get('fluentlab_v1')||'null')};
}
test('las 16 misiones completan sus 32 variantes con tres decisiones y tres resultados distintos', () => {
  const definitions = createTest(files).MISSIONS;
  assert.equal(definitions.length, 16);
  assert.equal(new Set(definitions.map(m => m.id)).size, 16);

  for (const m of definitions) {
    const old = {plays: 1, totalQuestions: 2, totalFirst: 1, lastVariant: 1};
    const app = createTest(files, {missionHistory: {[m.id]: old}});
    const start = () => app.click('openMission', {id: m.id});
    const select = index => {
      app.click('missionChoice', {index});
      app.click('missionCheck');
    };
    for (const [variantIndex, variant] of m.variants.entries()) {
      assert.equal(m.variants.length, 2);
      assert.equal(variant.questions.length, 3);
      start();
      assert.equal(app.stored().missionVariants[m.id], variantIndex);
      assert.ok(app.app.innerHTML.includes(variant.context.slice(0, 24)));
      for (const [i, q] of variant.questions.entries()) {
        assert.ok(q.why && q.hint && q.example && q.translation);
        assert.equal(q.details.length, q.choices.length);
        assert.ok(q.details.every(Boolean));
        if (i === 2) {
          assert.notEqual(q.context, variant.context);
          assert.ok(q.context && app.app.innerHTML.includes('NUEVO CONTEXTO'));
        }
        const wrong = q.choices.map((_, choice) => choice).filter(choice => choice !== q.answer);
        if (i > 0) {
          select(wrong[0]);
          assert.ok(app.app.innerHTML.includes('Prueba una vez más'));
          assert.ok(app.app.innerHTML.includes('Pista.'));
          assert.equal(app.stored().missionErrors[[m.id, variantIndex, i].join('/')].times, 1);
        }
        select(i === 2 ? wrong[1] : q.answer);
        assert.equal((app.app.innerHTML.match(/<li>/g) || []).length, q.choices.length);
        assert.ok(app.app.innerHTML.includes('Escuchar ejemplo'));
        app.click('missionNext');
      }
      app.click('missionModel');
      assert.ok(app.app.innerHTML.includes('Criterios de autoevaluación'));
      app.click('missionFinish');
      assert.ok(app.app.innerHTML.includes('Misión finalizada'));
      const p = app.stored();
      const numbers = p.missionResults[m.id].free;
      for (const key of ['completed', 'first', 'assisted', 'revealed']) assert.equal(numbers[key], variantIndex + 1);
      assert.equal(numbers.written, 0);
      assert.equal(p.missionHistory[m.id].totalQuestions, old.totalQuestions + 3 * (variantIndex + 1));
      assert.equal(p.missionReviews[m.id].interval, 1);
      assert.equal(p.missionReviews[m.id].demonstratedOn, null);
    }
    app.click('nav', {id: 'errors'});
    assert.ok(app.app.innerHTML.includes('Errores en misiones') && app.app.innerHTML.includes('1 fallo'));
  }
});

test('el curso exige escritura y mantiene el progreso y los borradores de 3.0', () => {
  const legacy = {version: 1, xp: 30, level: 'B1', theme: 'light', goal: 2, accent: 'en-GB',
    completed: {'a1-1': '2025-01-01'}, srs: {v1: {interval: 5, due: '2025-01-01'}},
    drafts: {w1: 'my saved draft'}, errorLog: {'a1-1/original-0': {times: 2, resolved: null}},
    missionHistory: {'a2-delivery': {plays: 2, totalQuestions: 4, totalFirst: 3, lastVariant: 1}}};
  const app = createTest(files, legacy);
  app.change('learningMode', 'course');
  app.click('openMission', {id: 'a2-delivery'});
  assert.equal(app.stored().missionVariants['a2-delivery'], 0);
  for (const q of app.MISSIONS[0].variants[0].questions) {
    app.click('missionChoice', {index: q.answer});
    app.click('missionCheck');
    app.click('missionNext');
  }
  app.fields.missionWriteStatus = {};
  app.input('missionWrite', '   ');
  app.click('missionFinish');
  assert.match(app.fields.missionWriteStatus.textContent, /al menos tres palabras/);
  assert.equal(app.stored().missionHistory['a2-delivery'].plays, 2);
  app.input('missionWrite', 'Could you check the delivery record?');
  app.click('missionFinish');
  assert.ok(app.app.innerHTML.includes('sin calificación lingüística'));
  const updated = app.stored();
  for (const key of ['completed', 'srs', 'drafts', 'errorLog', 'theme', 'goal', 'accent']) {
    assert.deepEqual(updated[key], legacy[key]);
  }
  assert.equal(updated.missionDrafts['a2-delivery'], 'Could you check the delivery record?');
  assert.equal(updated.missionResults['a2-delivery'].course.written, 1);
  assert.equal(updated.missionResults['a2-delivery'].course.first, 3);
  assert.equal(updated.missionResults['a2-delivery'].free, undefined);
  const reloaded = createTest(files, updated);
  reloaded.click('nav', {id: 'missions'});
  assert.ok(reloaded.app.innerHTML.includes('value="course" selected'));
  reloaded.click('openMission', {id: 'a2-delivery'});
  assert.equal(reloaded.stored().missionVariants['a2-delivery'], 1);
});

test('el calendario avanza a 1, 3, 7 y 28 días, y exige evidencia diferida', () => {
  const {schedule} = createTest(files).AdaptiveLearning;
  const clean = {first: 3, total: 3, variant: 0};
  const dates = ['2026-01-01', '2026-01-02', '2026-01-05', '2026-01-12', '2026-02-09'];
  const intervals = [1, 3, 7, 28, 28];
  let review;
  for (const [i, today] of dates.entries()) {
    review = schedule(review, {...clean, variant: i % 2}, today, n => {
      const date = new Date(today + 'T12:00:00Z');
      date.setUTCDate(date.getUTCDate() + n);
      return date.toISOString().slice(0, 10);
    });
    assert.equal(review.interval, intervals[i]);
    assert.equal(review.demonstratedOn, i === 4 ? today : null);
    if (dates[i + 1]) assert.equal(review.due, dates[i + 1]);
  }
  assert.strictEqual(schedule(review, clean, '2026-02-10', () => null), review);
  const retry = schedule(review, {...clean, first: 2}, review.due, () => '2026-03-10');
  assert.equal(retry.interval, 1);
  assert.equal(retry.demonstratedOn, null);
  assert.deepEqual(retry.evidence, []);
});

test('carga todo el catálogo, las rutas y las configuraciones públicas', () => {
  const app = createTest(files);
  assert.equal(app.DATA.lessons.length, 24);
  assert.equal(app.DATA.vocabulary.length, 80);
  assert.equal(app.DATA.listening.length, 12);
  assert.equal(app.DATA.speaking.length, 16);
  assert.equal(app.DATA.writing.length, 8);
  const sections = ['home','missions','path','listen','speak','cards','errors','progress','account','grammar','write','resources','settings','diagnostic'];
  for (const id of sections) {
    app.click('nav', {id});
    assert.ok(app.app.innerHTML.includes('<h1'), id);
    const mobile = app.app.innerHTML.split('aria-label="Navegación móvil"')[1];
    assert.ok(mobile.includes('data-id="' + id + '"'), id + ' en móvil');
  }
  for (const [path, source] of Object.entries(files)) if (path.endsWith('.js')) new Function(source);
  const urls = [...files['index.html'].matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
  const manifest = JSON.parse(files['manifest.webmanifest']);
  for (const url of [...urls, ...manifest.icons.map(icon => icon.src), manifest.start_url]) {
    assert.ok(!url.startsWith('/'));
    assert.ok(exists(url.split('?')[0].replace(/^\.\//, '')), url);
  }
  assert.match(files['cloud-config.js'], /supabaseUrl:\s*''/);
  assert.match(files['cloud-config.js'], /publishableKey:\s*''/);
  assert.match(files['cloud-config.js'], /cloudflareToken:\s*''/);
});

test('la práctica libre permite consultar soluciones sin registrar errores', () => {
  const app = createTest(files);
  app.click('openMission', {id: 'a2-delivery'});
  for (let i = 0; i < 3; i++) {
    assert.ok(app.app.innerHTML.includes('Ver solución sin responder'));
    app.click('missionReveal');
    assert.ok(app.app.innerHTML.includes('Solución explicada'));
    app.click('missionNext');
  }
  app.click('missionFinish');
  const p = app.stored();
  assert.deepEqual(p.missionErrors, {});
  assert.equal(p.missionResults['a2-delivery'].free.revealed, 3);
  assert.equal(p.missionResults['a2-delivery'].free.first, 0);
  assert.equal(p.missionReviews['a2-delivery'].demonstratedOn, null);
});

test('la marca, el alcance y los iconos de la PWA corresponden a Xanny', () => {
  const app = createTest(files);
  assert.match(app.app.innerHTML, /<h1>Aprende con <em>Xanny<\/em><\/h1>/);
  assert.match(app.app.innerHTML, /<figcaption>Xanny<\/figcaption>/);
  assert.doesNotMatch(app.app.innerHTML, /FluentLab/i);
  const manifest = JSON.parse(files['manifest.webmanifest']);
  assert.equal(manifest.name, 'Aprende con Xanny');
  assert.equal(manifest.short_name, 'Xanny');
  assert.equal(manifest.id, './index.html');
  assert.equal(manifest.scope, './');
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
});

test('la nube se activa por servicio y las copias excluyen datos locales', () => {
  const app = createTest(files);
  assert.equal(app.cloud.available(), false);
  assert.equal(app.cloud.studyAnalyticsAvailable(), false);
  assert.equal(app.cloud.visitorAnalyticsAvailable(), false);
  app.click('nav', {id: 'account'});
  assert.match(app.app.innerHTML, /Próximamente/);
  assert.match(app.app.innerHTML, /La sincronización en la nube está desactivada/);
  const {snapshot, event} = app.StudyProfile;
  const local = {version: 1, completed: {a1: '2026-01-01'}, missionTimeline: [], drafts: {sample: 'Only here'},
    missionDrafts: {sample: 'Also here'}, cloudEventsConsent: true, studyAnalyticsConsent: true, unknown: 'Only here'};
  assert.deepEqual(snapshot(local), {version: 1, completed: local.completed, missionTimeline: []});
  assert.deepEqual(event('mission_error', 'a2-delivery/0/1'), {kind: 'mission_error', module_id: 'a2-delivery/0/1', score: null});
  assert.equal(event('mission_error', 'respuesta escrita del alumno'), null);
  assert.equal(event('mission_skill', 'resolver-problemas', 101), null);
  assert.equal(event('mission_skill', 'resolver-problemas', 66.7).score, 67);
  const endpoint = cfg => {
    const window = {XANNY_CLOUD_CONFIG: cfg};
    new Function('window', 'location', files['cloud.js'])(window, {protocol: 'https:'});
    return window.XannyCloud;
  };
  const cfg = {accountsEnabled: true, supabaseUrl: 'https://example.com/', privacyPolicyUrl: 'https://example.com/privacy',
    publishableKey: 'sb_publishable_example'};
  assert.equal(endpoint(cfg).available(), true);
  assert.equal(endpoint(cfg).studyAnalyticsAvailable(), false);
  assert.equal(endpoint({...cfg, studyAnalyticsEnabled: true}).studyAnalyticsAvailable(), true);
  assert.equal(endpoint({...cfg, privacyPolicyUrl: 'http://example.com/privacy'}).available(), false);
  assert.equal(endpoint({...cfg, accountsEnabled: false}).available(), false);
  assert.equal(endpoint({...cfg, publishableKey: 'incorrect-prefix'}).available(), false);
});

test('el progreso agrupa errores por habilidad y conserva las sesiones recientes', () => {
  const legacy = {missionErrors: {'a2-delivery/0/1': {times: 4}, 'b1-tech/0/2': {times: 2, resolved: '2026-06-01'}},
    missionTimeline: [{missionId: 'a2-delivery', mode: 'course', first: 2, assisted: 1, revealed: 0, written: true, date: '2026-06-01'}]};
  const app = createTest(files, legacy);
  app.click('nav', {id: 'progress'});
  for (const label of ['Habilidades con más errores', 'Resolver problemas', '6 errores · 1 decisión pendiente',
    'Evolución reciente', '2/3 iniciales · 1 con ayuda', 'Respuestas escritas entregadas', 'Transferencia demostrada']) {
    assert.ok(app.app.innerHTML.includes(label), label);
  }
  let timeline = [];
  for (let i = 0; i < 45; i++) timeline = app.StudyProfile.addMissionSession(timeline, String(i), 'free',
    {first: 3, assisted: 0, revealed: 0}, false, '2026-06-01');
  assert.equal(timeline.length, 40);
  assert.equal(timeline[0].missionId, '5');
  assert.equal(timeline.at(-1).missionId, '44');
});
