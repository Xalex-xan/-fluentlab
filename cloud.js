/* Adaptador opcional. La aplicación de estudio no depende del proveedor. */
(() => {
  'use strict';
  const cfg = window.XANNY_CLOUD_CONFIG || {};
  const httpsUrl = value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url : null;
    } catch {
      return null;
    }
  };
  const policy = httpsUrl(cfg.privacyPolicyUrl);
  const project = httpsUrl(cfg.supabaseUrl);
  const available = () => cfg.accountsEnabled === true && location.protocol === 'https:' && Boolean(
    policy && project && project.pathname === '/' && !project.search && !project.hash &&
    typeof cfg.publishableKey === 'string' && /^sb_publishable_[A-Za-z0-9_-]+$/.test(cfg.publishableKey)
  );
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
    const {error} = await db.auth.signOut();
    if (error) throw error;
  }

  async function authenticated() {
    const db = await connect();
    const user = await currentUser();
    if (!user) throw Error('Inicia sesión para continuar.');
    return {db, user};
  }

  async function saveProfile(profile) {
    const {db, user} = await authenticated();
    const snapshot = StudyProfile.snapshot(profile.snapshot);
    if (!snapshot || snapshot.version !== 1) throw Error('Formato de progreso incompatible.');
    const {data, error} = await db.from('learning_profiles').upsert({
      id: user.id, nickname: profile.nickname, level: profile.level, snapshot
    }, {onConflict: 'id'}).select('nickname,level,updated_at').single();
    if (error) throw error;
    return data;
  }

  async function readProfile() {
    const {db, user} = await authenticated();
    const {data, error} = await db.from('learning_profiles')
      .select('nickname,level,snapshot,updated_at').eq('id', user.id).maybeSingle();
    if (error) throw error;
    return data;
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

  window.XannyCloud = {
    available, studyAnalyticsAvailable, visitorAnalyticsAvailable, privacyPolicyUrl: policy?.href,
    currentUser, sendLogin, logout, saveProfile, readProfile, track, teacherSummary, teacherRoster
  };

  if (visitorAnalyticsAvailable()) {
    const tag = document.createElement('script');
    tag.defer = true;
    tag.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    tag.setAttribute('data-cf-beacon', JSON.stringify({token: cfg.cloudflareToken}));
    document.head.append(tag);
  }
})();
