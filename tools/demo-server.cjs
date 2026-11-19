const {readFile} = require('node:fs/promises');
const {join} = require('node:path');
const {createRenderStagingServer, renderOrigin} = require('./staging-server.cjs');
const {demoDirectory, demoFiles} = require('./build-demo.cjs');

async function createDemoServer({directory = demoDirectory, origin, access}) {
  await readFile(join(directory, 'index.html'));
  const privacyHtml = await readFile(join(directory, 'privacy.html'), 'utf8');
  return createRenderStagingServer({
    directory, origin, access, privacyHtml, files:demoFiles,
    siteHeaders:{
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'Permissions-Policy':'camera=(), microphone=(), geolocation=()'
    }
  });
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
