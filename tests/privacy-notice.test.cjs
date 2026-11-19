const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const {renderPrivacyNotice} = require('../tools/privacy-notice.cjs');
const {createStagingServer} = require('../tools/staging-server.cjs');
const template = readFileSync(join(__dirname,'../privacy.html'),'utf8');
const blank = require('../privacy-fields.example.json');

function synthetic(value) {
  if (typeof value === 'string') return 'Dato sintético de la prueba';
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,field])=>[key,synthetic(field)]));
  return value;
}

function approved() {
  return {...synthetic(blank),approved:true,effectiveOn:'2000-01-01'};
}

test('un aviso sin aprobación o con campos legales vacíos bloquea el arranque', () => {
  assert.throws(()=>renderPrivacyNotice(template,blank),/aprobación/);
  assert.throws(()=>renderPrivacyNotice(template,{...blank,approved:true}),/controller\.name.*retention\.backups/);
  assert.throws(()=>renderPrivacyNotice(template,{...approved(),effectiveOn:'2026-02-31'}),/effectiveOn/);
});

test('el servidor sirve los campos aprobados sin insertar HTML ni datos ajenos al aviso', () => {
  const input = approved();
  input.controller.name = '<img src=x onerror=alert(1)>';
  input.privateValue = 'NO PUBLICAR ESTA PROPIEDAD';
  const html = renderPrivacyNotice(template,input);
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html,/Canal de reclamaciones/);
  assert.doesNotMatch(html,/<img src=x|NO PUBLICAR|Plantilla pendiente de aprobación/);
});

test('el despliegue rechaza HTTP, accesos vacíos y secretos débiles', () => {
  const params = {tls:{},origin:'https://example.test',config:{},privacyHtml:'<h1>Aviso sintético</h1>'};
  assert.throws(()=>createStagingServer({...params,origin:'http://example.test'}),/HTTPS/);
  assert.throws(()=>createStagingServer({...params,access:[]}),/accesos privados/);
  assert.throws(()=>createStagingServer({...params,access:[{username:'usuario-ci',password:'corto'}]}),/32 caracteres/);
});
