const assert = require('node:assert/strict');
const {createStagingServer} = require('../tools/staging-server.cjs');
const {renderPrivacyNotice} = require('../tools/privacy-notice.cjs');
const {request} = require('node:https');
const {randomBytes} = require('node:crypto');
const {join} = require('node:path');
const {createClient} = require('@supabase/supabase-js');
const {readFile} = require('node:fs/promises');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');

const base = 'https://127.0.0.1:4173';
const api = process.env.XANNY_DEV_API;
const key = process.env.XANNY_DEV_KEY;
const db = process.env.XANNY_DEV_DB;
const mail = process.env.XANNY_DEV_MAIL || 'http://127.0.0.1:54324';
const sdk = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.3/+esm';
const otpResponses = new WeakMap();
const access = ['ci-alumno-uno','ci-alumno-dos'].map(username => ({
  username,password:randomBytes(36).toString('base64url')
}));
const fixtureMailboxes = ['student-one@example.com','student-two@example.com','class-teacher@example.com'];

function approvedFixture(value) {
  if (typeof value === 'string') return 'Valor sintético del ensayo';
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,approvedFixture(item)]));
  }
  return value;
}

async function serve() {
  const [cert, privateKey, template] = await Promise.all([
    readFile(process.env.XANNY_TEST_CERT), readFile(process.env.XANNY_TEST_KEY),
    readFile(join(__dirname,'../privacy.html'),'utf8')
  ]);
  const input = {...approvedFixture(require('../privacy-fields.example.json')),approved:true,effectiveOn:'2000-01-01'};
  const privacyHtml = renderPrivacyNotice(template,input);
  return {cert,server:createStagingServer({tls:{cert,key:privateKey}, origin:base, privacyHtml, access, config:{
    developmentMode:true, accountsEnabled:true, classroomEnabled:true, studyAnalyticsEnabled:true,
    supabaseUrl:api, publishableKey:key, privacyPolicyUrl:base+'/privacy.html'
  }})};
}

function readPreview(path, ca, accessEntry, method = 'GET') {
  const headers = accessEntry ? {Authorization:'Basic '+Buffer.from(accessEntry.username+':'+accessEntry.password).toString('base64')} : {};
  return new Promise((resolve,reject) => {
    const req = request(base+path,{ca,headers,method,timeout:5000},response => {
      let body = '';
      response.setEncoding('utf8').on('data', chunk => {body += chunk;});
      response.once('end',()=>resolve({status:response.statusCode,headers:response.headers,body}));
      response.once('error',reject);
    });
    req.once('timeout',()=>req.destroy(Error('La vista HTTPS no respondió.')));
    req.once('error',reject);
    req.end();
  });
}

async function verifyPrivatePreview(cert) {
  for (const path of ['/', '/?auth=1', '/cloud-config.js', '/privacy.html', '/app.js']) {
    const missing = await readPreview(path,cert,null);
    assert.equal(missing.status,401,path);
    assert.match(missing.headers['www-authenticate'],/^Basic/);
    assert.match(missing.headers['cache-control'],/no-store/);
  }
  assert.equal((await readPreview('/',cert,{...access[0],password:'incorrecto'})).status,401);
  for (const identity of access) {
    const ok = await readPreview('/',cert,identity);
    assert.equal(ok.status,200);
    assert.match(ok.body,/Aprende con Xanny/);
  }
  const cfg = await readPreview('/cloud-config.js',cert,access[0]);
  assert.equal(cfg.status,200);
  assert.match(cfg.body,/"privateStaging":true/);
  assert.ok(access.every(entry=>!cfg.body.includes(entry.password)));
  assert.equal((await readPreview('/sw.js',cert,access[0])).status,404);
  assert.equal((await readPreview('/deploy/access.example.json',cert,access[0])).status,404);
  assert.equal((await readPreview('/privacy.html',cert,access[0],'HEAD')).body,'');
  console.log('Ensayo privado HTTPS: desafío de acceso, dos identidades de prueba, recursos y aviso protegidos.');
}

