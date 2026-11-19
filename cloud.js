/* Adaptador opcional. La aplicación de estudio no depende del proveedor. */
(() => {
  'use strict';
  const cfg = window.XANNY_CLOUD_CONFIG || {};
  const loopback = hostname => hostname === '127.0.0.1' || hostname === 'localhost';
  const dev = cfg.developmentMode === true && loopback(location.hostname);
  const trustedUrl = value => {
    try {
      const url = new URL(value);
      if (url.username || url.password) return null;
      return url.protocol === 'https:' || (dev && url.protocol === 'http:' && loopback(url.hostname)) ? url : null;
    } catch {
      return null;
    }
  };
  const policy = trustedUrl(cfg.privacyPolicyUrl);
  const project = trustedUrl(cfg.supabaseUrl);

  function validPublicKey() {
    const key = cfg.publishableKey;
    if (typeof key !== 'string') return false;
    if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
    if (!dev || !loopback(project?.hostname)) return false;
    try {
      const payload = key.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
      return JSON.parse(atob(payload)).role === 'anon';
    } catch {
      return false;
    }
  }

  const available = () => cfg.accountsEnabled === true && (location.protocol === 'https:' || dev) && Boolean(
    policy && project && project.pathname === '/' && !project.search && !project.hash && validPublicKey()
  );
  const classroomAvailable = () => available() && cfg.classroomEnabled === true;
  const studyAnalyticsAvailable = () => available() && cfg.studyAnalyticsEnabled === true;
  const visitorAnalyticsAvailable = () => cfg.visitorAnalyticsEnabled === true &&
    location.protocol === 'https:' && Boolean(policy && typeof cfg.cloudflareToken === 'string' &&
    /^[A-Za-z0-9_-]{16,120}$/.test(cfg.cloudflareToken));

  let clientPromise;
  async function connect() {
    if (!available()) throw Error('Las cuentas todavía no están habilitadas.');
    if (!clientPromise) {
      clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.3/+esm')
        .then(({createClient}) => createClient(project.origin, cfg.publishableKey, {
          auth: {autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: 'pkce'}
        }))
        .catch(error => {
          clientPromise = null;
          throw error;
        });
    }
    return clientPromise;
  }

  async function currentUser() {
    const db = await connect();
    const {data, error} = await db.auth.getUser();
    if (error?.name === 'AuthSessionMissingError') return null;
    if (error) throw error;
    return data.user;
  }

  async function sendLogin(email, register) {
    const db = await connect();
    const {error} = await db.auth.signInWithOtp({email, options: {
      shouldCreateUser: register,
      emailRedirectTo: location.origin + location.pathname + '?auth=1'
    }});
    if (error) throw error;
  }

  async function logout() {
    const db = await connect();
    const {error} = await db.auth.signOut({scope: 'local'});
    if (error) throw error;
  }

  async function authenticated() {
    const db = await connect();
    const user = await currentUser();
    if (!user) throw Error('Inicia sesión para continuar.');
    return {db, user};
  }


  async function rpc(name, params) {
    const {db} = await authenticated();
    const {data, error} = await db.rpc(name, params);
    if (error) throw error;
    return data;
  }


  async function accountSession(account) {
    const db = await connect();
    const {data, error} = await db.auth.getSession();
    if (error) throw error;
    if (data.session?.user.id !== account) {
      throw Object.assign(Error('Vuelve a iniciar sesión.'), {code: 'AUTH_REQUIRED'});
    }
    // La sesión local selecciona el espacio. PostgreSQL autoriza cada petición mediante el JWT.
    return db;
  }

  function bindProgress(account) {
    return {
      async read() {
        const db = await accountSession(account);
        const {data, error} = await db.from('learning_profiles')
          .select('nickname,level,snapshot,updated_at,revision').eq('id', account).maybeSingle();
        if (error) throw error;
        return data;
      },
      async write(profile, revision) {
        const db = await accountSession(account);
        const snapshot = StudyProfile.snapshot(profile.snapshot);
        if (snapshot?.version !== 1) throw Error('Formato de progreso incompatible.');
        const {data, error} = await db.rpc('xanny_sync_progress', {
          p_account: account, p_alias: profile.nickname, p_level: snapshot.level,
          p_snapshot: snapshot, p_revision: revision
        });
        if (error) throw error;
        return data;
      },
      async readDeletion() {
        const db = await accountSession(account);
        const {data, error} = await db.from('account_deletion_requests')
          .select('requested_at').eq('user_id', account).maybeSingle();
        if (error) throw error;
        return Boolean(data);
      },
      async requestDeletion(requested) {
        const db = await accountSession(account);
        const {data, error} = await db.rpc('xanny_account_deletion_request', {
          p_account: account, p_requested: requested
        });
        if (error) throw error;
        return data;
      }
    };
  }

  async function track(kind, moduleId, score) {
    if (!studyAnalyticsAvailable()) return false;
    const event = StudyProfile.event(kind, moduleId, score);
    if (!event) return false;
    const {db, user} = await authenticated();
    const {error} = await db.from('study_events').insert({user_id: user.id, ...event});
    if (error) throw error;
    return true;
  }

  async function teacherSummary() {
    const {db} = await authenticated();
    const {data, error} = await db.rpc('fluentlab_teacher_overview');
    if (error) throw error;
    return data;
  }

  async function teacherRoster() {
    const {db} = await authenticated();
    const {data, error} = await db.rpc('fluentlab_teacher_roster');
    if (error) throw error;
    return data;
  }


  async function readConsent() {
    const {db, user} = await authenticated();
    const {data, error} = await db.from('study_analytics_preferences').select('enabled').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return data?.enabled === true;
  }

  async function setConsent(value) {
    if (value && !studyAnalyticsAvailable()) throw Error('Analítica desactivada.');
    return rpc('xanny_analytics_consent', {p_enabled: value});
  }

  let beaconStarted = false;
  function startAnonymousVisits() {
    if (beaconStarted || !visitorAnalyticsAvailable()) return;
    beaconStarted = true;
    const tag = document.createElement('script');
    tag.defer = true;
    tag.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    tag.setAttribute('data-cf-beacon', JSON.stringify({token: cfg.cloudflareToken, spa: false}));
    document.head.append(tag);
  }

  window.XannyCloud = {
    available, classroomAvailable, studyAnalyticsAvailable, visitorAnalyticsAvailable,
    privacyPolicyUrl: policy?.href, currentUser, sendLogin, logout, bindProgress,
    track, teacherSummary, teacherRoster, readConsent, setConsent, startAnonymousVisits,
    classroomContext: () => rpc('xanny_classroom_context'),
    createGroup: name => rpc('xanny_create_group', {p_name: name}),
    joinGroup: (code, alias) => rpc('xanny_join_group', {p_code: code, p_alias: alias}),
    rotateInvite: group => rpc('xanny_rotate_invite', {p_group: group}),
    assignMission: (group, mission) => rpc('xanny_assign_mission', {p_group: group, p_mission: mission}),
    classroomReport: group => rpc('xanny_classroom_report', {p_group: group}),
    submitResult: (assignment, result) => rpc('xanny_submit_result', {
      p_assignment: assignment, p_attempt: result.attempt, p_mode: result.mode,
      p_first: result.first, p_assisted: result.assisted, p_revealed: result.revealed,
      p_written: result.written, p_review_due: result.reviewDue
    })
  };
})();
