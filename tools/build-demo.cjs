const {copyFile, mkdir, readFile, readdir, writeFile} = require('node:fs/promises');
const {join} = require('node:path');

const root = join(__dirname, '..');
const demoDirectory = join(root, 'dist-demo');
const sharedFiles = [
  'adaptive.js', 'app.js', 'data.js', 'favicon.svg', 'icon-192.png', 'icons.svg',
  'learning.css', 'learning-ui.js', 'mission-transfer.js', 'missions-data.js',
  'progress-sync.js', 'question-bank.js', 'studio.css', 'study-profile.js',
  'styles.css', 'units-data.js', 'units.js', 'xanny.svg'
];
const editionFiles = ['demo.css', 'demo.js', 'privacy.html'];
const demoFiles = new Set([...sharedFiles, ...editionFiles, 'index.html']);

function once(template, pattern, replacement) {
  if (!pattern.test(template)) throw Error('La plantilla cambió: ' + pattern.source);
  return template.replace(pattern, replacement);
}

async function buildDemo(directory = demoDirectory) {
  await mkdir(directory, {recursive:true});
  if ((await readdir(directory)).length) throw Error('Usa un directorio de salida vacío para la demostración.');
  let html = await readFile(join(root, 'index.html'), 'utf8');
  html = once(html, /<title>.*<\/title>/, '<title>Demostración · Aprende con Xanny</title>');
  html = once(html, /<\/head>/, '  <meta name="robots" content="noindex,nofollow">\n  <link rel="stylesheet" href="demo.css">\n</head>');
  for (const name of ['cloud-config', 'cloud']) {
    html = once(html, new RegExp('^.*src="' + name + '\\.js\\?[^"]+"[^\\n]*\\n', 'm'), '');
  }
  html = once(html, /^.*rel="manifest"[^\n]*\n/m, '');
  html = once(html, /  <script src="app\.js/, '  <script src="demo.js"></script>\n  <script src="app.js');
  await Promise.all([
    writeFile(join(directory, 'index.html'), html),
    ...sharedFiles.map(file => copyFile(join(root,file), join(directory,file))),
    ...editionFiles.map(file => copyFile(join(root,'demo',file), join(directory,file)))
  ]);
}

if (require.main === module) {
  buildDemo().then(() => console.log('Demostración preparada en dist-demo.')).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = {buildDemo, demoDirectory, demoFiles};