function queryLocal(sql) {
  try {
    return execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-Atq','-c',sql],
      {encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  } catch {
    throw Error('No se pudo ejecutar la comprobación SQL local.');
  }
}

async function configureLocalPilot() {
  const rows = fixtureMailboxes.map(email => "('" + email + "')").join(',');
  queryLocal('insert into xanny_private.pilot_mailboxes(email) values '+rows);
  const denied = await createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false}})
    .auth.signInWithOtp({email:'unlisted-pilot@example.com',options:{shouldCreateUser:true}});
  assert.equal(denied.error?.status,403,'El hook de Auth debe rechazar un buzón sin autorización.');
  assert.equal(queryLocal("select count(*) from auth.users where email='unlisted-pilot@example.com'"),'0');
  console.log('Supabase Auth rechazó el alta fuera de la lista privada.');
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
  await page.waitForURL(url => url.origin === base);
  assert.equal(await page.evaluate(() => isSecureContext && location.protocol === 'https:'), true);
  await page.getByText(email, {exact: true}).waitFor();
}

async function authData(page) {
  return page.evaluate(() => {
    const authKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    const session = JSON.parse(localStorage.getItem(authKey));
    const progressKey = 'fluentlab_v1:account:' + session.user.id;
    return {token: session.access_token, refresh:session.refresh_token, userId: session.user.id, progressKey};
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

async function browserPage(browser, vendor, faults, accessEntry = access[0]) {
  const context = await browser.newContext({viewport:{width:1360,height:800},serviceWorkers:'block',
    httpCredentials:{...accessEntry,origin:base}});

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


async function finishPilotUnit(page, scope) {
  await show(page,'units');
  await page.locator('[data-a="unitOpen"][data-id="b1-viaje"]').click();
  await page.locator('[data-a="unitSession"][data-session="words"]').click();
  const questions = await page.evaluate(progressKey => {
    const session = UNIT_DATA.find(u=>u.id==='b1-viaje').sessions.find(s=>s.id==='words');
    const ids = JSON.parse(localStorage.getItem(progressKey)).unitRecent['b1-viaje/words'];
    return ids.map(id=>session.questions.find(q=>q.id===id));
  },scope);
  for (const q of questions) {
    if (q.type === 'choice') await page.locator('#unitOption-'+q.options.indexOf(q.answer)).click();
    if (q.type === 'word') await page.locator('#unitShort').fill(q.answers[0]);
    if (q.type === 'order') {
      for (const [index] of q.parts.entries()) await page.locator('#unitToken-'+index).click();
    }
    await page.locator('#unitCheck').click();
    await page.locator('[data-a="unitNext"]').click();
  }
  await page.getByRole('heading',{name:'Sesión finalizada'}).waitFor();
}

async function verifyAccountRemoval(student, unaffected, teacher, group) {
  await show(student,'account');
  await student.getByText('Eliminar cuenta y datos',{exact:true}).click();
  await confirmAction(student,'Solicitar eliminación');
  await student.getByText('Solicitud registrada.',{exact:false}).waitFor();
  const credentials = await authData(student);
  const other = await authData(unaffected);
  const headers = {apikey:key,'Authorization':'Bearer '+credentials.token,'Content-Type':'application/json'};
  assert.match(credentials.userId,/^[0-9a-f-]{36}$/i);
  assert.match(other.userId,/^[0-9a-f-]{36}$/i);

  // La actividad de prueba se registra solo después del consentimiento de esa cuenta.
  assert.equal((await rest(student,'rpc/xanny_analytics_consent',{p_enabled:true})).data,true);
  const event = await fetch(api+'/rest/v1/study_events',{method:'POST',headers,
    body: JSON.stringify({user_id:credentials.userId,kind:'lesson_started',module_id:'a1-1'})});
  assert.equal(event.status,201);

  const adminUrl = api+'/auth/v1/admin/users/'+credentials.userId;
  const denied = await fetch(adminUrl,{method:'DELETE',headers:{apikey:key,Authorization:'Bearer '+other.token}});
  assert.ok([401,403].includes(denied.status),'El segundo alumno no debe poder borrar la cuenta ajena.');

  const relations = [
    ['auth.users','id'],['public.learning_profiles','id'],['public.study_events','user_id'],
    ['public.study_analytics_preferences','user_id'],['public.account_deletion_requests','user_id'],
    ['public.classroom_members','student_id'],['public.classroom_results','student_id']
  ];
  function rows() {
    return queryLocal('select '+relations.map(([table,column]) =>
      "(select count(*) from "+table+" where "+column+"='"+credentials.userId+"')").join(',')).split('|').map(Number);
  }
  assert.deepEqual(rows(),[1,1,1,1,1,1,1],'La prueba debe crear datos en las siete relaciones.');
  const serviceKey = process.env.XANNY_TEST_SERVICE_ROLE;
  if (!serviceKey || serviceKey === key) throw Error('Falta el acceso administrativo del Supabase local de prueba.');
  const admin = createClient(api,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const revoked = await admin.auth.admin.signOut(credentials.token,'global');
  assert.equal(revoked.error,null,'La revocación global de la sesión local debe completarse.');
  const removed = await admin.auth.admin.deleteUser(credentials.userId);
  assert.equal(removed.error,null,'Debe poder borrarse la identidad de prueba desde administración.');
  assert.deepEqual(rows(),[0,0,0,0,0,0,0]);
  assert.equal(queryLocal("select count(*) from public.learning_profiles where id='"+other.userId+"'"),'1');
  const refresh = createClient(api,key,{auth:{persistSession:false,autoRefreshToken:false}});
  assert.ok((await refresh.auth.refreshSession({refresh_token:credentials.refresh})).error,
    'La sesión de una cuenta eliminada no puede renovarse.');
  const recreate = await fetch(api+'/rest/v1/rpc/xanny_sync_progress',{method:'POST',headers,
    body:JSON.stringify({p_account:credentials.userId,p_alias:'Prueba de baja',p_level:'A2',
      p_snapshot:{version:1,level:'A2'},p_revision:null})});
  assert.equal(recreate.ok,false,'Un token anterior no debe recrear la copia borrada.');
  assert.deepEqual(rows(),[0,0,0,0,0,0,0]);
  const report = (await rest(teacher,'rpc/xanny_classroom_report',{p_group:group})).data;
  assert.equal(report.members,0);
  assert.equal(report.totals.completed,0);
  console.log('Eliminación: petición, revocación de sesión y borrado en siete relaciones. El otro alumno conserva su copia.');
}

async function run() {
  if (!api || !key || !db || [api, db, mail].some(url => new URL(url).hostname !== '127.0.0.1')) throw Error('Usa un Supabase local de prueba.');
  const vendor = await readFile(process.env.XANNY_DEV_SDK, 'utf8');
  const {server,cert} = await serve();
  await new Promise(resolve => server.listen(4173, '127.0.0.1', resolve));
  let browser;
  try {
    const pin = process.env.XANNY_TEST_CERT_PIN;
    if (!pin) throw Error('Falta la huella del certificado efímero de ensayo.');
    browser = await chromium.launch({channel: 'chrome',args:['--ignore-certificate-errors-spki-list='+pin]});
    await verifyPrivatePreview(cert);
    await configureLocalPilot();
    const errors = [];
    const one = await browserPage(browser, vendor, errors);
    const privacy = await one.goto(base+'/privacy.html');
    assert.equal(privacy.status(),200);
    assert.match(privacy.headers()['x-robots-tag'],/noindex/);
    await one.getByRole('heading',{name:'Privacidad del piloto'}).waitFor();
    await one.getByRole('heading',{name:'Responsable y contacto'}).waitFor();
    assert.equal(await one.getByText('Plantilla pendiente de aprobación').count(),0);
    const two = await browserPage(browser, vendor, errors, access[1]);
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
    queryLocal("insert into public.study_teachers select id from auth.users where email = 'class-teacher@example.com'");


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

    await finishPilotUnit(one,who.progressKey);
    await show(one,'account');
    await state(one);
    const units = (await rest(one,'learning_profiles?select=snapshot')).data[0].snapshot;
    assert.equal(units.unitSessions['b1-viaje/words'].free.completed,1);
    assert.equal(units.unitDrafts,undefined);

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
    await state(one);
    await verifyAccountRemoval(another,one,teacher,group);
    assert.deepEqual(errors, []);
    console.log('HTTPS, Supabase Auth y Mailpit: tres cuentas verificadas, recuperación en otro navegador y cambio de cuenta.');
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
