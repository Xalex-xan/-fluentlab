const sections = [
  ['Responsable y contacto', [
    ['controller.name','Identidad del responsable'], ['controller.contact','Contacto de privacidad'],
    ['controller.scope','Ámbito y jurisdicción'], ['effectiveOn','Fecha de vigencia']
  ]],
  ['Finalidades y fundamento', [
    ['purposes.account','Cuenta y autenticación'], ['purposes.progress','Progreso y sincronización'],
    ['purposes.classroom','Participación en clases'], ['purposes.analytics','Analítica opcional']
  ]],
  ['Proveedores y ubicación', [
    ['processors.hosting','Alojamiento y tratamiento de datos'], ['processors.email','Autenticación y envío de correos'],
    ['processors.transfers','Ubicación y transferencias']
  ]],
  ['Conservación y eliminación', [
    ['retention.account','Cuenta y credenciales de sesión'], ['retention.progress','Progreso y resultados'],
    ['retention.classroom','Datos de clase y entregas'], ['retention.logs','Registros y analítica'],
    ['retention.backups','Respaldos']
  ]],
  ['Derechos y participación', [
    ['rights.requests','Acceso, rectificación y eliminación'], ['rights.complaints','Canal de reclamaciones'],
    ['minors','Condiciones de participación de menores']
  ]]
];

const start = '<!-- privacy-owner:start -->';
const end = '<!-- privacy-owner:end -->';
const fields = sections.flatMap(([, group]) => group);

function read(value, path) {
  return path.split('.').reduce((item,key) => item && Object.hasOwn(item, key) ? item[key] : undefined, value);
}

function escape(value) {
  return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value+'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
}

function renderPrivacyNotice(template, input) {
  const index = template.indexOf(start);
  const endIndex = template.indexOf(end);
  if (index < 0 || endIndex <= index) throw Error('Faltan los marcadores del aviso de privacidad.');
  if (!input || input.approved !== true) throw Error('El aviso requiere aprobación del responsable.');
  const normalized = new Map();
  const missing = fields.flatMap(([path]) => {
    const raw = read(input,path);
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || value.length > 4000 || (path === 'effectiveOn' && !validDate(value))) return [path];
    normalized.set(path, value);
    return [];
  });
  if (missing.length) throw Error('Campos incompletos del aviso: ' + missing.join(', '));

  const body = sections.map(([title,group],i) =>
    '<section class="card mt" aria-labelledby="privacy-fields-' + i + '">' +
    '<h2 id="privacy-fields-' + i + '">' + escape(title) + '</h2><dl class="privacy-fields">' +
    group.map(([path,label]) => '<dt>' + escape(label) + '</dt><dd>' + escape(normalized.get(path)) + '</dd>').join('') +
    '</dl></section>').join('\n');
  return template.slice(0,index) + body + template.slice(endIndex + end.length);
}

module.exports = {renderPrivacyNotice};
