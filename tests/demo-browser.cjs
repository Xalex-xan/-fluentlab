const assert = require('node:assert/strict');
const {randomBytes} = require('node:crypto');
const {mkdtemp, readdir, readFile, rm} = require('node:fs/promises');
const {createServer, request} = require('node:http');
const {tmpdir} = require('node:os');
const {join} = require('node:path');
const {once} = require('node:events');
const {chromium} = require('playwright');
const {source:axeSource} = require('axe-core');
const {buildDemo, demoFiles} = require('../tools/build-demo.cjs');
const {createDemoServer} = require('../tools/demo-server.cjs');

const host = 'xanny-demo-test.onrender.com';
const username = 'revisor';
const password = randomBytes(32).toString('hex');
const authorization = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
const demoKey = 'xanny_demo_v1';
const oldKey = 'fluentlab_v1';
const oldProgress = '{"version":1,"xp":991,"level":"A1"}';

async function start(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return 'http://127.0.0.1:' + server.address().port;
}

function edgeProxy(origin) {
  return createServer((incoming, outgoing) => {
    const upstream = request(origin + incoming.url, {
      method:incoming.method, headers:{...incoming.headers, host, 'x-forwarded-proto':'https'}
    }, upstreamResponse => {
      outgoing.writeHead(upstreamResponse.statusCode, upstreamResponse.headers);
      upstreamResponse.pipe(outgoing);
    });
    upstream.on('error', () => outgoing.writeHead(502).end());
    incoming.pipe(upstream);
  });
}

async function checkGate(url) {
  for (const path of ['/', '/app.js', '/privacy.html']) {
    assert.equal((await fetch(url + path)).status, 401, path);
    assert.equal((await fetch(url + path, {headers:{authorization}})).status, 200, path);
  }
  for (const path of ['/cloud-config.js', '/cloud.js', '/sw.js', '/supabase_setup.sql', '/access-demo.json']) {
    assert.equal((await fetch(url + path, {headers:{authorization}})).status, 404, path);
  }
  assert.equal((await fetch(url + '/healthz')).status, 204);
  const response = await fetch(url + '/', {headers:{authorization}});
  assert.match(response.headers.get('content-security-policy'), /connect-src 'none'/);
  assert.match(response.headers.get('permissions-policy'), /microphone=\(\)/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
}

function heading(page, name) {
  return page.getByRole('heading', {name, exact:true}).waitFor();
}

function toHome(page) {
  return page.getByRole('button', {name:'Inicio de la demo'}).click();
}

async function accessibility(page, label) {
  await page.evaluate(axeSource);
  const failures = await page.evaluate(async () => (await axe.run({runOnly:{
    type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa']
  }})).violations.map(item => ({id:item.id, nodes:item.nodes.map(node => node.target)})));
  assert.deepEqual(failures, [], label);
}

async function diagnostic(page) {
  await page.getByRole('button',{name:/Hacer el diagnóstico/}).click();
  await page.getByRole('button',{name:/Empezar prueba/}).click();
  const solutions = await page.evaluate(() => DATA.placement.map(question => question[2]));
  for (const [index, solution] of solutions.entries()) {
    await page.locator('[data-a="diagnosticOption"]').nth(index < 8 ? solution : (solution + 1) % 3).click();
    await page.locator('[data-a="diagnosticNext"]').click();
  }
  await heading(page, 'Tu punto de partida sugerido');
  await page.getByText('Revisar las 12 explicaciones').click();
  assert.equal(await page.locator('.demo-review li').count(), 12);
  await page.getByText(/El informe recibe la acción/).waitFor();
  await page.getByRole('button',{name:'Empezar en B1'}).click();
  await heading(page, 'Tu ruta hacia la fluidez');
  assert.equal(await page.locator('[data-a="pathFilter"].active').getAttribute('data-id'), 'B1');
}

async function completeUnitSession(page, unitId, sessionId, tileLabel) {
  await toHome(page);
  await page.getByRole('button',{name:tileLabel}).click();
  await page.locator('#unitCheck').waitFor();
  const questions = await page.evaluate(([unitId, sessionId]) => {
    const selected = JSON.parse(localStorage.getItem('xanny_demo_v1')).unitRecent[unitId + '/' + sessionId];
    const session = UNIT_DATA.find(unit => unit.id === unitId).sessions.find(session => session.id === sessionId);
    return selected.map(id => session.questions.find(question => question.id === id));
  },[unitId,sessionId]);
  for (const question of questions) {
    if (question.type === 'word') await page.locator('#unitShort').fill(question.answers[0]);
    else if (question.type === 'choice') await page.getByRole('button',{name:question.answer, exact:true}).click();
    else {
      for (const index of question.parts.keys()) await page.locator('#unitToken-' + index).click();
    }
    await page.locator('#unitCheck').click();
    await page.locator('#unitFeedback').getByText('Acierto inicial').waitFor();
    await page.locator('[data-a="unitNext"]').click();
  }
  const finish = page.locator('[data-a="unitFinish"]');
  if (await finish.isVisible()) await finish.click();
  await heading(page, 'Sesión finalizada');
  const result = await page.evaluate(key => JSON.parse(localStorage.getItem('xanny_demo_v1')).unitSessions[key].free,
    unitId + '/' + sessionId);
  assert.equal(result.completed, 1);
  assert.equal(result.first, questions.length);
}

async function feedback(page) {
  await page.getByRole('button',{name:'Opinar',exact:true}).click();
  await heading(page, 'Tu opinión sobre la demo');
  await page.getByRole('button',{name:'Descargar mis opiniones'}).click();
  await page.locator('#demo-feedback-status').filter({hasText:/Responde al menos/}).waitFor();
  await page.getByLabel('Diseño visual').selectOption('Muy bueno');
  await page.getByLabel('¿Qué error encontraste?').fill('La transcripción debería quedar visible al volver.');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button',{name:'Descargar mis opiniones'}).click()
  ]);
  assert.equal(download.suggestedFilename(), 'opiniones-xanny.txt');
  const content = await readFile(await download.path(),'utf8');
  assert.match(content, /Diseño visual: Muy bueno/);
  assert.match(content, /La transcripción debería quedar visible/);
  assert.doesNotMatch(content, /@|991/);
}

