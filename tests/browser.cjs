const assert = require('node:assert/strict');
const {createServer} = require('node:http');
const {readFile} = require('node:fs/promises');
const {join, extname} = require('node:path');
const {chromium, devices} = require('playwright');

const root = join(__dirname, '..');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png'};
const sections = ['home','units','missions','path','listen','speak','cards','errors','progress','account','classroom','grammar','write','resources','settings','diagnostic'];

function serve() {
  return createServer(async (request, response) => {
    const prefix = '/-fluentlab/';
    const url = new URL(request.url, 'http://localhost');
    if (!url.pathname.startsWith(prefix)) return response.writeHead(404).end();
    const name = url.pathname.slice(prefix.length) || 'index.html';
    if (!/^[a-z0-9.-]+$/.test(name) || !mime[extname(name)]) return response.writeHead(404).end();
    try {
      const content = await readFile(join(root, name));
      response.writeHead(200, {'content-type': mime[extname(name)]}).end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
}

function monitor(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && response.url().includes('/-fluentlab/')) {
      errors.push(response.status() + ' ' + response.url());
    }
  });
  return errors;
}

async function hasContent(locator, text) {
  await locator.getByText(text, {exact: false}).first().waitFor({state: 'visible'});
}

async function verifyNav(page, mobile) {
  for (const id of sections) {
    let target;
    if (mobile) {
      const menu = page.locator('.mobile-more');
      await menu.locator('summary').click();
      target = menu.locator('.mobile-menu-panel [data-id="' + id + '"]');
    } else {
      target = page.locator('.sidebar [data-id="' + id + '"]');
    }
    await target.click();
    await page.locator('.page h1').waitFor();
    assert.doesNotMatch(await page.locator('.page').innerText(), /FluentLab/i, id);
    assert.equal(new URL(page.url()).hash, '#' + id);
    const dimensions = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    assert.ok(dimensions[0] <= dimensions[1], id + ' desborda: ' + dimensions);
  }
}

async function progress(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('fluentlab_v1')));
}

async function answerMission(page, expectedVariant) {
  await page.locator('.case-grid [data-id="a2-delivery"]').click();
  const chosen = (await progress(page)).missionVariants['a2-delivery'];
  assert.equal(chosen, expectedVariant);
  const data = await page.evaluate(variant => MISSIONS[0].variants[variant], chosen);
  for (const [index, q] of data.questions.entries()) {
    const questions = page.locator('.case-layout');
    const select = async option => {
      await questions.locator('[data-index="' + option + '"]').click();
      await questions.getByRole('button', {name: 'Comprobar respuesta'}).click();
    };
    if (index === 2) await hasContent(questions, 'NUEVO CONTEXTO');
    if (index === 1) {
      await select((q.answer + 1) % q.choices.length);
      await hasContent(questions, 'Prueba una vez más');
      await hasContent(questions, q.hint);
    }
    await select(q.answer);
    await hasContent(questions, q.translation);
    assert.equal(await questions.locator('.option-explanations li').count(), q.choices.length);
    await questions.locator('[data-a="missionNext"]').click();
  }
}


async function checkA11y(page, region) {
  if (!await page.evaluate(() => Boolean(window.axe))) {
    await page.addScriptTag({path: require.resolve('axe-core/axe.min.js')});
  }
  const violations = await page.evaluate(async selector => {
    const result = await axe.run(selector, {
      runOnly: {type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}
    });
    return result.violations.map(item => ({id:item.id, nodes:item.nodes.map(node => node.target.join(' '))}));
  }, region);
  assert.deepEqual(violations, [], 'Accesibilidad en ' + region);
}

async function checkBudget(page) {
  const report = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource').filter(item =>
      new URL(item.name).origin === location.origin && /\.(css|js|svg)$/.test(new URL(item.name).pathname));
    return {bytes:resources.reduce((total,item) => total + item.encodedBodySize,0), requests:resources.length,
      ready:Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd)};
  });
  assert.ok(report.bytes > 100000 && report.bytes <= 440 * 1024, 'Presupuesto de transferencia: ' + report.bytes);
  assert.ok(report.requests <= 24 && report.ready <= 5000, JSON.stringify(report));
  console.log('Rendimiento en frío: ' + report.bytes + ' bytes de JS, CSS y SVG; ' +
    report.requests + ' recursos; DOM listo en ' + report.ready + ' ms en el runner.');
}

