const assert = require('node:assert/strict');
const {createServer} = require('node:http');
const {readFile} = require('node:fs/promises');
const {join, extname} = require('node:path');
const {chromium, devices} = require('playwright');

const root = join(__dirname, '..');
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png'};
const sections = ['home','missions','path','listen','speak','cards','errors','progress','account','grammar','write','resources','settings','diagnostic'];

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

async function run() {
  const server = serve();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port + '/-fluentlab/';
  let browser;
  try {
    browser = await chromium.launch();
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
    await page.goto(url);
    assert.match(await page.title(), /FluentLab 3\.1/);
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
    await hasContent(page.getByRole('alert'), 'Escribe al menos tres palabras');
    await page.locator('#missionWrite').fill('Could you check the receipt number?');
    await page.locator('[data-a="missionModel"]').click();
    await hasContent(page.locator('.transfer-panel'), 'Criterios de autoevaluación');
    await page.locator('[data-a="missionFinish"]').click();
    await hasContent(page.locator('.mission-summary'), 'sin calificación lingüística');
    await page.reload();
    const p = await progress(page);
    assert.equal(p.completed['a1-1'], '2026-01-01');
    assert.equal(p.missionResults['a2-delivery'].course.written, 1);
    assert.equal(p.missionDrafts['a2-delivery'], 'Could you check the receipt number?');

    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    assert.ok(await page.evaluate(async () => (await caches.keys()).includes('fluentlab-static-3.1.0')));
    await desktop.setOffline(true);
    await page.reload();
    await page.locator('.page h1').waitFor();
    assert.match(await page.title(), /FluentLab 3\.1/);
    assert.deepEqual(desktopErrors, []);
    console.log('Escritorio: 14 rutas, reintento, transferencia, curso, progreso legado y recarga sin conexión.');

    const mobile = await browser.newContext({...devices['Pixel 7'], viewport: {width: 360, height: 720}});
    const phone = await mobile.newPage();
    const mobileErrors = monitor(phone);
    await phone.goto(url);
    await verifyNav(phone, true);
    assert.equal(await phone.locator('.mobile-more[open]').count(), 0);
    await phone.locator('.mobile-more summary').click();
    const menu = phone.locator('.mobile-menu-panel');
    assert.equal(await menu.isVisible(), true);
    const bounds = await menu.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 360 && bounds.y >= 0);
    await phone.keyboard.press('Escape');
    assert.equal(await menu.isVisible(), false);
    assert.deepEqual(mobileErrors, []);
    console.log('Móvil de 360 px: 14 rutas, menú completo, cierre con Escape y sin desbordamiento horizontal.');
  } finally {
    await browser?.close();
    server.close();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
