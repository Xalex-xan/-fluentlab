/* Integraciones optativas: cuentas verificadas, historial por alumno y visitas agregadas.
   Sin configuración, el sitio sigue siendo usable y no envía datos a terceros. */
(function(){'use strict';
const cfg=window.FLUENTLAB_CLOUD_CONFIG||{};let client=null,pending=null;
function available(){return !!(cfg.supabaseUrl&&cfg.publishableKey)}
function loadSDK(){return new Promise((resolve,reject)=>{if(window.supabase?.createClient)return resolve();const tag=document.createElement('script');tag.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';tag.referrerPolicy='no-referrer';tag.onload=resolve;tag.onerror=()=>reject(new Error('No se pudo cargar el servicio de cuentas. Comprueba internet.'));document.head.append(tag)})}
async function connect(){if(!available())throw Error('La conexión de alumnos aún no está configurada por el administrador.');if(client)return client;if(pending)return pending;pending=(async()=>{await loadSDK();if(!window.supabase?.createClient)throw Error('No se pudo inicializar el servicio de cuentas.');client=window.supabase.createClient(cfg.supabaseUrl,cfg.publishableKey,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});return client})();try{return await pending}finally{pending=null}}
async function currentUser(){const db=await connect();const {data,error}=await db.auth.getUser();if(error)throw error;return data.user}
async function sendLogin(email){const db=await connect();const {error}=await db.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname+'?auth=1'}});if(error)throw error;return true}
async function logout(){const db=await connect();const {error}=await db.auth.signOut();if(error)throw error}
async function saveProfile(publicProfile){const db=await connect();const user=await currentUser();if(!user)throw Error('Inicia sesión para guardar en la nube.');const {error}=await db.from('learning_profiles').upsert({id:user.id,nickname:String(publicProfile.nickname||'Estudiante').slice(0,60),level:publicProfile.level,snapshot:publicProfile.snapshot,updated_at:new Date().toISOString()},{onConflict:'id'});if(error)throw error}
async function readProfile(){const db=await connect();const user=await currentUser();if(!user)throw Error('Inicia sesión primero.');const {data,error}=await db.from('learning_profiles').select('nickname,level,snapshot,updated_at').eq('id',user.id).maybeSingle();if(error)throw error;return data}
async function track(kind,moduleId,score){if(!available())return false;const user=await currentUser();if(!user)return false;const db=await connect();const {error}=await db.from('study_events').insert({user_id:user.id,kind,module_id:moduleId||'',score:Number.isFinite(score)?Math.max(0,Math.min(100,Math.round(score))):null});if(error)throw error;return true}
async function teacherSummary(){const db=await connect();const {data,error}=await db.rpc('fluentlab_teacher_overview');if(error)throw error;return data}
async function teacherRoster(){const db=await connect();const {data,error}=await db.rpc('fluentlab_teacher_roster');if(error)throw error;return data}
function enableCloudflare(){const token=String(cfg.cloudflareToken||'').trim();if(!/^[a-zA-Z0-9_-]{16,120}$/.test(token))return;const tag=document.createElement('script');tag.defer=true;tag.src='https://static.cloudflareinsights.com/beacon.min.js';tag.setAttribute('data-cf-beacon',JSON.stringify({token}));document.head.append(tag)}
window.FluentCloud={available,connect,currentUser,sendLogin,logout,saveProfile,readProfile,track,teacherSummary,teacherRoster,hasAnalytics:()=>!!cfg.cloudflareToken};
// Solo se inicia si el propietario ha configurado explícitamente un token en cloud-config.js.
if(location.protocol==='https:'&&cfg.cloudflareToken)enableCloudflare();
})();
