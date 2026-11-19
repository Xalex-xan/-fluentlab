const {readFile} = require('node:fs/promises');
const {createHash, timingSafeEqual} = require('node:crypto');
const {join} = require('node:path');
const {createRenderStagingServer, renderOrigin} = require('./staging-server.cjs');
const {demoDirectory, demoFiles} = require('./build-demo.cjs');

const INVITE_COOKIE = '__Host-xanny_demo';
const INVITE_SALT = 'xanny-demo-mobile-invite-v1:';

function invitationToken(entry) {
  return createHash('sha256').update(INVITE_SALT + entry.username + ':' + entry.password).digest('base64url');
}

function attachMobileInvites(server, access, origin) {
  const credentialList = access.map(entry => ({
    ticket: invitationToken(entry),
    authorization: 'Basic ' + Buffer.from(entry.username + ':' + entry.password).toString('base64')
  }));
  function matchingTicket(ticket) {
    if (typeof ticket !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) return null;
    const actual = Buffer.from(ticket);
    let match = null;
    for (const candidate of credentialList) {
      if (timingSafeEqual(actual, Buffer.from(candidate.ticket))) match = candidate;
    }
    return match;
  }
  const script = '(async()=>{const status=document.getElementById("status");const token=location.hash.slice(1);history.replaceState(null,"","/invite");if(!/^[A-Za-z0-9_-]{43}$/.test(token)){status.textContent="Falta el código del enlace. Solicita tu invitación personal.";return;}try{const response=await fetch("/invite",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});if(!response.ok)throw Error("invalid");location.replace("/");}catch{status.textContent="No pudimos validar esta invitación. Abre nuevamente el enlace completo o solicita otro.";}})();';
  const page = [
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Entrar · Aprende con Xanny</title><meta name="robots" content="noindex,nofollow"></head>',
    '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#161323;color:#f7f3ff;font:17px system-ui,sans-serif;text-align:center">',
    '<main style="padding:24px;max-width:420px"><div style="font-size:54px">🐈‍⬛</div><h1>Aprende con Xanny</h1>',
    '<p id="status" role="status">Comprobando tu invitación privada…</p>',
    '<p style="font-size:14px;color:#bfb6d5">No necesitas descargar nada ni escribir una contraseña.</p></main>',
    '<script>'+script+'</script></body></html>'
  ].join('');
  const basicHandler = server.listeners('request')[0];
  if (typeof basicHandler !== 'function') throw Error('El servidor de demostración no tiene controlador HTTP.');
  server.removeListener('request', basicHandler);
  server.on('request', (req, res) => {
    if (req.url === '/invite' && req.headers.host === new URL(origin).host && req.headers['x-forwarded-proto'] === 'https') {
      const secureHeaders = {
        'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer',
        'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY',
        'X-Robots-Tag':'noindex, nofollow',
        'Content-Security-Policy':"default-src 'none'; script-src 'sha256-" + createHash('sha256').update(script).digest('base64') + "'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
      };
      if (req.method === 'GET' || req.method === 'HEAD') {
        return res.writeHead(200, {...secureHeaders,'Content-Type':'text/html; charset=utf-8'}).end(req.method === 'HEAD' ? undefined : page);
      }
      if (req.method !== 'POST') return res.writeHead(405, {...secureHeaders,Allow:'GET, HEAD, POST'}).end();
      if ((req.headers.origin && req.headers.origin !== origin) || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
        return res.writeHead(403, secureHeaders).end();
      }
      const parts = [];
      let length = 0;
      req.on('data', chunk => {
        length += chunk.length;
        if (length > 1024) { res.writeHead(413, secureHeaders).end(); req.destroy(); return; }
        parts.push(chunk);
      });
      req.on('end', () => {
        if (res.writableEnded) return;
        let ticket;
        try { ticket = JSON.parse(Buffer.concat(parts).toString('utf8')).token; }
        catch { return res.writeHead(400, secureHeaders).end(); }
        if (!matchingTicket(ticket)) return res.writeHead(403, secureHeaders).end();
        res.writeHead(204, {...secureHeaders,
          'Set-Cookie': INVITE_COOKIE + '=' + ticket + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800'
        }).end();
      });
      req.on('error', () => { if (!res.writableEnded) res.writeHead(400, secureHeaders).end(); });
      return;
    }
    const cookie = (req.headers.cookie || '').split(';').map(value=>value.trim())
      .find(value=>value.startsWith(INVITE_COOKIE+'='));
    const authorized = matchingTicket(cookie && cookie.slice(INVITE_COOKIE.length+1));
    // A valid invitation cookie takes priority over stale browser Basic Auth credentials.
    if (authorized) req.headers.authorization = authorized.authorization;
    return basicHandler(req, res);
  });
  return server;
}

async function createDemoServer({directory = demoDirectory, origin, access}) {
  await readFile(join(directory, 'index.html'));
  const privacyHtml = await readFile(join(directory, 'privacy.html'), 'utf8');
  const server = createRenderStagingServer({
    directory, origin, access, privacyHtml, files:demoFiles,
    siteHeaders:{
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'Permissions-Policy':'camera=(), microphone=(), geolocation=()'
    }
  });
  return attachMobileInvites(server, access, origin);
}

async function main() {
  const origin = renderOrigin(process.env);
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Puerto de demostración inválido.');
  // Prefer Render's private environment setting when available; the local file remains supported.
  const accessSource = process.env.XANNY_DEMO_ACCESS_JSON ||
    await readFile(process.env.XANNY_DEMO_ACCESS_FILE, 'utf8');
  const access = JSON.parse(accessSource);
  const server = await createDemoServer({origin:origin.origin,access});
  server.listen(port, '0.0.0.0', () => console.log('Demostración privada lista en ' + origin.origin));
}

if (require.main === module) main().catch(error => {
  console.error(error instanceof SyntaxError ? 'El archivo de accesos no es válido.' : error.message);
  process.exitCode = 1;
});
module.exports = {createDemoServer};