async function checkUnitSession(page, unit, session, options = {}) {
  await page.locator('.sidebar .nav [data-id="units"]').click();
  await page.locator('[data-a="unitOpen"][data-id="' + unit + '"]').click();
  await page.locator('[data-a="unitSession"][data-session="' + session + '"]').click();
  await page.locator('#unitPrompt').waitFor();
  if (options.audit) await checkA11y(page, '.unit-layout');
  if (options.listening) {
    await page.getByRole('button',{name:'Reproducir audio'}).click();
    const played = await page.evaluate(() => window.lastStudyUtterance);
    assert.match(played.text, /Quick update: our coach/);
    assert.ok(Math.abs(played.rate - .92) < 0.001, 'Velocidad de escucha');
    await page.getByRole('button',{name:'Transcripción'}).click();
    assert.equal(await page.locator('#unitTranscript').isVisible(), true);
  }
  const items = await page.evaluate(([unitId,sessionId]) => {
    const s = UNIT_DATA.find(item=>item.id===unitId).sessions.find(item=>item.id===sessionId);
    const key = unitId + '/' + sessionId;
    const ids = JSON.parse(localStorage.getItem('fluentlab_v1')).unitRecent[key];
    return ids.map(id => s.questions.find(q=>q.id===id));
  },[unit,session]);
  for (const [i,q] of items.entries()) {
    const answer = async correct => {
      if (q.type === 'word') await page.locator('#unitShort').fill(correct ? q.answers[0] : 'unrelated');
      else if (q.type === 'choice') await page.locator('#unitOption-' + (correct ? 0 : 1)).click();
      else {
        const parts = q.parts.map((_,i) => i);
        if (!correct) parts.reverse();
        for (const index of parts) await page.locator('#unitToken-' + index).click();
      }
      await page.locator('#unitCheck').click();
    };
    if (i === 0 && options.retry) {
      await answer(false);
      await hasContent(page.locator('#unitFeedback'), 'Inténtalo una vez más');
    }
    await answer(true);
    await hasContent(page.locator('#unitFeedback'), i === 0 && options.retry || options.listening ? 'Acierto con ayuda' : 'Acierto inicial');
    await page.locator('[data-a="unitNext"]').click();
  }
  if (options.writing) {
    await page.locator('[data-a="unitFinish"]').click();
    await page.locator('#unitWritingError').filter({hasText:'Escribe al menos ocho palabras'}).waitFor();
    await page.locator('#unitDraft').fill('The trial should continue provided the team can track comparable cases.');
    await page.locator('#unitModel').click();
    await hasContent(page.locator('#unitWritingModel'), 'sin calificación lingüística');
    await page.locator('[data-a="unitFinish"]').click();
  }
  await hasContent(page.locator('.unit-summary'), 'Sesión finalizada');
  assert.equal((await progress(page)).unitSessions[unit + '/' + session].course.completed, 1);
}

