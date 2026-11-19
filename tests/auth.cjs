const assert = require('node:assert/strict');
const {createServer} = require('node:http');
const {readFile} = require('node:fs/promises');
const {join} = require('node:path');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');

const root = join(__dirname, '..');
const base = 'http://127.0.0.1:4173';
const api = process.env.XANNY_DEV_API;
const key = process.env.XANNY_DEV_KEY;
const db = process.env.XANNY_DEV_DB;
const mail = process.env.XANNY_DEV_MAIL || 'http://127.0.0.1:54324';
const sdk = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.3/+esm';
const otpResponses = new WeakMap();
const assets = new Set(['index.html', 'styles.css', 'studio.css', 'data.js', 'question-bank.js',
  'mission-transfer.js', 'missions-data.js', 'adaptive.js', 'study-profile.js', 'progress-sync.js', 'cloud.js',
  'app.js', 'favicon.svg', 'manifest.webmanifest', 'xanny.svg', 'icon-192.png', 'icon-512.png']);
const types = {js: 'text/javascript', css: 'text/css', html: 'text/html', svg: 'image/svg+xml',
  webmanifest: 'application/manifest+json', png: 'image/png'};

function serve() {
  return createServer(async (request, response) => {
    const file = new URL(request.url, base).pathname.slice(1) || 'index.html';
    if (file === 'cloud-config.js') {
      response.setHeader('Content-Type', 'text/javascript');
      return response.end('window.XANNY_CLOUD_CONFIG = ' + JSON.stringify({
        developmentMode: true, accountsEnabled: true, classroomEnabled: true, studyAnalyticsEnabled: true,
        supabaseUrl: api, publishableKey: key, privacyPolicyUrl: base + '/privacy'
      }));
    }
    if (file === 'privacy') {
      response.setHeader('Content-Type', 'text/plain');
      return response.end('Política de privacidad del entorno aislado de prueba.');
    }
    if (!assets.has(file)) return response.writeHead(404).end();
    try {
      const body = await readFile(join(root, file));
      response.writeHead(200, {'Content-Type': types[file.split('.').at(-1)]}).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
}

async function messages() {
  const response = await fetch(mail + '/api/v1/messages', {signal: AbortSignal.timeout(5000)});
  if (!response.ok) throw Error('No se pudo consultar Mailpit.');
  return (await response.json()).messages || [];
}

async function openMail(page, email, earlier) {
  for (let i = 0; i < 30; i++) {
    const item = (await messages()).find(m => !earlier.has(m.ID) && m.To.some(to => to.Address === email));
    if (item) {
      const message = await (await fetch(mail + '/api/v1/message/' + item.ID)).json();
      const url = (message.HTML || '').match(/href=["']([^"']+\/auth\/v1\/verify[^"']*)/i)?.[1]
        || (message.Text || '').match(/https?:\/\/[^\s)]+\/auth\/v1\/verify[^\s)]+/i)?.[0];
      if (!url) throw Error('El correo de prueba llegó sin enlace de autenticación.');
      await page.goto(url.replaceAll('&amp;', '&'), {waitUntil: 'domcontentloaded'});
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw Error('No se recibió el correo de prueba en Mailpit.');
}

async function signIn(page, email, register = false) {
  const previous = new Set((await messages()).map(message => message.ID));
  await page.goto(base + '/#account');
  await page.locator('#accountEmail').waitFor();
  const adapter = await page.evaluate(async url => {
    try { return typeof (await import(url)).createClient; }
    catch (error) { return error.name + ': ' + error.message; }
  }, sdk);
  if (adapter !== 'function') throw Error('El SDK de prueba no se pudo cargar: ' + adapter);
  await page.locator('#accountEmail').fill(email);
  if (register) {
    await page.locator('#accountConsent').check();
    await page.locator('#accountAdult').check();
  }
  await page.getByRole('button', {name: register ? 'Crear cuenta' : 'Iniciar sesión', exact: true}).click();
  const status = page.locator('.page [role="status"]');
  await status.filter({hasText: /Si el correo puede continuar|No se pudo enviar/}).waitFor();
  if ((await status.innerText()).includes('No se pudo enviar')) {
    throw Error('Supabase Auth rechazó el envío de prueba: ' + (otpResponses.get(page) || 'sin respuesta OTP'));
  }
  await openMail(page, email, previous);
  await page.getByText(email, {exact: true}).waitFor();
}

async function authData(page) {
  return page.evaluate(() => {
    const authKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    const session = JSON.parse(localStorage.getItem(authKey));
    const progressKey = 'fluentlab_v1:account:' + session.user.id;
    return {token: session.access_token, userId: session.user.id, progressKey};
  });
}

async function rest(page, path, payload) {
  const {token} = await authData(page);
  const response = await fetch(api + '/rest/v1/' + path, {
    method: payload ? 'POST' : 'GET',
    headers: {apikey: key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
    body: payload ? JSON.stringify(payload) : undefined
  });
  return {status: response.status, data: await response.json()};
}

async function show(page, name) {
  await page.locator('.sidebar .nav [data-id="' + name + '"]').click();
}

async function confirmAction(page, name, accept = true) {
  const dialog = page.waitForEvent('dialog').then(box => accept ? box.accept() : box.dismiss());
  await Promise.all([dialog, page.getByRole('button', {name, exact: true}).click()]);
}

async function browserPage(browser, vendor, faults) {
  const context = await browser.newContext({viewport: {width: 1360, height: 800}, serviceWorkers: 'block'});
  await context.route(sdk, route => route.fulfill({
    contentType: 'text/javascript', headers: {'Access-Control-Allow-Origin': '*'}, body: vendor
  }));
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => faults.push(error.message));
  page.on('response', async response => {
    if (!response.url().endsWith('/auth/v1/otp')) return;
    let code = '';
    try {
      const data = await response.json();
      if (typeof data.error_code === 'string' && /^[a-z0-9_]{1,80}$/i.test(data.error_code)) code = data.error_code;
    } catch {}
    otpResponses.set(page, String(response.status()) + ' ' + code);
  });
  return page;
}

async function run() {
  if (!api || !key || !db || [api, db, mail].some(url => new URL(url).hostname !== '127.0.0.1')) throw Error('Usa un Supabase local de prueba.');
  const vendor = await readFile(process.env.XANNY_DEV_SDK, 'utf8');
  const server = serve();
  await new Promise(resolve => server.listen(4173, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({channel: 'chrome'});
    const errors = [];
    const one = await browserPage(browser, vendor, errors);
    const two = await browserPage(browser, vendor, errors);
    const teacher = await browserPage(browser, vendor, errors);
    const another = await browserPage(browser, vendor, errors);
    await one.addInitScript(() => {
      if (location.port === '4173' && !localStorage.getItem('fluentlab_v1')) {
        localStorage.setItem('fluentlab_v1', JSON.stringify({version: 1, level: 'C1', xp: 41,
          completed: {'a1-1': '2026-11-01'}, drafts: {private: 'BORRADOR-SIN-CUENTA'}}));
      }
    });
    await signIn(one, 'student-one@example.com', true);
    await signIn(two, 'student-two@example.com', true);
    await signIn(teacher, 'class-teacher@example.com', true);
    execFileSync('psql', [db, '-X', '-v', 'ON_ERROR_STOP=1', '-c',
      "insert into public.study_teachers select id from auth.users where email = 'class-teacher@example.com'"], {stdio: 'pipe'});


    const state = (page, value = 'saved') => page.locator('#accountSyncStatus[data-state="' + value + '"]').waitFor();
    const saveName = async (page, name, level) => {
      await page.getByLabel('Nombre visible').fill(name);
      if (level) await page.getByLabel('Nivel de inglés').selectOption(level);
      await page.getByRole('button', {name: 'Guardar perfil', exact: true}).click();
    };
    await state(one);
    await state(two);
    await one.getByText('Importar o recuperar historial', {exact:true}).click();
    await confirmAction(one, 'Reemplazar con progreso sin cuenta', false);
    assert.equal((await rest(one, 'learning_profiles?select=snapshot')).data[0].snapshot.xp, 0);
    await confirmAction(one, 'Reemplazar con progreso sin cuenta');
    await one.getByText('Se importó el progreso de estudio', {exact:false}).waitFor();
    await saveName(one, 'Alumno de práctica', 'C1');
    await state(one);
    const who = await authData(one);
    const inaccessible = await rest(two, 'learning_profiles?id=eq.' + who.userId + '&select=id,snapshot');
    assert.equal(inaccessible.status, 200);
    assert.deepEqual(inaccessible.data, []);
    const wrongAccount = await rest(two, 'rpc/xanny_sync_progress', {p_account:who.userId,p_alias:'Fuera',
      p_level:'A2',p_snapshot:{version:1,level:'A2'},p_revision:null});
    assert.equal(wrongAccount.status, 403);
    const own = await rest(one, 'learning_profiles?select=nickname,level,snapshot');
    assert.equal(own.data[0].nickname, 'Alumno de práctica');
    assert.equal(own.data[0].level, 'C1');
    assert.equal(own.data[0].snapshot.xp, 41);
    assert.equal(own.data[0].snapshot.drafts, undefined);

    await signIn(another, 'student-one@example.com');
    await state(another);
    const restored = await another.evaluate(progressKey => JSON.parse(localStorage.getItem(progressKey)), who.progressKey);
    assert.equal(restored.completed['a1-1'], '2026-11-01');
    assert.equal(await another.getByLabel('Nombre visible').inputValue(), 'Alumno de práctica');

    await another.context().setOffline(true);
    await state(another, 'offline');
    await saveName(another, 'Nombre sin conexión');
    await state(another, 'offline');
    assert.equal(await another.evaluate(key => localStorage.getItem(key + ':alias'), who.progressKey), 'Nombre sin conexión');
    await saveName(one, 'Nombre de la nube');
    await state(one);
    await another.context().setOffline(false);
    await another.getByText('Hay dos versiones del progreso').waitFor();
    assert.equal((await rest(one, 'learning_profiles?select=nickname')).data[0].nickname, 'Nombre de la nube');
    assert.equal(await another.getByLabel('Nombre visible').inputValue(), 'Nombre sin conexión');
    await confirmAction(another, 'Usar la copia de la nube');
    await state(another);
    assert.equal(await another.getByLabel('Nombre visible').inputValue(), 'Nombre de la nube');
    assert.equal(await another.evaluate(key => JSON.parse(localStorage.getItem(key + ':recovery')).nickname, who.progressKey),
      'Nombre sin conexión');

    const syncUrl = '**/rest/v1/rpc/xanny_sync_progress';
    await another.route(syncUrl, route => route.fulfill({status:503,contentType:'application/json',
      headers:{'Access-Control-Allow-Origin':'*'},body:'{"code":"temporary_failure","message":"Prueba de recuperación"}'}));
    await saveName(another, 'Recuperado tras fallo');
    await state(another, 'error');
    assert.equal(await another.evaluate(key => localStorage.getItem(key + ':alias'), who.progressKey), 'Recuperado tras fallo');
    await another.unroute(syncUrl);
    await another.getByRole('button',{name:'Sincronizar ahora'}).click();
    await state(another);
    assert.equal((await rest(another,'learning_profiles?select=nickname')).data[0].nickname, 'Recuperado tras fallo');

    await one.getByText('Eliminar cuenta y datos',{exact:true}).click();
    await confirmAction(one,'Solicitar eliminación');
    await one.getByText('Solicitud registrada.',{exact:false}).waitFor();
    assert.equal((await rest(one,'account_deletion_requests?select=requested_at')).data.length,1);
    assert.equal((await rest(two,'account_deletion_requests?select=requested_at')).data.length,0);
    await one.getByText('Eliminar cuenta y datos',{exact:true}).click();
    await confirmAction(one,'Cancelar solicitud');
    await one.getByText('Solicitud de eliminación cancelada.',{exact:true}).waitFor();
    console.log('Dos usuarios: registro, progreso automático, restauración, conflicto, fallo temporal e aislamiento verificados.');

    await one.getByRole('button',{name:'Sincronizar ahora'}).click();
    await state(one);
    await show(one, 'path');
    await one.locator('[data-a="openLesson"][data-id="a1-1"]').first().click();
    for (let i = 0; i < 3; i++) {
      const option = () => one.locator('[data-a="lessonOption"]:not([disabled])').first();
      const check = one.locator('[data-a="lessonCheck"]');
      const next = one.locator('[data-a="lessonNext"]');
      await option().click();
      await check.click();
      if (await check.isVisible()) {
        await option().click();
        await check.click();
      }
      await next.click();
    }
    await one.getByText('¡Terminaste tu práctica!',{exact:true}).waitFor();
    await show(one, 'account');
    await state(one);
    const lessons = (await rest(one, 'learning_profiles?select=snapshot')).data[0].snapshot.lessonResults;
    assert.equal(lessons['a1-1'].sessions, 1);
    assert.equal(lessons['a1-1'].first + lessons['a1-1'].assisted + lessons['a1-1'].revealed, 3);

    await show(teacher, 'classroom');
    await teacher.locator('#className').fill('Inglés del martes');
    await teacher.getByRole('button', {name: 'Crear grupo'}).click();
    const codeField = teacher.getByLabel('Código privado de inscripción');
    const invite = await codeField.inputValue();
    const group = (await rest(teacher, 'rpc/xanny_classroom_context', {})).data.groups[0].id;
    assert.equal((await rest(two, 'rpc/xanny_classroom_report', {p_group: group})).status, 403);
    await teacher.getByLabel('Asignar una misión').selectOption('a2-delivery');
    await teacher.getByRole('button', {name: 'Asignar misión', exact: true}).click();
    await teacher.getByText('Misión asignada.', {exact: true}).waitFor();

    await show(one, 'classroom');
    await one.locator('#classCode').fill(invite);
    await one.locator('#classAlias').fill('Estudiante Uno');
    await one.getByRole('button', {name: 'Unirme a la clase'}).click();
    const joinResult = one.locator('.page [role="status"]').filter({hasText: /Te uniste|Revisa el código|permiso|No se pudo/});
    await joinResult.waitFor();
    assert.equal(await joinResult.innerText(), 'Te uniste a la clase.');
    await one.getByRole('button', {name: 'Practicar', exact: true}).click();
    const answers = await one.evaluate(progressKey => {
      const variant = JSON.parse(localStorage.getItem(progressKey)).missionVariants['a2-delivery'];
      return MISSIONS[0].variants[variant].questions.map(q => q.answer);
    }, who.progressKey);
    for (const [i, answer] of answers.entries()) {
      const submit = one.locator('[data-a="missionCheck"]');
      if (i === 1) {
        await one.locator('[data-a="missionChoice"][data-index="' + ((answer + 1) % 3) + '"]').click();
        await submit.click();
      }
      await one.locator('[data-a="missionChoice"][data-index="' + answer + '"]').click();
      await submit.click();
      await one.locator('[data-a="missionNext"]').click();
    }
    await one.getByRole('button', {name: 'Finalizar misión', exact: false}).click();
    const before = (await rest(teacher, 'rpc/xanny_classroom_report', {p_group: group})).data;
    assert.equal(before.totals.completed, 0);
    await one.getByRole('button', {name: 'Compartir resultado con mi clase'}).click();
    await one.getByText('Tu clase recibió el resultado.').waitFor();
    await teacher.getByRole('button', {name: 'Ver resultados'}).click();
    await teacher.getByRole('heading', {name: 'Resultados de Inglés del martes'}).waitFor();
    const report = (await rest(teacher, 'rpc/xanny_classroom_report', {p_group: group})).data;
    assert.equal(report.totals.completed, 1);
    assert.equal(report.totals.first, 2);
    assert.equal(report.totals.assisted, 1);
    assert.equal(report.recent[0].alias, 'Estudiante Uno');

    await show(one, 'account');
    await one.getByRole('button', {name: 'Cerrar sesión'}).click();
    await one.getByRole('button', {name: 'Iniciar sesión', exact: true}).waitFor();
    await signIn(one, 'student-two@example.com');
    const otherScope = await authData(one);
    assert.notEqual(otherScope.userId, who.userId);
    assert.equal(await one.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}').completed?.['a1-1'], otherScope.progressKey), undefined);
    assert.deepEqual(errors, []);
    console.log('Supabase Auth y Mailpit: tres cuentas verificadas, recuperación en otro navegador y cambio de cuenta.');
    console.log('Aula: grupo, inscripción, asignación, entrega voluntaria, informe docente y bloqueo de acceso cruzado.');
  } finally {
    await browser?.close();
    server.close();
  }
}
run().catch(error => {
  console.error(String(error.message).replace(/([?&#](?:token|code)=)[^&\s'"]+/gi, '$1[oculto]'));
  process.exitCode = 1;
});
