const assert = require('node:assert/strict');
const {once} = require('node:events');
const {request} = require('node:http');
const {randomBytes} = require('node:crypto');
const {test} = require('node:test');
const {createRenderStagingServer} = require('../tools/staging-server.cjs');

function get(port, path, headers, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({hostname: '127.0.0.1', port, path, method, headers}, res => {
      let body = '';
      res.setEncoding('utf8').on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({status:res.statusCode, headers:res.headers, body}));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

test('Render mantiene privado el piloto detrás de HTTPS', async t => {
  const host = 'xanny-test.onrender.com';
  const password = randomBytes(32).toString('hex');
  const access = [{username:'tester',password}];
  const config = {accountsEnabled:true, studyAnalyticsEnabled:false};
  const options = {origin:'https://' + host, config, privacyHtml:'<h1>Aviso aprobado de prueba</h1>', access};
  assert.throws(() => createRenderStagingServer({...options,access:[]}), /accesos privados/);
  const server = createRenderStagingServer(options);
  server.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await once(server, 'listening');
  const {port} = server.address();
  const headers = {host,'x-forwarded-proto':'https'};
  const authorized = {...headers,authorization:'Basic ' + Buffer.from('tester:' + password).toString('base64')};
  const health = await get(port, '/healthz', {host});
  assert.equal(health.status, 204);
  assert.equal(health.body, '');
  assert.equal((await get(port, '/healthz', {host:'otro.onrender.com'})).status, 421);
  for (const path of ['/', '/?auth=1', '/app.js', '/units-data.js', '/xanny.svg', '/privacy.html', '/cloud-config.js', '/healthz?probe=1']) {
    const response = await get(port, path, headers);
    assert.equal(response.status, 401, path);
    assert.equal(response.body, '');
    assert.match(response.headers['www-authenticate'], /^Basic /);
    assert.equal(response.headers['cache-control'], 'private, no-store');
  }
  assert.equal((await get(port, '/', {...headers,authorization:'Basic dGVzdGVyOmludmFsaWRv'})).status, 401);
  assert.equal((await get(port, '/', {...authorized,'x-forwarded-proto':'http'})).status, 403);
  assert.equal((await get(port, '/', {host,authorization:authorized.authorization})).status, 403);
  assert.match((await get(port, '/', authorized)).body, /Aprende con Xanny/);
  const notice = await get(port, '/privacy.html', authorized);
  assert.equal(notice.status, 200);
  assert.match(notice.body, /Aviso aprobado de prueba/);
  assert.match(notice.headers['content-security-policy'], /script-src 'none'/);
  const boot = await get(port, '/cloud-config.js', authorized);
  assert.equal(boot.status, 200);
  assert.match(boot.body, /"privateStaging":true/);
  assert.match(boot.body, /"studyAnalyticsEnabled":false/);
  assert.equal(boot.headers['x-robots-tag'], 'noindex, nofollow');
  for (const path of ['/sw.js', '/render.yaml', '/access.json', '/privacy.json']) {
    assert.equal((await get(port, path, authorized)).status, 404);
  }
  assert.equal((await get(port, '/', authorized, 'POST')).status, 405);
});