async function run() {
  const server = serve();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port + '/-fluentlab/';
  let browser;
  try {
    browser = await chromium.launch({channel: 'chrome'});
    const desktop = await browser.newContext({viewport: {width: 1366, height: 768}});
    const page = await desktop.newPage();
    const desktopErrors = monitor(page);
    await page.addInitScript(() => {
      if (localStorage.getItem('fluentlab_v1')) return;
      localStorage.setItem('fluentlab_v1', JSON.stringify({
        version: 1, xp: 37, level: 'A2', completed: {'a1-1': '2026-01-01'},
        missionHistory: {'a2-delivery': {plays: 1, totalQuestions: 2, totalFirst: 2, lastVariant: 1}}
      }));
    });
    await page.addInitScript(() => {
      Object.defineProperty(window,'speechSynthesis',{value:{
        cancel(){}, getVoices(){return [];},
        speak(utterance){window.lastStudyUtterance={text:utterance.text,rate:utterance.rate};}
      }});
    });
    const external = [];
    page.on('request', request => {
      if (/supabase|cloudflareinsights|cdn\.jsdelivr\.net/.test(request.url())) external.push(request.url());
    });
    await page.goto(url);
    await page.getByRole('heading', {name: 'Aprende con Xanny', exact: true}).waitFor();
    await page.locator('.xanny-hero img').evaluate(image => image.decode());
    await page.locator('.brand img').evaluate(image => image.decode());
    await checkBudget(page);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.skip-main').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#main-content').evaluate(el => el === document.activeElement), true);
    const icons = await page.evaluate(async () => {
      const manifestUrl = document.querySelector('link[rel="manifest"]').href;
      const manifest = await (await fetch(manifestUrl)).json();
      return Promise.all(manifest.icons.map(async icon => {
        const image = new Image();
        image.src = new URL(icon.src, manifestUrl).href;
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      }));
    });
    assert.deepEqual(icons, [[192, 192], [512, 512]]);
    await page.locator('.sidebar .nav [data-id="account"]').click();
    await page.getByText('La sincronización en la nube está desactivada.').waitFor();
    assert.ok(await page.getByRole('button', {name: 'Crear cuenta'}).isDisabled());
    assert.match(await page.title(), /Aprende con Xanny/);
    await verifyNav(page, false);
    await page.locator('.sidebar [data-id="missions"]').click();
    await answerMission(page, 0);
    await page.locator('[data-a="missionFinish"]').click();
    await hasContent(page.locator('.mission-summary'), 'Misión finalizada');
    assert.equal((await progress(page)).missionResults['a2-delivery'].free.assisted, 1);

    await page.locator('.sidebar [data-id="missions"]').click();
    await page.locator('#learningMode').selectOption('course');
    await answerMission(page, 1);
    await page.locator('#missionWrite').fill(' ');
    await page.locator('[data-a="missionFinish"]').click();
    await page.getByText('Escribe al menos tres palabras', {exact: false}).waitFor();
    await page.locator('#missionWrite').fill('Could you check the receipt number?');
    await page.locator('[data-a="missionModel"]').click();
    await hasContent(page.locator('.transfer-panel'), 'Criterios de autoevaluación');
    await page.locator('[data-a="missionFinish"]').click();
    await hasContent(page.locator('.mission-summary'), 'sin calificación lingüística');
    await page.locator('.sidebar .nav [data-id="progress"]').click();
    await hasContent(page.locator('.page'), 'Evolución reciente');
    await hasContent(page.locator('.progress-ranking'), 'Resolver problemas');
    await page.reload();
    const p = await progress(page);
    assert.equal(p.missionTimeline.length, 2);
    assert.equal(p.missionTimeline[1].mode, 'course');
    assert.equal(p.completed['a1-1'], '2026-01-01');
    assert.equal(p.missionResults['a2-delivery'].course.written, 1);
    assert.equal(p.missionDrafts['a2-delivery'], 'Could you check the receipt number?');

    await checkUnitSession(page,'b1-viaje','audio',{listening:true,audit:true});
    await checkUnitSession(page,'b2-proyecto','writing',{writing:true,retry:true,audit:true});
    await page.locator('.sidebar .nav [data-id="units"]').click();
    await checkA11y(page,'.unit-cards');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    assert.ok(await page.evaluate(async () => (await caches.keys()).includes('xanny-english-static-3.4.0')));
    await desktop.setOffline(true);
    await page.reload();
    await page.locator('.page h1').waitFor();
    assert.match(await page.title(), /Aprende con Xanny/);
    assert.deepEqual(desktopErrors, []);
    assert.deepEqual(external, []);
    console.log('Escritorio: 16 rutas, reintento, transferencia, curso, progreso legado y recarga sin conexión.');

    const mobile = await browser.newContext({...devices['Pixel 7'], viewport: {width: 360, height: 720}, reducedMotion: 'reduce'});
    const phone = await mobile.newPage();
    const mobileErrors = monitor(phone);
    await phone.goto(url);
    const mascot = phone.locator('.xanny-hero img');
    await mascot.waitFor({state: 'visible'});
    assert.equal(await mascot.evaluate(image => getComputedStyle(image).animationName), 'none');
    await verifyNav(phone, true);
    assert.equal(await phone.locator('.mobile-more[open]').count(), 0);
    await phone.locator('.mobile-more summary').click();
    const menu = phone.locator('.mobile-menu-panel');
    assert.equal(await menu.isVisible(), true);
    const bounds = await menu.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 360 && bounds.y >= 0);
    await phone.keyboard.press('Escape');
    assert.equal(await menu.isVisible(), false);
    await phone.getByRole('button',{name:'Unidades',exact:true}).click();
    assert.equal(await phone.locator('.xanny-mood--welcome img').evaluate(img => getComputedStyle(img).animationName), 'none');
    await checkA11y(phone,'.unit-cards');
    await phone.locator('[data-a="unitOpen"][data-id="b1-viaje"]').click();
    assert.equal(await phone.locator('.unit-session-row').count(),8);
    await checkA11y(phone,'.unit-sessions');
    assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log('Accesibilidad: axe WCAG 2.1 AA en las nuevas pantallas, foco del teclado y movimiento reducido.');
    assert.deepEqual(mobileErrors, []);
    console.log('Móvil de 360 px: 16 rutas, menú completo, cierre con Escape y sin desbordamiento horizontal.');
  } finally {
    await browser?.close();
    server.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
