const http = require('node:http');
const https = require('node:https');
const {createHash, timingSafeEqual} = require('node:crypto');
const {readFile} = require('node:fs/promises');
const {join, extname} = require('node:path');
const {renderPrivacyNotice} = require('./privacy-notice.cjs');

const root = join(__dirname, '..');
const devProject = 'https://eoivuyvdohlehygxnmye.supabase.co';
const types = {'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml',
  '.webmanifest':'application/manifest+json','.png':'image/png'};
const assets = new Set([
  'index.html','privacy.html','styles.css','studio.css','learning.css','icons.svg','xanny.svg',
  'data.js','question-bank.js','mission-transfer.js','missions-data.js','adaptive.js','study-profile.js',
  'progress-sync.js','cloud.js','learning-ui.js','units-data.js','units.js','app.js','manifest.webmanifest',
  'favicon.svg','icon-192.png','icon-512.png'
]);

function accessGate(access) {
  if (!Array.isArray(access) || !access.length || access.length > 50) throw Error('Define entre 1 y 50 accesos privados.');
  const names = new Set();
  const hashes = access.map(entry => {
    if (typeof entry?.username !== 'string' || !/^[A-Za-z0-9._-]{1,40}$/.test(entry.username) ||
      names.has(entry.username) || typeof entry.password !== 'string' || !/^[!-~]{32,120}$/.test(entry.password)) {
      throw Error('Cada acceso requiere un identificador único y un secreto de al menos 32 caracteres.');
    }
    names.add(entry.username);
    return createHash('sha256').update(entry.username + ':' + entry.password).digest();
  });

  return header => {
    if (typeof header !== 'string') return false;
    const match = /^Basic ([A-Za-z0-9+/]{1,220}={0,2})$/i.exec(header);
    if (!match) return false;
    const candidate = createHash('sha256').update(Buffer.from(match[1], 'base64')).digest();
    let allowed = false;
    for (const expected of hashes) allowed = timingSafeEqual(candidate, expected) || allowed;
    return allowed;
  };
}

function stagingHandler({origin, config, privacyHtml, access}, renderEdge) {
  const target = new URL(origin);
  if (target.protocol !== 'https:' || !privacyHtml) throw Error('Se requiere HTTPS y un aviso de privacidad.');
  const authorized = accessGate(access);
  const bootConfig = 'window.XANNY_CLOUD_CONFIG = ' + JSON.stringify({...config,privateStaging:true});
  return async (request, response) => {
    const headers = {
      'Cache-Control':'private, no-store', 'Vary':'Authorization', 'Referrer-Policy':'no-referrer',
      'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY',
      'X-Robots-Tag':'noindex, nofollow', 'Strict-Transport-Security':'max-age=86400'
    };
    if (request.headers.host !== target.host) return response.writeHead(421, headers).end();
    if (renderEdge && request.url === '/healthz' && ['GET','HEAD'].includes(request.method)) {
      return response.writeHead(204, headers).end();
    }
    if (renderEdge && request.headers['x-forwarded-proto'] !== 'https') {
      return response.writeHead(403, headers).end();
    }
    if (!authorized(request.headers.authorization)) {
      return response.writeHead(401, {...headers,'WWW-Authenticate':'Basic realm="Xanny ensayo", charset="UTF-8"'}).end();
    }
    if (!['GET','HEAD'].includes(request.method)) return response.writeHead(405, {...headers,Allow:'GET, HEAD'}).end();

    let url;
    try { url = new URL(request.url, target); } catch { return response.writeHead(400, headers).end(); }
    if (url.origin !== target.origin) return response.writeHead(421, headers).end();
    const file = url.pathname.slice(1) || 'index.html';
    if (file === 'cloud-config.js') {
      response.writeHead(200, {...headers,'Content-Type':'text/javascript; charset=utf-8'});
      return response.end(request.method === 'HEAD' ? undefined : bootConfig);
    }
    if (!assets.has(file)) return response.writeHead(404, headers).end();
    try {
      const data = file === 'privacy.html' ? privacyHtml : await readFile(join(root,file));
      if (file === 'privacy.html') {
        headers['Content-Security-Policy'] = "default-src 'self'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
      }
      response.writeHead(200, {...headers,'Content-Type':types[extname(file)]});
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch {
      response.writeHead(404, headers).end();
    }
  };
}

function createStagingServer({tls, ...options}) {
  return https.createServer({...tls, maxHeaderSize:8192}, stagingHandler(options, false));
}

function createRenderStagingServer(options) {
  return http.createServer({maxHeaderSize:8192}, stagingHandler(options, true));
}

async function main() {
  const env = process.env;
  const render = process.argv.includes('--render');
  if (render && env.RENDER !== 'true') throw Error('El modo Render requiere su proxy HTTPS gestionado.');
  const origin = new URL((render ? env.RENDER_EXTERNAL_URL : env.XANNY_STAGING_ORIGIN) || '');
  if (render && (!origin.hostname.endsWith('.onrender.com') || origin.port)) {
    throw Error('Usa el origen HTTPS onrender.com del servicio de ensayo.');
  }
  const key = env.XANNY_STAGING_PUBLISHABLE_KEY || '';
  if (origin.protocol !== 'https:' || origin.hostname.endsWith('.github.io') || origin.pathname !== '/' ||
    origin.username || origin.password || origin.search || origin.hash || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    throw Error('Configura un origen HTTPS separado y la clave publicable de xanny-dev.');
  }
  const [template, ownerFile, accessFile] = await Promise.all([
    readFile(join(root,'privacy.html'),'utf8'),
    readFile(env.XANNY_STAGING_PRIVACY_JSON,'utf8'), readFile(env.XANNY_STAGING_ACCESS_FILE,'utf8')
  ]);
  const privacyHtml = renderPrivacyNotice(template, JSON.parse(ownerFile));
  const access = JSON.parse(accessFile);
  const config = {
    accountsEnabled:true, classroomEnabled:true, developmentMode:false,
    studyAnalyticsEnabled:false, visitorAnalyticsEnabled:false,
    supabaseUrl:devProject, publishableKey:key, privacyPolicyUrl:new URL('/privacy.html',origin).href
  };
  const port = Number(render ? env.PORT : env.XANNY_STAGING_PORT || origin.port || 443);
  const bind = render ? '0.0.0.0' : env.XANNY_STAGING_BIND || '127.0.0.1';
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Puerto de ensayo inválido.');
  const options = {origin:origin.origin,config,privacyHtml,access};
  let server;
  if (render) {
    server = createRenderStagingServer(options);
  } else {
    const [cert, privateKey] = await Promise.all([readFile(env.XANNY_TLS_CERT), readFile(env.XANNY_TLS_KEY)]);
    server = createStagingServer({...options,tls:{cert,key:privateKey}});
  }
  server.listen(port,bind,() => {
    console.log('Servidor HTTPS privado de ensayo listo en ' + origin.origin);
  });
}

// Mensajes de inicio sin mostrar contenido de archivos de configuración o credenciales.
if (require.main === module) main().catch(error => {
  console.error(error instanceof SyntaxError ? 'Un archivo JSON de configuración no es válido.' : error.message);
  process.exitCode = 1;
});
module.exports = {createStagingServer, createRenderStagingServer};
