const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {webcrypto} = require('node:crypto');
const assert = require('node:assert/strict');
const test = require('node:test');

const source = readFileSync(join(__dirname, '../progress-sync.js'), 'utf8');
const makeController = new Function('crypto', 'setTimeout', 'clearTimeout', source + '\nreturn ProgressSync;');
const copy = value => structuredClone(value);
const payload = xp => ({nickname:'Estudiante', snapshot:{version:1, level:'B1', xp}});

function service() {
  return {
    row: null, reads: 0, writes: 0, fail: null,
    async read() {
      this.reads++;
      return copy(this.row);
    },
    async write(value, revision) {
      if (this.fail) throw this.fail;
      if ((this.row?.revision ?? null) !== revision) throw Object.assign(Error('conflict'),{code:'40001'});
      this.writes++;
      this.row = {...copy(value), revision:String(this.writes), updated_at:'2026-11-19T08:00:00Z'};
      return copy(this.row);
    }
  };
}

function device(server) {
  const d = {local:payload(0), meta:null, has:false, online:true, state:null, archived:[], pending:new Map()};
  const sdk = makeController(webcrypto, fn => {
    const id = Symbol();
    d.pending.set(id,fn);
    return id;
  }, id => d.pending.delete(id));
  d.start = () => sdk.create({
    readLocal: () => d.local, online: () => d.online, hasLocal: () => d.has,
    readMeta: () => d.meta, writeMeta: meta => {d.meta = meta;},
    readRemote: () => server.read(), writeRemote: (value, revision) => server.write(value, revision),
    convertRemote: row => ({nickname:row.nickname, snapshot:row.snapshot}),
    applyLocal: (value, previous) => {d.archived.push(copy(previous)); d.local = copy(value); d.has = true;},
    archive: value => d.archived.push(copy(value)),
    onState: state => {d.state = state; d.onState?.(state);}
  });
  d.change = xp => {d.local = payload(xp); d.has = true; d.sync.queue();};
  d.sync = d.start();
  return d;
}

test('agrupa cambios y conserva la actividad pendiente después de recrear el sincronizador', async () => {
  const server = service(), d = device(server);
  await d.sync.check();
  assert.equal(server.writes, 1);
  d.change(1);
  d.change(2);
  d.change(3);
  assert.equal(d.pending.size, 1);
  assert.equal(d.state.kind, 'pending');
  await new Promise(resolve => {
    d.onState = state => {if (state.kind === 'saved') resolve();};
    [...d.pending.values()][0]();
  });
  assert.equal(server.writes, 2);
  assert.equal(server.reads, 1);
  assert.equal(server.row.snapshot.xp, 3);
  d.online = false;
  d.change(8);
  assert.equal(d.state.kind, 'offline');
  d.sync.stop();
  d.sync = d.start();
  d.online = true;
  await d.sync.check();
  assert.equal(server.row.snapshot.xp, 8);
  assert.equal(d.state.kind, 'saved');
});

test('una revisión concurrente exige decisión y conserva ambas versiones', async () => {
  const server = service(), a = device(server), b = device(server);
  await a.sync.check();
  a.change(12);
  await a.sync.check();
  await b.sync.check();
  assert.equal(b.local.snapshot.xp, 12);
  b.change(33);
  a.change(41);
  await a.sync.check();
  await b.sync.check();
  assert.equal(b.state.conflict, true);
  assert.equal(server.row.snapshot.xp, 41);
  assert.equal(b.local.snapshot.xp, 33);
  await b.sync.keep();
  assert.equal(server.row.snapshot.xp, 33);
  assert.equal(b.archived.at(-1).snapshot.xp, 41);
  await a.sync.check();
  assert.equal(a.local.snapshot.xp, 33);
});

test('un fallo de servidor o de sesión conserva la copia local', async () => {
  const server = service(), d = device(server);
  await d.sync.check();
  d.change(18);
  server.fail = Error('Servidor temporalmente no disponible');
  await d.sync.check();
  assert.equal(d.state.kind, 'error');
  assert.equal(d.local.snapshot.xp, 18);
  assert.equal(server.row.snapshot.xp, 0);
  server.fail = Object.assign(Error('Sesión caducada'),{code:'AUTH_REQUIRED'});
  await d.sync.check();
  assert.equal(d.state.login, true);
  assert.equal(d.local.snapshot.xp, 18);
  server.fail = null;
  await d.sync.check();
  assert.equal(server.row.snapshot.xp, 18);
  assert.equal(d.state.kind, 'saved');
});