async function run() {
  const directory = await mkdtemp(join(tmpdir(), 'xanny-demo-'));
  let origin, edge, browser;
  try {
    await buildDemo(directory);
    assert.deepEqual((await readdir(directory)).sort(), [...demoFiles].sort());
    const baseBytes = (await Promise.all([...demoFiles].map(async file => (await readFile(join(directory,file))).length)))
      .reduce((total, bytes) => total + bytes, 0);
    assert.ok(baseBytes < 550 * 1024, 'Paquete sin comprimir: ' + baseBytes + ' bytes');
    origin = await createDemoServer({directory, origin:'https://' + host, access:[{username,password}]});
    edge = edgeProxy(await start(origin));
    const url = await start(edge);
    await checkGate(url);

    browser = await chromium.launch({channel:'chrome'});
    const desktop = await browser.newContext({viewport:{width:1366,height:768},httpCredentials:{username,password}});
    const page = await desktop.newPage();
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', req => {
      if (/^https?:/.test(req.url()) && !req.url().startsWith(url + '/')) external.push(req.url());
    });
    await page.addInitScript(([key, progress]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, progress);
      Math.random = () => .999;
    },[oldKey,oldProgress]);
    await page.goto(url + '/');
    await heading(page, 'Aprende inglés con Xanny');
    assert.match(await page.title(), /Demostración/);
    assert.equal(await page.evaluate(() => Boolean(window.XannyCloud)), false);
    assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
    await page.getByRole('button',{name:'Pedirle un consejo a Xanny'}).click();
    await page.getByText(/lee la pista y vuelve a intentarlo/).waitFor();
    await accessibility(page, 'Inicio en escritorio');
    await diagnostic(page);
    await completeUnitSession(page, 'b1-viaje', 'notice', /B1 · Un cambio de planes/);
    await completeUnitSession(page, 'b2-proyecto', 'negotiate', /B2 · Defiende una propuesta/);

    await toHome(page);
    await page.getByRole('button',{name:/salvó el proyecto/}).click();
    await heading(page, 'Escucha con intención');
    const answer = await page.evaluate(() => {
      const variant = JSON.parse(localStorage.getItem('xanny_demo_v1')).lastListen.l9;
      const item = DATA.listening.find(item => item.id === 'l9');
      return variant ? XANNY_LISTEN_EXTRA.l9[1][XANNY_LISTEN_EXTRA.l9[2]] : item.options[item.answer];
    });
    await page.locator('[data-a="listenOption"]').filter({hasText:answer}).click();
    await page.locator('[data-a="listenCheck"]').click();
    await page.locator('.feedback.good').getByText(/noche anterior|copia de respaldo/).waitFor();
    await page.locator('[data-a="toggleTranscript"]').click();
    await page.getByText(/Luckily, I had saved a backup copy/).waitFor();
    await toHome(page);
    await page.getByRole('button',{name:/Una entrevista en inglés/}).click();
    await page.getByText(/Decisión 1 de 3/i).waitFor();
    await toHome(page);
    await page.getByRole('button',{name:/memoria/}).click();
    await page.locator('[data-a="flipCard"]').click();
    await page.locator('[data-a="rateCard"][data-rating="good"]').click();

    await page.locator('.sidebar [data-id="write"]').click();
    const topic = await page.evaluate(() => String(DATA.writing.findIndex(item => item.level === 'B1')));
    await page.locator('#writeSelect').selectOption(topic);
    await page.getByLabel('Escribe en inglés').fill('A fictional note about changing trains.');
    await page.getByRole('button',{name:'Guardar borrador'}).click();
    await page.reload();
    assert.equal(await page.getByLabel('Escribe en inglés').inputValue(), 'A fictional note about changing trains.');
    for (const [route, title] of [['classroom','Aula Virtual'],['account','Mi cuenta']]) {
      await page.locator('.sidebar [data-id="' + route + '"]').click();
      await heading(page,title);
      await page.getByText('Datos ficticios',{exact:true}).first().waitFor();
      assert.equal(await page.locator('input[type="email"], [data-a="classJoin"], [data-a="cloudLogin"]').count(),0);
    }
    await page.locator('.sidebar [data-id="progress"]').click();
    await page.getByText('Ver un ejemplo de progreso con datos ficticios').click();
    await page.getByText('270 XP',{exact:true}).waitFor();
    assert.ok((await page.evaluate(key => JSON.parse(localStorage.getItem(key)).xp,demoKey)) > 0);
    await feedback(page);
    await accessibility(page, 'Formulario en escritorio');
    await page.getByRole('button',{name:'Reiniciar',exact:true}).click();
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    assert.ok(await page.evaluate(key => localStorage.getItem(key),demoKey));
    await page.getByRole('button',{name:'Reiniciar',exact:true}).click();
    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('button',{name:'Reiniciar demostración',exact:true}).click()
    ]);
    await heading(page, 'Aprende inglés con Xanny');
    assert.equal(await page.evaluate(key => localStorage.getItem(key),demoKey),null);
    assert.equal(await page.evaluate(key => localStorage.getItem(key),oldKey),oldProgress);

    const mobile = await browser.newContext({viewport:{width:360,height:720},isMobile:true,hasTouch:true,
      reducedMotion:'reduce',httpCredentials:{username,password}});
    const phone = await mobile.newPage();
    await phone.goto(url + '/');
    await heading(phone, 'Aprende inglés con Xanny');
    await accessibility(phone, 'Inicio en móvil');
    assert.equal(await phone.locator('.demo-coach img').evaluate(image => getComputedStyle(image).animationName),'none');
    await phone.locator('.mobile-more summary').click();
    await phone.locator('.mobile-menu-panel [data-id="demo-feedback"]').click();
    await heading(phone, 'Tu opinión sobre la demo');
    assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await phone.getByRole('button',{name:'Inicio de la demo'}).click();
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('Demo: HTTPS delegado y acceso individual, 12 explicaciones, B1/B2, audio, tarjetas, borradores, opiniones, reinicio y móvil.');
    console.log('Accesibilidad WCAG 2.1 AA (axe) y movimiento reducido. Paquete sin comprimir: ' + baseBytes + ' bytes.');
  } finally {
    await browser?.close();
    edge?.close();
    origin?.close();
    await rm(directory,{recursive:true,force:true});
  }
}

run().catch(error => {console.error(error);process.exitCode = 1;});
