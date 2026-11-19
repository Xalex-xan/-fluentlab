/* Sincronización de una cuenta. El almacenamiento local precede a cada escritura remota. */
const ProgressSync = (() => {
  const labels = {
    saved: 'Guardado', syncing: 'Sincronizando', offline: 'Sin conexión',
    pending: 'Cambios pendientes', error: 'Error de sincronización'
  };
  const wait = 1800;
  const maxWait = 10000;
  const refreshInterval = 30000;

  function ordered(value) {
    if (Array.isArray(value)) return value.map(ordered);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
  }

  async function capture(value) {
    const json = JSON.stringify(ordered(value));
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
    return {value: JSON.parse(json), hash: Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')};
  }

  function create(options) {
    let base = options.readMeta() || {};
    let state = {kind: 'pending'};
    let busy = false;
    let stopped = false;
    let initialized = false;
    let needsCheck = true;
    let timer;
    let dirtySince = null;
    let lastCheck = 0;
    let failures = 0;
    let again = false;
    let changeNumber = 0;

    function show(kind, fields = {}) {
      state = {kind, updatedAt: base.updatedAt || '', ...fields};
      options.onState(state);
    }

    function later(ms) {
      clearTimeout(timer);
      timer = setTimeout(() => void run(), ms);
    }

    function queue() {
      if (stopped) return;
      changeNumber++;
      if (state.conflict || state.login) return;
      if (!options.online()) {
        show('offline');
        return;
      }
      if (!busy) show('pending');
      dirtySince ??= Date.now();
      later(Math.max(0, Math.min(wait, maxWait - (Date.now() - dirtySince))));
    }

    function settle(remote, hash) {
      base = {revision: remote.revision, updatedAt: remote.updated_at, hash};
      options.writeMeta(base);
      initialized = true;
      failures = 0;
      show('saved');
    }

    async function read() {
      const row = await options.readRemote();
      if (row && (!row.revision || row.snapshot?.version !== 1)) {
        throw Error('Copia remota incompatible.');
      }
      lastCheck = Date.now();
      needsCheck = false;
      return row;
    }

    function conflict(remote) {
      show('pending', {conflict: true, remoteRevision: remote?.revision ?? null, remoteDate: remote?.updated_at ?? ''});
    }

    function apply(row, cloudCopy) {
      options.applyLocal(cloudCopy.value, options.readLocal());
      settle(row, cloudCopy.hash);
    }

    async function push(local, revision) {
      const written = await options.writeRemote(local.value, revision);
      if (stopped) return;
      if (!written?.revision) throw Error('El servidor no confirmó el guardado.');
      settle(written, local.hash);
    }

    function fail(error) {
      if (stopped) return;
      needsCheck = true;
      if (!options.online()) {
        show('offline');
        return;
      }
      const login = error?.code === 'AUTH_REQUIRED' || error?.code === 'PGRST301' ||
        error?.name === 'AuthSessionMissingError' || error?.status === 401;
      show('error', {login});
      if (!login) later(Math.min(60000, 2500 * 2 ** Math.min(5, failures++)));
    }

    async function run(check = false, decision = null) {
      if (stopped) return;
      if (busy) {
        again = true;
        needsCheck ||= check;
        return;
      }
      if (!options.online()) {
        show('offline', state.conflict ? {conflict: true, remoteRevision: state.remoteRevision, remoteDate: state.remoteDate} : {});
        return;
      }
      if (state.conflict && !check && !decision) return;
      clearTimeout(timer);
      dirtySince = null;
      const expectedChoice = state.conflict ? state.remoteRevision : undefined;
      busy = true;
      show('syncing');
      let seenChange = changeNumber;
      try {
        let remote;
        const refresh = check || decision || needsCheck || !initialized;
        let local = await capture(options.readLocal());
        if (refresh) {
          remote = await read();
          if (stopped) return;
          const known = options.hasLocal();
          seenChange = changeNumber;
          local = await capture(options.readLocal());
          if (stopped) return;
          if (decision && expectedChoice !== undefined && expectedChoice !== (remote?.revision ?? null)) {
            conflict(remote);
            return;
          }
          if (decision === 'restore') {
            if (!remote) {
              conflict(null);
              return;
            }
            const cloudCopy = await capture(options.convertRemote(remote));
            if (!stopped) apply(remote, cloudCopy);
            return;
          }
          if (decision === 'keep') {
            if (remote) options.archive(options.convertRemote(remote));
            await push(local, remote?.revision ?? null);
            return;
          }

          if (remote) {
            const other = await capture(options.convertRemote(remote));
            if (stopped) return;
            if (other.hash === local.hash) {
              settle(remote, local.hash);
              return;
            }
            if (remote.revision !== base.revision) {
              if ((base.hash && local.hash === base.hash) || (!base.revision && !known && seenChange === changeNumber)) {
                // A missed edit during an asynchronous refresh may never be replaced.
                if (seenChange !== changeNumber) {
                  conflict(remote);
                  return;
                }
                apply(remote, other);
                return;
              }
              conflict(remote);
              return;
            }
          } else if (base.revision) {
            conflict(null);
            return;
          }
        }
        if (stopped) return;
        if (base.hash === local.hash && base.revision) {
          initialized = true;
          show('saved');
        } else {
          await push(local, remote?.revision ?? base.revision ?? null);
        }
      } catch (error) {
        if (!stopped && error?.code === '40001') {
          try {
            const latest = await read();
            if (stopped) return;
            const local = await capture(options.readLocal());
            const other = latest && await capture(options.convertRemote(latest));
            if (stopped) return;
            if (other?.hash === local.hash) settle(latest, local.hash);
            else conflict(latest);
          } catch (nextError) {
            fail(nextError);
          }
        } else {
          fail(error);
        }
      } finally {
        busy = false;
        const requested = again || changeNumber !== seenChange;
        again = false;
        if (requested && !stopped && !state.conflict && !state.login && state.kind !== 'error' && options.online()) queue();
      }
    }

    return {
      queue,
      check: () => run(true),
      focus: () => { if (Date.now() - lastCheck >= refreshInterval && !state.login) void run(true); },
      restore: () => run(true, 'restore'),
      keep: () => run(true, 'keep'),
      offline: () => {
        clearTimeout(timer);
        if (state.conflict) show('offline', {conflict: true, remoteRevision: state.remoteRevision, remoteDate: state.remoteDate});
        else show('offline');
      },
      stop: () => {stopped = true; clearTimeout(timer);}
    };
  }

  return {create, labels};
})();
