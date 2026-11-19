const {createServer} = require('node:https');
const {readFile} = require('node:fs/promises');
const {join, extname} = require('node:path');

const root = join(__dirname, '..');
const types = {'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml',
  '.webmanifest':'application/manifest+json','.png':'image/png'};
const publicFiles = new Set([
  'index.html','privacy.html','styles.css','studio.css','learning.css','icons.svg','xanny.svg',
  'data.js','question-bank.js','mission-transfer.js','missions-data.js','adaptive.js','study-profile.js',
  'progress-sync.js','cloud.js','learning-ui.js','units-data.js','units.js','app.js','manifest.webmanifest',
  'favicon.svg','icon-192.png','icon-512.png','sw.js'
]);

function createStagingServer({tls, origin, config, privacyHtml}) {
  const host = new URL(origin).host;
  return createServer(tls, async (request, response) => {
    if (request.headers.host !== host) return response.writeHead(421).end();
    if (!['GET','HEAD'].includes(request.method)) return response.writeHead(405).end();
    const file = new URL(request.url, origin).pathname.slice(1) || 'index.html';
    const headers = {'Cache-Control':'no-store','Referrer-Policy':'no-referrer',
      'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
    if (file === 'cloud-config.js') {
      response.writeHead(200, {...headers,'Content-Type':'text/javascript; charset=utf-8'});
      return response.end(request.method === 'HEAD' ? undefined : 'window.XANNY_CLOUD_CONFIG = ' + JSON.stringify(config));
    }
    if (!publicFiles.has(file)) return response.writeHead(404, headers).end();
    try {
      const data = file === 'privacy.html' && privacyHtml ? privacyHtml : await readFile(join(root,file));
      if (file === 'privacy.html') {
        headers['Content-Security-Policy'] = "default-src 'self'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
      }
      response.writeHead(200, {...headers,'Content-Type':types[extname(file)]});
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch {
      response.writeHead(404, headers).end();
    }
  });
}

async function main() {
  const env = process.env;
  const origin = new URL(env.XANNY_STAGING_ORIGIN || '');
  const privacy = new URL(env.XANNY_STAGING_PRIVACY_URL || '');
  const key = env.XANNY_STAGING_PUBLISHABLE_KEY || '';
  if (origin.protocol !== 'https:' || origin.hostname.endsWith('.github.io') || origin.pathname !== '/' ||
    origin.username || origin.password || origin.search || origin.hash || privacy.protocol !== 'https:' ||
    privacy.username || privacy.password || privacy.origin !== origin.origin && privacy.hostname.endsWith('.github.io') ||
    !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    throw Error('Usa un origen HTTPS separado, un aviso HTTPS aprobado y la clave publicable de desarrollo.');
  }
  const [cert, privateKey] = await Promise.all([readFile(env.XANNY_TLS_CERT),readFile(env.XANNY_TLS_KEY)]);
  let privacyHtml;
  if (privacy.origin === origin.origin) {
    if (privacy.pathname !== '/privacy.html' || !env.XANNY_STAGING_PRIVACY_FILE) {
      throw Error('Para un aviso en el mismo origen, aporta el HTML aprobado para /privacy.html.');
    }
    privacyHtml = await readFile(env.XANNY_STAGING_PRIVACY_FILE);
    if (!privacyHtml.length || /borrador para pruebas|\[responsable\]/i.test(privacyHtml.toString('utf8'))) {
      throw Error('El aviso local de privacidad todavía es un borrador.');
    }
  }
  const config = {
    accountsEnabled:true, classroomEnabled:true, developmentMode:false,
    studyAnalyticsEnabled:false, visitorAnalyticsEnabled:false,
    supabaseUrl:'https://eoivuyvdohlehygxnmye.supabase.co', publishableKey:key, privacyPolicyUrl:privacy.href
  };
  const port = Number(env.XANNY_STAGING_PORT || origin.port || 443);
  const bind = env.XANNY_STAGING_BIND || '127.0.0.1';
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Puerto de ensayo inválido.');
  createStagingServer({tls:{cert,key:privateKey},origin:origin.origin,config,privacyHtml}).listen(port,bind,() => {
    console.log('Servidor HTTPS de ensayo disponible en ' + origin.origin);
  });
}

if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
module.exports = {createStagingServer};
