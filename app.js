/* Aprende con Xanny — práctica y progreso de inglés. */
(()=>{'use strict';
// Conserva la clave histórica para recuperar el progreso existente en el mismo sitio.
const KEY='fluentlab_v1';
let progressKey = KEY;
const activeAccountKey = KEY + ':active-account';
let progressSync, syncSession, lastLocalRecord;
let storageOK=true;
const sections=[['home','Inicio','⌂'],['missions','Misiones reales','◈'],['path','Mi ruta','◈'],['listen','Escuchar','◉'],['speak','Hablar','◌'],['cards','Tarjetas','▣'],['errors','Mis errores','↻'],['progress','Mi progreso','▥'],['account','Mi cuenta','♙'],['classroom','Aula virtual','▧'],['grammar','Gramática','✳'],['write','Escribir','✎'],['resources','Biblioteca','▤'],['settings','Ajustes','⚙']];
const defaults=()=>({version:1,level:'A2',goal:3,accent:'en-US',theme:'dark',xp:0,completed:{},lessonResults:{},wins:{},listeningDone:{},speakingDone:{},writingDone:{},srs:{},reviewRewarded:{},days:{},drafts:{},placementHistory:[],recentQuestions:{},errorLog:{},lastListen:{},missionHistory:{},missionSkills:{},missionDrafts:{},learningMode:'free',missionVariants:{},missionErrors:{},missionReviews:{},missionResults:{},missionTimeline:[]});
let progress=load();
function normalizeProgress(saved) {
  const base = defaults();
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return base;
  const value = {...base, ...saved};
  for (const [key, original] of Object.entries(base)) {
    if (Array.isArray(original)) {
      if (!Array.isArray(value[key])) value[key] = original;
    } else if (typeof original === 'object' && (!value[key] || typeof value[key] !== 'object' || Array.isArray(value[key]))) {
      value[key] = original;
    }
  }
  value.learningMode = AdaptiveLearning.mode(value.learningMode);
  value.xp = typeof value.xp === 'number' && Number.isFinite(value.xp) ? Math.max(0, Math.min(1e8, value.xp)) : base.xp;
  value.level = StudyProfile.levels.includes(value.level) ? value.level : base.level;
  return value;
}
let ui={syncState:{kind:'pending'},syncName:'Estudiante',cachedAccount:false,deletionRequested:false,classroomData:null,classroomBusy:false,classroomMessage:'',classroomReport:null,reportGroup:null,analyticsConsent:false,page:new URLSearchParams(location.search).has('auth')?'account':(location.hash.startsWith('#access_token=')?'account':location.hash.replace('#','')||'home'),pathFilter:'Todos',grammarFilter:'Todos',resourceFilter:'Todos',pathSearch:'',lesson:null,listenIndex:Math.max(0,DATA.listening.findIndex(l=>l.level===progress.level)),listenChoice:null,listenChecked:false,listenAttempts:0,listenWrong:[],listenQuiz:null,showTranscript:false,speakIndex:Math.max(0,DATA.speaking.findIndex(l=>l.level===progress.level)),speakText:'',speakFeedback:null,speaking:false,reviewQueue:null,cardFlipped:false,reviewCount:0,reviewSuccess:0,writeIndex:Math.max(0,DATA.writing.findIndex(l=>l.level===progress.level)),writeFeedback:null,diagnostic:null,resetArmed:false,mission:null,missionFilter:'Todos',cloudBusy:false,cloudUser:null,cloudNotice:'',teacherStats:null,teacherRoster:null};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const plusDays=n=>{const d=new Date();d.setDate(d.getDate()+n);return day(d)};
function load(key = progressKey) {
  try {
    const raw = localStorage.getItem(key);
    if (key === progressKey) lastLocalRecord = raw;
    return normalizeProgress(JSON.parse(raw || '{}'));
  } catch (error) {
    storageOK = false;
    return defaults();
  }
}
function save(sync = true) {
  try {
    const raw = JSON.stringify(progress);
    const previous = localStorage.getItem(progressKey);
    if (previous && previous !== lastLocalRecord && previous !== raw) localStorage.setItem(progressKey + ':other-tab', previous);
    localStorage.setItem(progressKey, raw);
    lastLocalRecord = raw;
    storageOK = true;
    if (sync) progressSync?.queue();
    return true;
  } catch {
    storageOK = false;
    setSyncState({kind: navigator.onLine === false ? 'offline' : 'error'});
    return false;
  }
}
function toast(msg){document.querySelector('.toast')?.remove();const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=msg;document.body.append(t);setTimeout(()=>t.remove(),3100)}
function activity(xp=0){progress.xp+=xp;progress.days[day()]=(progress.days[day()]||0)+1;save()}
function awardOnce(bucket,id,xp){if(progress[bucket][id])return false;progress[bucket][id]=day();activity(xp);return true}
function streak(){let n=0,d=new Date();if(!progress.days[day(d)])d.setDate(d.getDate()-1);while(progress.days[day(d)]){n++;d.setDate(d.getDate()-1)}return n}
function count(obj){return Object.keys(obj||{}).length}
function dueCards(){return DATA.vocabulary.filter(v=>!progress.srs[v.id]||progress.srs[v.id].due<=day())}
function matureCards(){return DATA.vocabulary.filter(v=>(progress.srs[v.id]?.interval||0)>=7).length}
function goalDone(){return [Object.values(progress.completed).some(v=>v===day()),Object.values(progress.listeningDone).some(v=>v===day()),Object.values(progress.reviewRewarded).some(v=>v===day())].filter(Boolean).length}
const pct=(a,b)=>Math.min(100,Math.round((a/Math.max(1,b))*100));
const slug=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const normal=s=>slug(s).replace(/[^a-z0-9' ]/g,' ').replace(/\s+/g,' ').trim();
const words=s=>(s.trim().match(/\b[\p{L}]+(?:['’-][\p{L}]+)*\b/gu)||[]);
function focusPage(selector = '.page') {
  document.querySelector(selector)?.focus({preventScroll: true});
  window.scrollTo(0, 0);
}
function navPage(page) {
  ui.page = page;
  ui.lesson = null;
  ui.resetArmed = false;
  ui.writeFeedback = null;
  if (page === 'cards') beginReview(false);
  if (page === 'listen') switchListen(ui.listenIndex, false);
  if (page === 'account' || page === 'classroom') refreshCloudUser();
  location.hash = page;
  render();
  focusPage();
}
function navHtml(){return sections.map(([id,label,ico])=>`<button type="button" class="nav-btn ${ui.page===id?'active':''}" data-a="nav" data-id="${id}" aria-label="${label}" aria-current="${ui.page===id?'page':'false'}"><span class="nav-ico">${ico}</span><span class="nav-label">${label}</span>${id==='cards'&&dueCards().length?`<small>${dueCards().length}</small>`:''}</button>`).join('')}
function mobileNav() {
  const shortcuts = ['home', 'missions', 'path'];
  const short = {home: 'Inicio', missions: 'Misiones', path: 'Ruta'};
  const links = sections.map(([id, label, icon]) => `<button type="button" class="nav-btn ${ui.page === id ? 'active' : ''}" data-a="nav" data-id="${id}" aria-current="${ui.page === id ? 'page' : 'false'}"><span aria-hidden="true">${icon}</span> ${label}</button>`).join('');
  return `<nav class="mobile-nav" aria-label="Navegación móvil">${sections.filter(([id]) => shortcuts.includes(id)).map(([id, label, icon]) => `<button type="button" class="mobile-shortcut ${ui.page === id ? 'active' : ''}" data-a="nav" data-id="${id}" aria-label="${label}" aria-current="${ui.page === id ? 'page' : 'false'}"><b aria-hidden="true">${icon}</b>${short[id]}</button>`).join('')}<details class="mobile-more"><summary class="mobile-shortcut"><b aria-hidden="true">☰</b>Menú</summary><div class="mobile-menu-panel" aria-label="Todas las secciones">${links}<button type="button" class="nav-btn" data-a="nav" data-id="diagnostic">Diagnóstico</button></div></details></nav>`;
}
const meta=()=>`<div class="topbar"><div class="breadcrumb"><span class="breadcrumb-brand">Aprende con Xanny</span><span class="subtle" aria-hidden="true"> / </span> <strong>${sections.find(s=>s[0]===ui.page)?.[1]||'Mi ruta'}</strong></div><div class="toolbar"><span class="pill">🔥 ${streak()} ${streak()===1?'día':'días'}</span><span class="pill">✦ ${progress.xp} XP</span><button class="pill accent" data-a="nav" data-id="settings" aria-label="Cambiar nivel">${esc(progress.level)} <span aria-hidden="true">⌄</span></button></div></div>`;
function shell(content){document.body.classList.toggle('light',progress.theme==='light');$('app').innerHTML=`<div class="layout"><aside class="sidebar"><a class="brand" href="#home" aria-label="Aprende con Xanny, inicio"><img class="brand-icon" src="xanny.svg?v=3.3.1" alt="" width="46" height="46"><div class="brand-copy"><span class="brand-text">Aprende con <strong>Xanny</strong></span><span class="brand-sub" lang="en">Xanny English Lab</span></div></a><div class="nav-head">Tu espacio</div><nav class="nav" aria-label="Menú principal">${navHtml()}</nav><div class="side-spacer"></div><div class="side-tip"><div class="star">✦</div><strong>Pequeños pasos. Gran progreso.</strong><p>Escucha, responde, equivócate y vuelve a intentarlo. Así se construye fluidez.</p><button class="mini-link button ghost sm" data-a="nav" data-id="diagnostic">Hacer diagnóstico →</button></div></aside><main class="main">${meta()}<div class="page" tabindex="-1">${content}</div><div class="footer">Aprende con Xanny · <a href="#resources">Fuentes y recursos</a></div></main>${mobileNav()}</div>`}
function heading(k,title,desc){return `<div class="section-label">${k}</div><h1 class="page-title">${title}</h1><p class="page-desc">${desc}</p>`}
function progressBar(a,b){return `<div class="progress" role="progressbar" aria-valuenow="${a}" aria-valuemin="0" aria-valuemax="${b}"><span style="width:${pct(a,b)}%"></span></div>`}
function home(){const finished=count(progress.completed),dayTasks=goalDone(),lessonLevel=progress.level==='C1'?'B2':progress.level,levelLessons=DATA.lessons.filter(l=>l.level===lessonLevel),chosen=levelLessons.find(l=>!progress.completed[l.id])||levelLessons[0];const tasks=[['Termina una microlección','Aprende una idea y úsala de inmediato.','path','📗',Object.values(progress.completed).some(v=>v===day())],['Escucha una conversación','Entrena tu oído con una pregunta real.','listen','🎧',Object.values(progress.listeningDone).some(v=>v===day())],['Repasa vocabulario','Recuerda palabras sin mirar primero.','cards','🧠',Object.values(progress.reviewRewarded).some(v=>v===day())]];
return `${!storageOK?'<div class="notice mb"><strong>Almacenamiento restringido:</strong> este navegador no permite guardar el progreso automáticamente en este contexto. Exporta tus datos desde Ajustes, o abre el sitio publicado mediante HTTPS.</div>':''}<div class="hero"><div><h1>Aprende con <em>Xanny</em></h1><p>Practica inglés para situaciones reales. Entrena tu oído, amplía tu vocabulario y gana confianza para conversar.</p><div class="button-group"><button class="button primary" data-a="openLesson" data-id="${chosen.id}">Continuar mi ruta <span>↗</span></button><button class="button white" data-a="nav" data-id="listen">Practicar escucha ◉</button></div></div><figure class="hero-art xanny-hero"><img src="xanny.svg?v=3.3.1" alt="Gato negro de ojos dorados y pañuelo violeta" width="224" height="224"><figcaption>Xanny</figcaption></figure></div>
<section class="next-mission home-feature"><div><div class="section-label">⚡ LAB DE SITUACIONES REALES</div><h2>El inglés se aprende usándolo.</h2><p>Entrevistas, reclamos, acuerdos, tecnología, argumentación y casos C1. Una situación alternativa en la siguiente práctica, con pistas y explicaciones.</p></div><button class="button primary" data-a="nav" data-id="missions">Explorar misiones ↗</button></section><div class="home-coach"><div><span class="section-label">✦ TU COACH DE APRENDIZAJE</span><h3>${pendingErrors()?`Tienes ${pendingErrors()} conceptos por reforzar`:'Equivocarte también es avanzar'}</h3><p>Practica, recibe pistas y descubre por qué una respuesta es correcta. Repetir con variaciones te ayuda a comprender.</p></div><button class="button" data-a="nav" data-id="errors">Ver mis errores ↗</button></div><div class="stats"><div class="stat spark"><div class="stat-icon">⚡</div><div class="value">${progress.xp}</div><div class="label">Puntos de práctica</div></div><div class="stat"><div class="stat-icon">🔥</div><div class="value">${streak()}</div><div class="label">Días de racha</div></div><div class="stat"><div class="stat-icon">✅</div><div class="value">${finished}<span class="small subtle">/${DATA.lessons.length}</span></div><div class="label">Lecciones terminadas</div></div><div class="stat"><div class="stat-icon">🧠</div><div class="value">${matureCards()}</div><div class="label">Palabras consolidadas*</div></div></div>
<div class="grid grid-2 mt"><section class="card"><div class="between mb-sm"><h2 class="section-h" style="margin:0">Misiones de hoy</h2><span class="tag green">${dayTasks}/${progress.goal} objetivo</span></div>${progressBar(Math.min(dayTasks,progress.goal),progress.goal)}<div class="mt">${tasks.map(([title,sub,target,icon,done])=>`<div class="task"><div class="task-icon">${icon}</div><div class="task-main"><h3>${title}</h3><p>${sub}</p></div>${done?'<span class="checkmark" title="Completada">✓</span>':`<button class="button sm" data-a="nav" data-id="${target}">Ir ↗</button>`}</div>`).join('')}</div></section><section class="card"><div class="between mb-sm"><h2 class="section-h" style="margin:0">Tu avance en ${lessonLevel}</h2><span class="tag blue">MCER</span></div><p class="subtle small">${levelLessons.filter(l=>progress.completed[l.id]).length} de ${levelLessons.length} lecciones completadas</p>${progressBar(levelLessons.filter(l=>progress.completed[l.id]).length,levelLessons.length)}<div class="mt"><div class="between"><div><span class="tag">PRÓXIMA CLASE</span><h3 style="font:800 23px var(--heading);margin:9px 0 5px">${chosen.icon} ${chosen.title}</h3><p class="small subtle" style="margin:0 0 15px">${chosen.objective}</p></div></div><button class="button primary" data-a="openLesson" data-id="${chosen.id}">Empezar lección ↗</button></div><div class="divider"></div><div class="between"><span class="small subtle">¿No sabes tu nivel?</span><button class="button ghost sm" data-a="nav" data-id="diagnostic">Prueba orientativa →</button></div></section></div>
<div class="grid grid-3 mt"><div class="study-box"><span style="font-size:25px">🎧</span><h3>Entrena el oído</h3><p>Escucha dos veces, identifica la idea principal y luego revisa el texto.</p><button class="button ghost sm mt" data-a="nav" data-id="listen">Ir a listening ↗</button></div><div class="study-box"><span style="font-size:25px">🎤</span><h3>Habla sin miedo</h3><p>Escucha frases, repítelas y compara lo que reconoce el navegador.</p><button class="button ghost sm mt" data-a="nav" data-id="speak">Practicar speaking ↗</button></div><div class="study-box"><span style="font-size:25px">✍️</span><h3>Pasa de entender a crear</h3><p>Escribe textos cortos con sugerencias básicas para corregirte.</p><button class="button ghost sm mt" data-a="nav" data-id="write">Escribir ↗</button></div></div><p class="note mt">*Palabras consolidadas = tarjetas cuyo intervalo de repaso alcanza 7 días; no es una certificación de dominio.</p>`}
function lessonCard(l){const done=!!progress.completed[l.id];return `<div class="card lesson-card"><div class="between"><span class="lesson-emoji">${l.icon}</span><span class="tag ${done?'green':''}">${done?'✓ Hecha':l.level}</span></div><div><span class="small subtle bold">${l.tag} · ${l.mins} min aprox.</span><h3>${l.title}</h3></div><p>${l.objective}</p><div class="foot"><span>${done?'Puedes repetirla':'3 preguntas variables · 5 posibles'}</span><button class="button sm ${done?'':'primary'}" data-a="openLesson" data-id="${l.id}">${done?'Repetir':'Empezar'} ↗</button></div></div>`}
function path(){let options=['Todos','A1','A2','B1','B2'];let list=DATA.lessons.filter(l=>(ui.pathFilter==='Todos'||ui.pathFilter===l.level)&&(!ui.pathSearch||slug(l.title+' '+l.objective+' '+l.tag).includes(slug(ui.pathSearch))));return heading('RUTA DE APRENDIZAJE','Tu ruta hacia la fluidez','24 microlecciones A1–B2 con prácticas variables. Cada sesión escoge preguntas y mezcla las opciones para que aprendas la regla, no la letra.')+`<div class="between wrap"><div class="filters">${options.map(v=>`<button class="chip ${ui.pathFilter===v?'active':''}" data-a="pathFilter" data-id="${v}">${v}</button>`).join('')}</div><input class="field search" id="pathSearch" aria-label="Buscar lecciones" placeholder="Buscar una lección…" value="${esc(ui.pathSearch)}"></div><div class="grid grid-3">${list.map(lessonCard).join('')||'<div class="card">No hay lecciones para esta búsqueda.</div>'}</div>`}
function shuffle(arr){const r=arr.slice();for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]]}return r}
function questionPool(l){const base=l.questions.map((q,i)=>({id:'original-'+i,text:q[0],options:q[1],answer:q[2],why:q[3]}));const extras=(typeof XANNY_EXTRA!=='undefined'?XANNY_EXTRA[l.id]||[]:[]).map((q,i)=>({id:'nuevo-'+i,text:q[0],options:q[1],answer:q[2],why:q[3]}));return base.concat(extras)}
function prepareSession(l,focusId){const previous=progress.recentQuestions[l.id]||[];const pool=shuffle(questionPool(l)).sort((a,b)=>Number(previous.includes(a.id))-Number(previous.includes(b.id)));const focused=focusId?pool.find(q=>q.id===focusId):null;const picked=[...(focused?[focused]:[]),...pool.filter(q=>q!==focused)].slice(0,Math.min(3,pool.length));progress.recentQuestions[l.id]=picked.map(q=>q.id);save();return picked.map(q=>{const index=shuffle(q.options.map((_,i)=>i));return {...q, options:index.map(i=>q.options[i]),answer:index.indexOf(q.answer)}})}
function pendingErrors(){return Object.values(progress.errorLog).filter(v=>v&&!v.resolved).length+missionErrorEntries().filter(({entry})=>!entry.resolved).length}
function rememberError(l,q){const key=l.id+'/'+q.id;const x=progress.errorLog[key]||{times:0};progress.errorLog[key]={times:x.times+1,last:day(),resolved:null};save()}
function repairError(l,q){const key=l.id+'/'+q.id;const entry=progress.errorLog[key];if(entry){entry.resolved=day();save()}}
function newListenQuiz(item){const orig={question:item.question,options:item.options,answer:item.answer,keyword:item.keyword};const alt=typeof XANNY_LISTEN_EXTRA!=='undefined'?XANNY_LISTEN_EXTRA[item.id]:null;const variants=[orig];if(alt)variants.push({question:alt[0],options:alt[1],answer:alt[2],keyword:alt[3]});const last=progress.lastListen[item.id];const possible=variants.map((_,i)=>i).filter(i=>i!==last);const index=possible.length?possible[Math.floor(Math.random()*possible.length)]:0;progress.lastListen[item.id]=index;save();const q=variants[index];const order=shuffle(q.options.map((_,i)=>i));return {...q,options:order.map(i=>q.options[i]),answer:order.indexOf(q.answer)}}
function switchListen(ix, update = true){ui.listenIndex=ix;ui.listenChoice=null;ui.listenChecked=false;ui.listenAttempts=0;ui.listenWrong=[];ui.listenQuiz=newListenQuiz(DATA.listening[ix]);ui.showTranscript=false;if(update)render()}
function openLesson(id,focusId){const l=DATA.lessons.find(l=>l.id===id);if(!l)return;recordCloudEvent('lesson_started',id);ui.lesson={id,index:0,selected:null,checked:false,attempts:0,wrongOptions:[],feedback:'',score:0,firstTry:0,responses:[],items:prepareSession(l,focusId)};ui.page='lesson';location.hash='lesson';render();window.scrollTo(0,0)}

function lesson(){
const s=ui.lesson;if(!s)return '<div class="card empty"><h3>Elige una lección</h3><button class="button primary" data-a="nav" data-id="path">Ver mi ruta</button></div>';
const l=DATA.lessons.find(v=>v.id===s.id);if(!l)return '<p>Lección no encontrada</p>';
const finished=s.index>=s.items.length;
const head=`<button class="button ghost sm mb" data-a="nav" data-id="path">← Volver a mi ruta</button><div class="focus-header"><div class="big-icon">${l.icon}</div><div><span class="tag">${l.level} · ${l.tag} · sesión variable</span><h2>${l.title}</h2><p>${l.objective}</p></div></div>`;
if(finished){return head+`<div class="card lesson-finish"><div class="emoji">🏆</div><h2 class="section-h">¡Terminaste tu práctica!</h2><p>Aciertos iniciales: <strong>${s.firstTry}/${s.items.length}</strong> · con ayuda: <strong>${s.score-s.firstTry}</strong> · soluciones explicadas: <strong>${s.items.length-s.score}</strong>.</p><p>${s.responses.some(r=>r.attempts)?'Tus equivocaciones son pistas para mejorar. Revisa cada explicación y vuelve a practicar en otro momento.':'¡Buen trabajo! Ahora intenta una sesión distinta para consolidarlo.'}</p><div class="button-group" style="justify-content:center"><button class="button primary" data-a="openLesson" data-id="${l.id}">Practicar con otras preguntas ↻</button><button class="button" data-a="nav" data-id="errors">Mi cuaderno de errores →</button></div></div><div class="review-title"><span>✦</span><div><h2>Respuestas explicadas</h2><p>La opción correcta y la razón de cada ejercicio.</p></div></div><div class="review-list">${s.responses.map((r,i)=>`<article class="review-card ${r.attempts?'needs-review':'mastered'}"><div class="between"><strong>Pregunta ${i+1}</strong><span class="tag ${r.attempts?'orange':'green'}">${r.attempts?'Necesita refuerzo':'Resuelta a la primera'}</span></div><h3>${esc(r.text)}</h3><div class="review-answer">✓ ${esc(r.correct)}</div><p><strong>¿Por qué?</strong> ${esc(r.why)}</p></article>`).join('')}</div>`}
const q=s.items[s.index];
const controls=s.checked?`<div class="feedback ${s.feedback==='right'?'good':'bad'}" role="status"><strong>${s.feedback==='right'?(s.attempts?'✓ ¡Lo corregiste!':'✓ ¡Excelente!'):'La respuesta correcta es: '+esc(q.options[q.answer])}</strong><div><strong>Explicación:</strong> ${esc(q.why)}</div></div><button class="button primary block mt" data-a="lessonNext">${s.index===s.items.length-1?'Ver resultados y explicaciones':'Siguiente pregunta'} →</button>`:s.feedback==='retry'?`<div class="feedback bad" role="status"><strong>Esta opción no es correcta. ¡Puedes intentarlo otra vez!</strong><div>Te queda un intento. Revisa la regla de la izquierda y fíjate en las pistas de la frase. Todavía no te revelamos la solución.</div></div><button class="button primary block mt" data-a="lessonCheck" ${s.selected===null?'disabled':''}>Comprobar mi segundo intento →</button>`:`<button class="button primary block mt" data-a="lessonCheck" ${s.selected===null?'disabled':''}>Comprobar respuesta →</button>`;
return head+`<div class="grid grid-2"><section class="card lesson-theory"><div class="section-label">Idea clave</div><p>${esc(l.rule)}</p><div class="divider"></div><div class="section-label">En inglés real</div><div class="quote">“${esc(l.example)}”</div><div class="translation">${esc(l.es)}</div><button class="button ghost sm mt" data-a="speakAudio" data-text="${esc(l.example)}">🔊 Escuchar ejemplo</button><div class="lesson-help"><span>🧩</span><p>Puedes equivocarte, volver a intentarlo y consultar el porqué al terminar. Lo importante es comprender.</p></div></section><section class="card quiz-panel"><div class="between mb"><div class="quiz-head" style="margin:0">PREGUNTA ${s.index+1} DE ${s.items.length}</div><span class="tag orange">${s.attempts?'Segundo intento':'+5 XP por primer acierto'}</span></div>${progressBar(s.index,s.items.length)}<h3 class="quiz-title mt">${esc(q.text)}</h3><div class="option-list">${q.options.map((v,i)=>`<button class="option ${s.selected===i?'selected':''} ${s.checked&&i===q.answer?'correct':''} ${s.wrongOptions.includes(i)?'wrong':''}" data-a="lessonOption" data-index="${i}" ${s.checked||s.wrongOptions.includes(i)?'disabled':''}><span class="letter">${String.fromCharCode(65+i)}</span>${esc(v)}</button>`).join('')}</div>${controls}<p class="small subtle mt">Las opciones cambian de posición entre sesiones. Evita memorizar letras: comprende la regla.</p></section></div>`;
}

function grammar(){const grammatical=DATA.lessons.filter(l=>l.tag==='Gramática'&&(ui.grammarFilter==='Todos'||l.level===ui.grammarFilter));return heading('LABORATORIO DE GRAMÁTICA','Gramática que sí se usa','Reglas breves, ejemplos contextualizados y ejercicios con retroalimentación inmediata.')+`<div class="filters">${['Todos','A1','A2','B1','B2'].map(f=>`<button class="chip ${ui.grammarFilter===f?'active':''}" data-a="grammarFilter" data-id="${f}">${f}</button>`).join('')}</div><div class="grid grid-3">${grammatical.map(lessonCard).join('')}</div>`}
function listen(){const item=DATA.listening[ui.listenIndex];if(!item)return '';if(!ui.listenQuiz)ui.listenQuiz=newListenQuiz(item);const q=ui.listenQuiz;return heading('LISTENING STUDIO','Escucha con intención','Primero escucha sin mirar el texto. Responde una pregunta y después descubre la transcripción.')+`<div class="between wrap mb"><div class="filters" style="margin:0">${DATA.listening.map((l,i)=>`<button class="chip ${ui.listenIndex===i?'active':''}" data-a="listenSelect" data-index="${i}">${String(i+1).padStart(2,'0')}</button>`).join('')}</div><span class="tag blue">${item.level} · ${ui.listenIndex+1}/${DATA.listening.length}</span></div><div class="grid grid-2"><section class="audio-box"><div class="between"><span class="tag green">🎧 AUDIO ORIGINAL · VOZ DEL NAVEGADOR</span><span class="small">${item.level}</span></div><h2 class="section-h" style="font-size:28px;color:#fff;margin-top:18px">${item.title}</h2><p style="color:#c9dfd4">${item.context}</p><div class="audio-wave" aria-hidden="true">${[20,35,15,42,29,44,18,32,22,40,16,34,25,42,18,32].map(n=>`<i style="--h:${n}px"></i>`).join('')}</div><p class="audio-hint">Escucha 2 veces. Intenta identificar palabras clave, no traducir palabra por palabra.</p><div class="button-group" style="justify-content:center"><button class="button primary" data-a="listenAudio">▶ Reproducir diálogo</button><button class="button" data-a="stopAudio">◼ Detener</button></div><div class="divider" style="background:#ffffff20"></div><div class="between"><span class="small" style="color:#d5e8e0">Velocidad de voz</span><select class="select" id="speechRate" style="background:#17343b;color:white"><option value="0.75" ${progress.rate==='0.75'?'selected':''}>Lenta · 0.75×</option><option value="0.9" ${!progress.rate||progress.rate==='0.9'?'selected':''}>Clara · 0.9×</option><option value="1" ${progress.rate==='1'?'selected':''}>Normal · 1×</option><option value="1.15" ${progress.rate==='1.15'?'selected':''}>Rápida · 1.15×</option></select></div></section><section class="card"><div class="quiz-head">COMPRENSIÓN AUDITIVA</div><h3 class="quiz-title">${esc(q.question)}</h3><div class="option-list">${q.options.map((o,i)=>`<button class="option ${ui.listenChoice===i?'selected':''} ${ui.listenChecked&&i===q.answer?'correct':''} ${ui.listenWrong.includes(i)?'wrong':''}" data-a="listenOption" data-index="${i}" ${ui.listenChecked||ui.listenWrong.includes(i)?'disabled':''}><span class="letter">${String.fromCharCode(65+i)}</span>${esc(o)}</button>`).join('')}</div>${ui.listenChecked?`<div class="feedback ${ui.listenChoice===q.answer?'good':'bad'}">${ui.listenChoice===q.answer?'✓ Respuesta correcta.':'La respuesta correcta es: '+esc(q.options[q.answer])+'.'} <br>Palabra o expresión clave: <strong>${esc(q.keyword)}</strong>.</div><div class="button-group mt"><button class="button primary" data-a="listenNext">Siguiente audio →</button><button class="button" data-a="toggleTranscript">${ui.showTranscript?'Ocultar':'Ver'} transcripción</button></div>`:`${ui.listenAttempts?`<div class="feedback bad" role="status"><strong>Respuesta incorrecta. Inténtalo de nuevo.</strong><div>Escucha otra vez; te queda un intento antes de revelar la solución.</div></div>`:``}<button class="button primary block mt" data-a="listenCheck" ${ui.listenChoice==null?'disabled':''}>Verificar comprensión →</button><button class="button ghost sm mt" data-a="toggleTranscript">${ui.showTranscript?'Ocultar':'Revelar'} transcripción</button>`}${ui.showTranscript?`<div class="writing-tips" style="white-space:pre-line"><strong>Transcripción:</strong>\n${esc(item.audio)}</div>`:''}</section></div><div class="notice mt"><strong>Consejo de estudio:</strong> reproduce a velocidad lenta, responde, escucha otra vez a velocidad normal y repite en voz alta una oración. El audio se sintetiza con las voces disponibles en tu dispositivo.</div>`}
function speak(){const item=DATA.speaking[ui.speakIndex];const supported=!!(window.SpeechRecognition||window.webkitSpeechRecognition);return heading('SPEAKING STUDIO','Tu voz también aprende','Escucha, repite y compara lo que entiende el reconocedor. No juzga tu acento: es práctica de claridad e inteligibilidad.')+`<div class="grid grid-2"><section class="card"><div class="between mb"><h2 class="section-h" style="margin:0">Frases para practicar</h2><span class="tag blue">${item.level}</span></div><label class="form-label" for="speakSelect">Elige una situación</label><select class="field" id="speakSelect">${DATA.speaking.map((s,i)=>`<option value="${i}" ${i===ui.speakIndex?'selected':''}>${s.level} · ${s.title}</option>`).join('')}</select><div class="divider"></div><span class="section-label">ESCUCHA Y REPITE</span><blockquote class="quote" style="margin:13px 0 10px">“${esc(item.target)}”</blockquote><div class="button-group"><button class="button" data-a="speakAudio" data-text="${esc(item.target)}">🔊 Escuchar frase</button><button class="button ghost" data-a="speakSlow" data-text="${esc(item.target)}">🐢 Escuchar lento</button></div><div class="writing-tips">Consejo: escucha primero, repite sin leer, y al final comprueba las palabras que faltaron. La entonación y el acento necesitan evaluación humana o herramientas especializadas.</div></section><section class="card"><div class="between mb"><h2 class="section-h" style="margin:0">Ahora te toca</h2><span class="tag ${supported?'green':'orange'}">${supported?'Micrófono disponible*':'Modo escrito'}</span></div><p class="small subtle">${supported?'Pulsa grabar y permite el acceso al micrófono cuando tu navegador lo solicite.':'Este navegador no expone reconocimiento de voz. Puedes completar la práctica escribiendo lo que dices.'}</p>${supported?`<button class="button primary block" data-a="recordSpeech">${ui.speaking?'◼ Escuchando…':'🎤 Grabar mi voz'}</button>`:`<div class="notice">La opción de micrófono suele funcionar mejor en Chrome/Edge actualizados mediante HTTPS o localhost.</div>`}<label class="form-label" for="speakText">Lo que se reconoció (o lo que escribes):</label><textarea class="field" style="min-height:125px" id="speakText" placeholder="Tu frase aparecerá aquí…">${esc(ui.speakText)}</textarea><div class="button-group mt"><button class="button primary" data-a="speakCheck">Comparar frase →</button><button class="button" data-a="speakClear">Borrar</button></div>${ui.speakFeedback?`<div class="feedback ${ui.speakFeedback.score>=70?'good':'bad'}"><strong>${ui.speakFeedback.score}% de coincidencia de palabras</strong><div>${ui.speakFeedback.message}</div>${ui.speakFeedback.missing.length?`<div class="mt small">Revisa: <strong>${esc(ui.speakFeedback.missing.join(' · '))}</strong></div>`:''}</div>`:''}<p class="note mt">*La compatibilidad y la precisión del reconocimiento dependen del navegador y los permisos. Coincidencia de palabras ≠ evaluación profesional de pronunciación.</p></section></div>`}
function beginReview(reset=true){if(ui.reviewQueue&&!reset)return;let available=dueCards();const weight=v=>v.level===progress.level?0:v.level==='B1'&&progress.level==='A2'?1:v.level==='A2'&&progress.level==='B1'?1:2;available.sort((a,b)=>weight(a)-weight(b)||a.id.localeCompare(b.id,undefined,{numeric:true}));ui.reviewQueue=available.slice(0,12).map(v=>v.id);ui.cardFlipped=false;ui.reviewCount=0;ui.reviewSuccess=0}
function cards(){if(!ui.reviewQueue)beginReview();const id=ui.reviewQueue[0],v=DATA.vocabulary.find(v=>v.id===id),left=dueCards().length;return heading('VOCABULARIO INTELIGENTE','Recuerda más. Olvida menos.','Tarjetas con recuperación activa y repaso espaciado: primero intenta recordar, luego descubre la respuesta y evalúa tu recuerdo.')+`<div class="between wrap mb"><div class="badge-row"><span class="tag orange">${left} pendientes hoy</span><span class="tag green">${matureCards()} consolidadas</span><span class="tag">80 palabras en 4 niveles</span></div><button class="button sm" data-a="reviewRestart">Nueva tanda ↻</button></div>${v?`<div class="grid grid-2"><section><div class="flashcard"><div class="tag" style="color:#fff;border-color:#ffffff40">${v.level} · ${ui.reviewCount+1}ª tarjeta</div><div class="word">${esc(v.word)}</div><button class="button ghost sm" style="color:#fff" data-a="speakAudio" data-text="${esc(v.word)}">🔊 Escuchar palabra</button>${ui.cardFlipped?`<div class="definition mt">${esc(v.es)}</div><div class="example">“${esc(v.example)}”</div>`:`<p class="questionmark mt">¿Qué significa? Trata de recordarlo antes de girar.</p>`}</div>${!ui.cardFlipped?`<button class="button primary block mt" data-a="flipCard">Mostrar respuesta ↗</button>`:`<div class="rating-grid"><button class="button" data-a="rateCard" data-rating="again">↻ Otra vez</button><button class="button" data-a="rateCard" data-rating="hard">😐 Difícil</button><button class="button primary" data-a="rateCard" data-rating="good">✓ Bien</button><button class="button" data-a="rateCard" data-rating="easy">⚡ Fácil</button></div>`}</section><section class="card"><h2 class="section-h">Tu sesión de repaso</h2><div class="between"><span class="small subtle">Tarjetas respondidas</span><strong>${ui.reviewCount}</strong></div>${progressBar(ui.reviewCount,12)}<div class="divider"></div><div class="key-value"><span>Recuerdos correctos en esta tanda</span><strong>${ui.reviewSuccess}</strong></div><div class="divider"></div><h3 class="section-h" style="font-size:18px">Cómo funciona</h3><p class="small subtle">Otra vez: repaso hoy · Difícil: en 1 día · Bien: intervalo creciente · Fácil: intervalo más largo. El algoritmo es una versión sencilla de repaso espaciado, no una predicción exacta de memoria.</p><div class="notice mt"><strong>Recuperación activa:</strong> intenta responder sin mirar. La dificultad de recordar es parte del entrenamiento.</div></section></div>`:`<div class="card empty"><div class="emoji">🎊</div><h3>¡Tanda terminada!</h3><p>Repasaste ${ui.reviewCount} ${ui.reviewCount===1?'tarjeta':'tarjetas'} y recordaste ${ui.reviewSuccess}. ${left?'Todavía hay tarjetas pendientes para hoy.':'No quedan tarjetas pendientes para hoy.'}</p><button class="button primary" data-a="reviewRestart">${left?'Seguir repasando':'Volver a revisar el estado'} →</button></div>`}<p class="note mt">Los intervalos se guardan localmente en este navegador. Si cambias de dispositivo, exporta e importa tus datos en Ajustes.</p>`}
function errors(){const all=Object.entries(progress.errorLog).filter(([,entry])=>entry).sort((a,b)=>(b[1].last||'').localeCompare(a[1].last||''));const pending=all.filter(([,e])=>!e.resolved);const resolved=all.length-pending.length;
return heading('TU CUADERNO DE ERRORES','Aprender de tus errores','Consulta los repasos pendientes y vuelve a las decisiones o lecciones que te costaron.')+missionErrorPanel()+`<h2 class="section-h">Errores en lecciones</h2><div class="stats mb"><div class="stat"><div class="stat-icon">🔁</div><div class="value">${pending.length}</div><div class="label">Preguntas para reforzar</div></div><div class="stat"><div class="stat-icon">✅</div><div class="value">${resolved}</div><div class="label">Errores reforzados</div></div><div class="stat"><div class="stat-icon">📘</div><div class="value">${new Set(pending.map(([id])=>id.split('/')[0])).size}</div><div class="label">Lecciones para revisar</div></div></div>${pending.length?`<div class="review-title"><span>↻</span><div><h2>Prioriza estos temas</h2><p>Repite las lecciones para encontrar ejercicios nuevos y consolidar los anteriores.</p></div></div><div class="review-list">${pending.slice(0,36).map(([id,e])=>{const split=id.lastIndexOf('/');const lid=id.slice(0,split),qid=id.slice(split+1);const l=DATA.lessons.find(x=>x.id===lid);if(!l)return '';const q=questionPool(l).find(x=>x.id===qid);if(!q)return '';return `<article class="review-card needs-review"><div class="between"><span class="tag orange">${l.level} · ${esc(l.title)}</span><span class="small subtle">Fallaste ${e.times} ${e.times===1?'vez':'veces'}</span></div><h3>${esc(q.text)}</h3><p><strong>Respuesta:</strong> ${esc(q.options[q.answer])}</p><p><strong>Explicación:</strong> ${esc(q.why)}</p><button class="button primary sm" data-a="retryError" data-id="${l.id}" data-q="${q.id}">Reintentar esta pregunta ↗</button></article>`}).join('')}</div>`:`<div class="card empty"><div class="emoji">🌱</div><h3>Tu cuaderno está al día</h3><p>Cuando una pregunta te cueste, aparecerá aquí con su explicación para ayudarte a mejorar.</p><button class="button primary" data-a="nav" data-id="path">Practicar una lección →</button></div>`}`;}
function getWriting(){return DATA.writing[ui.writeIndex]}
function writingFeedback(s,item){let ws=words(s),checks=[];let errors=[];if(ws.length>=item.min)checks.push('Alcanzaste la extensión orientativa.');else errors.push(`Faltan aproximadamente ${item.min-ws.length} palabras para la extensión sugerida (${item.min}).`);if(/^[\s]*[A-Z]/.test(s))checks.push('El texto comienza con mayúscula.');else errors.push('Comienza tu primera oración con mayúscula.');if(/[.!?][\s]*$/.test(s))checks.push('Tu texto termina con puntuación.');else errors.push('Añade puntuación al final del texto.');if(/\b(i am agree|i have \d+ years|he go|she go|he don't|she don't|i no understand)\b/i.test(s))errors.push('Revisa una expresión frecuente: “I agree”, “I am 25 years old”, “he/she goes”, “he/she doesn’t” o “I don’t understand”.');if(ws.length>=30&&!/\b(because|but|and|although|however|so|therefore|first|then|finally)\b/i.test(s))errors.push('Prueba añadir un conector para unir ideas (because, but, although, however...).');return {num:ws.length,checks,errors,passes:ws.length>=item.min}}
function write(){const item=getWriting();const draft=progress.drafts[item.id]||'';return heading('WRITING STUDIO','Pasa de pensar a escribir','Escribe sobre situaciones reales y consulta sugerencias sobre extensión y formato. Tus borradores se guardan en este dispositivo.')+`<div class="grid grid-2"><section class="card"><div class="between mb"><h2 class="section-h" style="margin:0">Tu reto de escritura</h2><span class="tag blue">${item.level}</span></div><label class="form-label" for="writeSelect">Tema</label><select class="field" id="writeSelect">${DATA.writing.map((w,i)=>`<option value="${i}" ${ui.writeIndex===i?'selected':''}>${w.level} · ${w.title}</option>`).join('')}</select><div class="divider"></div><span class="section-label">TU MISIÓN</span><div class="quote" style="font-size:24px">${esc(item.prompt)}</div><p class="translation">${item.es}</p><div class="writing-tips">💡 ${item.tip}</div><div class="notice mt"><strong>Importante:</strong> las sugerencias son reglas locales muy simples, no una corrección gramatical integral ni una calificación de nivel MCER. Para una revisión detallada, visita LanguageTool desde la Biblioteca.</div></section><section class="card"><div class="between mb"><h2 class="section-h" style="margin:0">Tu texto</h2><span class="tag">${item.min}+ palabras</span></div><label class="form-label" for="writingText">Escribe en inglés</label><textarea class="field" id="writingText" placeholder="Start writing in English…">${esc(draft)}</textarea><div class="wordcount" id="wordCount">${words(draft).length} palabras · mínimo orientativo ${item.min}</div><div class="button-group mt"><button class="button primary" data-a="writeCheck">Ver sugerencias ↗</button><button class="button" data-a="saveDraft">Guardar borrador</button></div>${ui.writeFeedback?`<div class="mt"><h3 class="section-h" style="font-size:18px">Sugerencias orientativas</h3>${ui.writeFeedback.checks.map(t=>`<div class="report-item"><span style="color:var(--accent)">✓</span>${esc(t)}</div>`).join('')}${ui.writeFeedback.errors.map(t=>`<div class="report-item"><span style="color:var(--orange)">↗</span>${esc(t)}</div>`).join('')||'<div class="feedback good">Buen comienzo. Relee el texto en voz alta y revisa la precisión de tus ideas.</div>'}</div>`:''}</section></div>`}
function resources(){let types=['Todos','Escucha','Gramática','Pronunciación','Escritura','Evaluación'];let list=DATA.resources.filter(r=>ui.resourceFilter==='Todos'||r.type===ui.resourceFilter);return heading('RECURSOS VERIFICADOS','Biblioteca abierta','Seleccioné fuentes educativas y herramientas reales. Sus páginas se abren fuera de Aprende con Xanny y requieren internet.')+`<div class="filters">${types.map(f=>`<button class="chip ${ui.resourceFilter===f?'active':''}" data-a="resourceFilter" data-id="${f}">${f}</button>`).join('')}</div><div class="grid grid-2">${list.map(r=>`<article class="card resource-card"><div class="between"><span class="source">${esc(r.provider)}</span><span class="tag">${r.level}</span></div><h3>${esc(r.title)}</h3><p>${esc(r.desc)}</p><div class="between"><span class="tag blue">${r.type}</span><a class="button sm" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Visitar fuente ↗</a></div></article>`).join('')}</div><div class="notice mt"><strong>Acerca del contenido:</strong> las lecciones y ejercicios integrados fueron escritos para Aprende con Xanny. No se han copiado cursos ni audios protegidos de estas plataformas; se enlazan como recursos complementarios.</div>`}
function settings(){return heading('CONFIGURACIÓN','Tu experiencia, a tu ritmo','Personaliza la dificultad, el audio y tus datos. El progreso se guarda en tu navegador.')+missionModeControls()+`<div class="grid grid-2"><section class="card"><h2 class="section-h">Preferencias</h2><div class="setting-line"><div><h3>Nivel de estudio</h3><p>Para priorizar tu práctica. Las microlecciones llegan a B2 y las misiones llegan a C1.</p></div><select class="select" id="settingLevel">${StudyProfile.levels.map(v=>`<option ${progress.level===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="setting-line"><div><h3>Objetivo diario</h3><p>Número sugerido de actividades.</p></div><select class="select" id="settingGoal">${[1,2,3].map(v=>`<option value="${v}" ${progress.goal===v?'selected':''}>${v} ${v===1?'actividad':'actividades'}</option>`).join('')}</select></div><div class="setting-line"><div><h3>Variante de voz</h3><p>Depende de las voces instaladas.</p></div><select class="select" id="settingAccent"><option value="en-US" ${progress.accent==='en-US'?'selected':''}>🇺🇸 Americano</option><option value="en-GB" ${progress.accent==='en-GB'?'selected':''}>🇬🇧 Británico</option></select></div><div class="setting-line"><div><h3>Apariencia</h3><p>Claro u oscuro.</p></div><select class="select" id="settingTheme"><option value="dark" ${progress.theme==='dark'?'selected':''}>Oscuro</option><option value="light" ${progress.theme==='light'?'selected':''}>Claro</option></select></div><div class="mt"><button class="button" data-a="speakAudio" data-text="Good morning! It's a great day to practise English.">🔊 Probar voz</button></div></section><section class="card"><h2 class="section-h">Tus datos</h2>${!storageOK?'<div class="notice mb"><strong>Guardado local bloqueado:</strong> exporta manualmente un respaldo después de estudiar.</div>':''}<p class="small subtle">Tus borradores permanecen en este navegador y pueden perderse si borras sus datos. Desde Mi cuenta puedes consultar el estado de las copias en la nube.</p><div class="button-group mt"><button class="button primary" data-a="exportData">⇩ Exportar progreso (.json)</button><button class="button" data-a="importTrigger">⇧ Importar copia</button></div><input type="file" id="importFile" accept="application/json,.json" hidden><div class="divider"></div><h3 class="section-h" style="font-size:18px">Empezar desde cero</h3><p class="small subtle">Esta acción borra tu progreso, tarjetas y borradores en este dispositivo.</p><button class="button warn" data-a="resetData">${ui.resetArmed?'¿Confirmar borrado definitivo?':'Borrar todo mi progreso'}</button><div class="divider"></div><h3 class="section-h" style="font-size:18px">Compatibilidad</h3><p class="small subtle">✓ Funciona sin cuentas ni pagos.<br>✓ Lecciones, tarjetas y ejercicios sin conexión tras descargar la web.<br>◉ El audio necesita voces disponibles en el navegador.<br>◉ Reconocimiento de voz sujeto a permisos, soporte y conexión según navegador.<br>◉ No incluye IA conversacional en tiempo real.</p></section></div>`}
function diagnostic(){const d=ui.diagnostic;if(!d)return heading('EVALUACIÓN INICIAL','¿Desde dónde empezar?','Prueba rápida orientativa de 12 preguntas, principalmente de gramática. No mide por completo tu comprensión oral, conversación ni tu nivel oficial.')+`<div class="card" style="max-width:750px;margin:auto"><div class="section-label">12 PREGUNTAS · 4 NIVELES</div><h2 class="section-h">Conoce un punto de partida</h2><p class="subtle">Al terminar recibirás una sugerencia de nivel. El resultado no equivale a un examen certificado CEFR/MCER.</p><div class="timeline mt">${['A1','A2','B1','B2'].map(x=>`<div class="step"><h4>${x}</h4><p>3 preguntas</p></div>`).join('')}</div><button class="button primary mt" data-a="startDiagnostic">Empezar prueba →</button></div>`;if(d.index>=DATA.placement.length){let byLevel={};['A1','A2','B1','B2'].forEach(l=>{let ids=DATA.placement.map((q,i)=>q[3]===l?i:-1).filter(i=>i>=0);byLevel[l]={correct:ids.filter(i=>d.answers[i]===DATA.placement[i][2]).length,total:ids.length}});const total=Object.values(byLevel).reduce((s,x)=>s+x.correct,0);let suggestion=total>=10?'B2':total>=7?'B1':total>=4?'A2':'A1';return heading('RESULTADO ORIENTATIVO','Tu punto de partida sugerido','Este minitest evalúa estructuras escritas, no todas las competencias del idioma.')+`<div class="card" style="max-width:720px;margin:auto"><div class="section-label">RESULTADO</div><div style="font:900 68px var(--heading);color:var(--accent)">${suggestion}</div><p>Acertaste <strong>${total}/${DATA.placement.length}</strong> preguntas. Te sugiero empezar por el nivel <strong>${suggestion}</strong> y ajustar según la dificultad que encuentres.</p><div class="divider"></div>${Object.entries(byLevel).map(([l,r])=>`<div class="between mb-sm"><strong>${l}</strong><span>${r.correct}/${r.total}</span></div>${progressBar(r.correct,r.total)}<div style="height:12px"></div>`).join('')}<div class="button-group mt"><button class="button primary" data-a="adoptLevel" data-id="${suggestion}">Empezar en ${suggestion}</button><button class="button" data-a="startDiagnostic">Repetir prueba</button></div><p class="note mt">La recomendación es una heurística para comenzar. Puedes cambiar el nivel en Ajustes.</p></div>`}
const q=DATA.placement[d.index];return heading('PRUEBA ORIENTATIVA','Una pregunta a la vez','Responde sin buscar la solución para obtener una sugerencia más útil.')+`<section class="card" style="max-width:720px;margin:auto"><div class="between"><span class="section-label">PREGUNTA ${d.index+1} DE ${DATA.placement.length}</span><span class="tag">${q[3]}</span></div>${progressBar(d.index,DATA.placement.length)}<h2 class="quiz-title mt">${q[0]}</h2><div class="option-list">${q[1].map((v,i)=>`<button class="option ${d.selected===i?'selected':''}" data-a="diagnosticOption" data-index="${i}"><span class="letter">${String.fromCharCode(65+i)}</span>${esc(v)}</button>`).join('')}</div><button class="button primary block mt" data-a="diagnosticNext" ${d.selected==null?'disabled':''}>${d.index===DATA.placement.length-1?'Ver resultado':'Siguiente pregunta'} →</button></section>`}
/* Misiones y seguimiento del aprendizaje. */
const missionCount=()=>Object.values(progress.missionHistory||{}).reduce((n,m)=>n+(m.plays||0),0);
const missionAccuracy=()=>{const vals=Object.values(progress.missionHistory||{});const qs=vals.reduce((n,m)=>n+(m.totalQuestions||0),0);return qs?Math.round(100*vals.reduce((n,m)=>n+(m.totalFirst||0),0)/qs):null};
function recommendMission(){const current=MISSIONS.filter(m=>m.level===progress.level);const pool=current.length?current:MISSIONS.filter(m=>m.level==='B1');return pool.slice().sort((a,b)=>(progress.missionHistory[a.id]?.plays||0)-(progress.missionHistory[b.id]?.plays||0))[0]||MISSIONS[0]}
function missionCard(m){const h=progress.missionHistory[m.id],n=h?.plays||0;return `<article class="case-card" data-level="${m.level}"><div class="case-top"><span class="case-emoji">${m.icon}</span><span class="case-level">${m.level} · ${m.minutes} min</span></div><div class="case-category">${esc(m.skill)}</div><h3>${esc(m.title)}</h3><p>${esc(m.goal)}</p><div class="case-foot"><span>${n?`${n} ${n===1?'sesión':'sesiones'} · ${h.lastAccuracy}% último intento`:'2 variantes con transferencia'}</span><button class="button sm ${n?'ghost':'primary'}" data-a="openMission" data-id="${m.id}">${n?'Nuevo caso':'Empezar'} ↗</button></div></article>`}
function missions(){const filter=ui.missionFilter||'Todos',list=MISSIONS.filter(m=>filter==='Todos'||m.level===filter);const recommended=recommendMission();return heading('LAB DE INGLÉS REAL','Aprende a resolver, no a repetir','Casos cotidianos, profesionales y de pensamiento crítico. En cada variante aplicarás la habilidad en otro contexto.')+missionModeControls()+reviewPanel()+`<div class="missions-feature"><div><span class="eyebrow">✦ RECOMENDADO PARA TI · ${esc(recommended.level)}</span><h2>${recommended.icon} ${esc(recommended.title)}</h2><p>${esc(recommended.goal)}</p><button class="button primary" data-a="openMission" data-id="${recommended.id}">Practicar otra situación ↗</button></div><div class="case-promo-art" aria-hidden="true"><span>REAL</span><span>WORLD</span><span>ENGLISH.</span></div></div><div class="mini-guide"><span>01 · Elige qué dirías</span><span>02 · Aprende de la corrección</span><span>03 · Aplica la habilidad</span></div><div class="between wrap"><div class="section-label">EXPLORAR CASOS · ${list.length} MISIONES</div><div class="filters">${['Todos','A2','B1','B2','C1'].map(l=>`<button class="chip ${filter===l?'selected':''}" data-a="missionFilter" data-id="${l}">${l}</button>`).join('')}</div></div><div class="case-grid">${list.map(missionCard).join('')}</div><div class="info-note">Los niveles son aproximados, no equivalen a certificación. Se presentan nuevos contextos al regresar; la biblioteca puede ampliarse con más variantes.</div>`}

function missionModeControls(selected = AdaptiveLearning.mode(progress.learningMode)) {
  return `<div class="setting-line learning-mode"><div><strong>Modalidad</strong><p class="subtle">En curso evaluado debes entregar una respuesta escrita. La entrega se registra sin calificación lingüística.</p></div><select class="select" id="learningMode" aria-label="Modalidad de aprendizaje">${Object.entries(AdaptiveLearning.modes).map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>`;
}

function dueMissionReviews() {
  const today = day();
  return MISSIONS.filter(m => progress.missionReviews[m.id]?.due <= today)
    .sort((a, b) => progress.missionReviews[a.id].due.localeCompare(progress.missionReviews[b.id].due));
}

function reviewPanel() {
  const due = dueMissionReviews();
  return `<section class="card mt mb"><h2 class="section-h">Repasos de misiones</h2><p class="subtle">Los repasos se programan a 1, 3, 7 y 28 días. Si necesitas ayuda, vuelves al intervalo de 1 día al hacer un repaso pendiente.</p>${due.length
    ? due.map(m => `<div class="activity-row"><strong>${esc(m.title)}</strong><button class="button ghost sm" data-a="openMission" data-id="${m.id}">Repasar ↗</button></div>`).join('')
    : '<p>Hoy no tienes repasos pendientes.</p>'}</section>`;
}

function missionErrorEntries() {
  return Object.entries(progress.missionErrors).flatMap(([key, entry]) => {
    const [id, variant, index] = key.split('/');
    const mission = MISSIONS.find(m => m.id === id);
    const question = mission?.variants[variant]?.questions[index];
    return question && entry ? [{mission, question, entry}] : [];
  }).sort((a, b) => Number(Boolean(a.entry.resolved)) - Number(Boolean(b.entry.resolved)) ||
    Number(b.entry.times) - Number(a.entry.times) || String(b.entry.last).localeCompare(String(a.entry.last)));
}

function missionErrorPanel() {
  const entries = missionErrorEntries();
  return reviewPanel() + `<section class="card mt mb"><h2 class="section-h">Errores en misiones</h2><p class="subtle">Los errores pendientes se ordenan por frecuencia. Un acierto sin ayuda en otra sesión actualiza el estado de esa decisión.</p>${entries.length
    ? entries.map(({mission, question, entry}) => `<article class="debrief"><span class="tag">${esc(mission.title)} · ${Number(entry.times) || 0} ${Number(entry.times) === 1 ? 'fallo' : 'fallos'} · ${entry.resolved ? 'Reforzado' : 'Pendiente'}</span><h3>${esc(question.prompt)}</h3><p>${esc(question.why)}</p><p lang="en">${esc(question.example)}</p><button class="button ghost sm" data-a="openMission" data-id="${mission.id}">Practicar la misión ↗</button></article>`).join('')
    : '<p>Cuando una decisión te cueste, aparecerá aquí.</p>'}</section>`;
}

function adaptiveProgress() {
  const modes = Object.entries(AdaptiveLearning.modes).map(([mode, label]) => {
    const m = AdaptiveLearning.summarize(progress.missionResults, mode);
    const decisions = m.first + m.assisted + m.revealed;
    return `<section class="card"><h2 class="section-h">${label}</h2><dl class="result-list"><div><dt>Sesiones finalizadas</dt><dd>${m.completed}</dd></div><div><dt>Aciertos iniciales</dt><dd>${m.first}/${decisions}</dd></div><div><dt>Aciertos con ayuda</dt><dd>${m.assisted}</dd></div><div><dt>Soluciones explicadas</dt><dd>${m.revealed}</dd></div><div><dt>Respuestas escritas entregadas</dt><dd>${m.written}</dd></div></dl></section>`;
  }).join('');
  const demonstrated = MISSIONS.filter(m => progress.missionReviews[m.id]?.demonstratedOn);
  return `<div class="grid grid-2 mt">${modes}</div><section class="card mt"><h2 class="section-h">Transferencia demostrada</h2><p class="subtle">Se registra evidencia al acertar sin ayuda en los dos contextos durante repasos espaciados, incluido un repaso tras 28 días. Esta medida cubre decisiones con opciones.</p>${demonstrated.length
    ? `<ul>${demonstrated.map(m => `<li>${esc(m.title)} · ${esc(progress.missionReviews[m.id].demonstratedOn)}</li>`).join('')}</ul>`
    : '<p>Todavía no hay evidencia de transferencia en un repaso a 28 días.</p>'}</section>` + reviewPanel();
}

function openMission(id, assignment = null) {
  const mission = MISSIONS.find(m => m.id === id);
  if (!mission) return;
  const last = progress.missionVariants[id] ?? progress.missionHistory[id]?.lastVariant;
  const variant = last === 0 || last === 1 ? 1 - last : Math.floor(Math.random() * mission.variants.length);
  const questions = mission.variants[variant].questions;
  progress.missionVariants[id] = variant;
  save();
  recordCloudEvent('mission_started', id);
  ui.mission = {
    id, variant, index: 0, mode: AdaptiveLearning.mode(progress.learningMode), assignment,
    orders: questions.map(q => shuffle(q.choices.map((_, i) => i))),
    selected: null, wrong: [], solved: false, feedback: null, responses: [],
    stage: 'questions', showModel: false, transferText: progress.missionDrafts[id] || ''
  };
  ui.page = 'mission';
  location.hash = 'mission';
  render();
  focusPage();
}

function missionChoice(index) {
  const s = ui.mission;
  if (s?.stage !== 'questions' || s.solved || s.wrong.includes(index) || !s.orders[s.index].includes(index)) return;
  s.selected = index;
  render();
  document.querySelector('[data-a="missionChoice"][aria-pressed="true"]')?.focus();
}

function missionCheck(reveal = false) {
  const s = ui.mission;
  if (s?.stage !== 'questions' || s.solved || (reveal ? s.mode !== 'free' : s.selected === null)) return;
  const m = MISSIONS.find(m => m.id === s.id);
  const q = m.variants[s.variant].questions[s.index];
  const key = AdaptiveLearning.questionKey(m, s.variant, s.index);
  const chosen = s.selected;
  const correct = chosen === q.answer;
  let outcome;
  if (reveal) {
    outcome = 'revealed';
    s.feedback = {kind: 'hint', message: 'Solución explicada', detail: q.why};
  } else if (correct) {
    outcome = s.wrong.length ? 'assisted' : 'first';
    if (outcome === 'first') AdaptiveLearning.recordRecovery(progress.missionErrors, key, day());
    s.feedback = {kind: 'right', message: s.wrong.length ? 'Acertaste con la pista' : 'Acertaste al primer intento', detail: q.why};
  } else {
    s.wrong.push(chosen);
    if (s.wrong.length === 1) {
      AdaptiveLearning.recordError(progress.missionErrors, key, day());
      recordCloudEvent('mission_error', key);
      s.feedback = {kind: 'hint', message: 'Prueba una vez más', detail: q.details[chosen], hint: q.hint};
      s.selected = null;
    } else {
      outcome = 'revealed';
      s.feedback = {kind: 'wrong', message: 'Revisa la solución', detail: q.why};
    }
  }
  if (outcome) {
    s.solved = true;
    s.responses.push({q, outcome, wrong: [...s.wrong]});
  }
  save();
  render();
  document.querySelector('.mission-feedback')?.focus();
}

function missionNext() {
  const s = ui.mission;
  if (s?.stage !== 'questions' || !s.solved) return;
  s.index++;
  s.selected = null;
  s.wrong = [];
  s.solved = false;
  s.feedback = null;
  if (s.index >= MISSIONS.find(m => m.id === s.id).variants[s.variant].questions.length) s.stage = 'transfer';
  render();
  focusPage(s.stage === 'transfer' ? '.transfer-panel h2' : '.challenge-panel h2');
}

function finishMission() {
  const s = ui.mission;
  if (s?.stage !== 'transfer') return;
  const textbox = $('missionWrite');
  s.transferText = String(textbox?.value ?? s.transferText).trim().slice(0, 5000);
  progress.missionDrafts[s.id] = s.transferText;
  const writingSubmitted = words(s.transferText).length >= 3;
  if (s.mode === 'course' && !writingSubmitted) {
    save();
    const message = $('missionWriteStatus');
    if (message) message.textContent = 'Escribe al menos tres palabras para entregar tu respuesta.';
    textbox?.setAttribute('aria-invalid', 'true');
    textbox?.focus();
    return;
  }

  const m = MISSIONS.find(m => m.id === s.id);
  const old = progress.missionHistory[m.id] || {plays: 0, totalQuestions: 0, totalFirst: 0};
  const total = s.responses.length;
  const results = AdaptiveLearning.countResults(s.responses);
  const today = day();
  const accuracy = Math.round(results.first / total * 100);
  progress.missionHistory[m.id] = {
    plays: old.plays + 1, totalQuestions: old.totalQuestions + total, totalFirst: old.totalFirst + results.first,
    lastVariant: s.variant, lastDate: today, lastAccuracy: accuracy
  };
  const skill = progress.missionSkills[m.skill] || {first: 0, questions: 0};
  skill.first += results.first;
  skill.questions += total;
  progress.missionSkills[m.skill] = skill;
  AdaptiveLearning.recordCompletion(progress.missionResults, m.id, s.mode, results, writingSubmitted, today);
  progress.missionTimeline = StudyProfile.addMissionSession(progress.missionTimeline, m.id, s.mode, results, writingSubmitted, today);
  progress.missionReviews[m.id] = AdaptiveLearning.schedule(progress.missionReviews[m.id], {
    first: results.first, total, variant: s.variant
  }, today, plusDays);

  s.results = results;
  s.writingSubmitted = writingSubmitted;
  if (s.assignment) s.attempt = crypto.randomUUID();
  s.stage = 'done';
  activity(old.plays ? 8 : 24);
  recordCloudEvent('mission_completed', m.id, accuracy);
  recordCloudEvent('mission_skill', slug(m.skill).replace(/[^a-z0-9]+/g, '-'), accuracy);
  render();
  focusPage();
}

function explainAlternatives(q, wrong = []) {
  return `<ul class="option-explanations">${q.choices.map((choice, index) => `<li><strong>${index === q.answer ? 'Mejor respuesta' : wrong.includes(index) ? 'Tu intento' : 'Otra opción'}.</strong> ${esc(choice)}<br><span>${esc(q.details[index])}</span></li>`).join('')}</ul><p><strong>Ejemplo en inglés.</strong> <span lang="en">${esc(q.example)}</span></p><p class="translation">${esc(q.translation)}</p><button class="button ghost sm" data-a="speakAudio" data-text="${esc(q.example)}">Escuchar ejemplo</button>`;
}

function mission() {
  const s = ui.mission;
  if (!s) return heading('MISIONES', 'Selecciona una situación', 'Elige una misión para comenzar.') +
    '<button class="button primary" data-a="nav" data-id="missions">Ver misiones</button>';
  const m = MISSIONS.find(m => m.id === s.id);
  const v = m.variants[s.variant];
  const total = v.questions.length;
  const nav = `<button class="button ghost sm mb" data-a="nav" data-id="missions">← Todas las misiones</button><div class="mission-title-row"><div class="case-emoji" aria-hidden="true">${m.icon}</div><div><span class="section-label">${esc(m.level)} · ${esc(m.skill)} · ${AdaptiveLearning.modes[s.mode]}</span><h1>${esc(m.title)}</h1><p>${esc(m.goal)}</p></div></div>`;
  if (s.stage === 'done') {
    return nav + `<section class="mission-summary"><h2>Misión finalizada</h2><p><strong>${s.results.first}/${total}</strong> aciertos iniciales · <strong>${s.results.assisted}</strong> con ayuda · <strong>${s.results.revealed}</strong> soluciones explicadas.</p><p>${s.writingSubmitted ? 'Respuesta escrita entregada, sin calificación lingüística.' : 'Sin entrega escrita registrada.'}</p><p>Próximo repaso: <time datetime="${esc(progress.missionReviews[m.id].due)}">${esc(progress.missionReviews[m.id].due)}</time></p>${s.assignment ? classroomResultActions(s) : ''}<div class="mission-actions"><button class="button primary" data-a="openMission" data-id="${m.id}">Practicar otra variante ↻</button><button class="button ghost" data-a="nav" data-id="progress">Ver mi progreso</button></div></section><section class="card mt"><h2 class="section-h">Explicaciones de cierre</h2>${s.responses.map(({q, outcome, wrong}) => `<details class="debrief"><summary>${AdaptiveLearning.outcomes[outcome]} · ${esc(q.prompt)}</summary>${explainAlternatives(q, wrong)}</details>`).join('')}</section>`;
  }
  if (s.stage === 'transfer') {
    const required = s.mode === 'course';
    return nav + `<section class="transfer-panel"><h2 tabindex="-1">Escribe tu propia respuesta</h2><p>${esc(m.transfer)}</p><label for="missionWrite" class="label-input">Tu respuesta en inglés</label><p id="missionWriteHelp" class="subtle">${required ? 'Entrega obligatoria (al menos tres palabras).' : 'Entrega opcional. Puedes escribir una frase breve (al menos tres palabras) para registrarla.'} El texto permanece en tu dispositivo y puedes revisarlo con el ejemplo y la lista de criterios.</p><textarea id="missionWrite" class="mission-textarea" maxlength="5000" aria-describedby="missionWriteHelp missionWriteStatus" ${required ? 'required' : ''}>${esc(s.transferText)}</textarea><p id="missionWriteStatus" role="alert"></p><div class="button-group"><button class="button ghost" data-a="missionModel" aria-expanded="${s.showModel}">${s.showModel ? 'Ocultar ejemplo' : 'Comparar con un ejemplo'}</button><button class="button primary" data-a="missionFinish">Finalizar misión ↗</button></div>${s.showModel ? `<div class="feedback good mt"><strong>Una respuesta posible</strong><p lang="en">“${esc(m.model)}”</p><p><strong>Criterios de autoevaluación</strong></p><ul>${m.criteria.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}</section>`;
  }
  const q = v.questions[s.index];
  const order = s.orders[s.index];
  const options = order.map((i, display) => `<button type="button" class="mission-option ${s.selected === i ? 'selected' : ''} ${s.wrong.includes(i) ? 'eliminated' : ''} ${s.solved && i === q.answer ? 'solution' : ''}" aria-pressed="${s.selected === i}" ${s.solved || s.wrong.includes(i) ? 'disabled' : ''} data-a="missionChoice" data-index="${i}"><span class="opt-letter" aria-hidden="true">${String.fromCharCode(65 + display)}</span><span>${esc(q.choices[i])}</span></button>`).join('');
  const feedback = s.feedback ? `<div class="mission-feedback ${s.feedback.kind}" role="status" tabindex="-1"><strong>${esc(s.feedback.message)}</strong><p>${esc(s.feedback.detail)}</p>${s.feedback.hint ? `<p><strong>Pista.</strong> ${esc(s.feedback.hint)}</p>` : explainAlternatives(q, s.wrong)}</div>` : '';
  return nav + `<div class="mission-progress"><span>DECISIÓN ${s.index + 1} DE ${total}</span>${q.context ? '<strong>TRANSFERENCIA</strong>' : ''}</div><div class="case-layout"><section class="dialogue-panel"><span class="section-label">${q.context ? 'NUEVO CONTEXTO' : 'EL CONTEXTO'}</span><p class="context-description">${esc(q.context || v.context)}</p><div class="dialogue-bubble"><span>Tu objetivo</span><p>${esc(m.goal)}</p></div></section><section class="challenge-panel"><h2 tabindex="-1">${esc(q.prompt)}</h2>${s.solved ? '' : `<div class="mission-answers" role="group" aria-label="Opciones de respuesta">${options}</div>`}${feedback}<button class="button primary block mt" ${(!s.solved && s.selected === null) ? 'disabled' : ''} data-a="${s.solved ? 'missionNext' : 'missionCheck'}">${s.solved ? (s.index === total - 1 ? 'Ir a la práctica escrita →' : 'Siguiente decisión →') : 'Comprobar respuesta'}</button>${!s.solved && s.mode === 'free' ? '<button class="button ghost block mt" data-a="missionReveal">Ver solución sin responder</button>' : ''}</section></div>`;
}

function frequentSkills() {
  const bySkill = new Map();
  for (const {mission, entry} of missionErrorEntries()) {
    const errors = Math.max(0, Number(entry.times) || 0);
    if (!errors) continue;
    const totals = bySkill.get(mission.skill) || {errors: 0, pending: 0};
    totals.errors += errors;
    if (!entry.resolved) totals.pending++;
    bySkill.set(mission.skill, totals);
  }
  const top = [...bySkill.entries()].sort((a, b) => b[1].errors - a[1].errors || a[0].localeCompare(b[0], 'es')).slice(0, 5);
  return `<section class="card"><h2 class="section-h">Habilidades con más errores</h2>${top.length
    ? `<ul class="progress-ranking">${top.map(([skill, totals]) => `<li><strong>${esc(skill)}</strong><span>${totals.errors} ${totals.errors === 1 ? 'error' : 'errores'} · ${totals.pending} ${totals.pending === 1 ? 'decisión pendiente' : 'decisiones pendientes'}</span></li>`).join('')}</ul>`
    : '<p>Cuando una decisión de una misión te cueste, aparecerá aquí la habilidad que practicaste.</p>'}<button class="button ghost sm mt" data-a="nav" data-id="errors">Abrir cuaderno de errores</button></section>`;
}

function recentEvolution() {
  const recent = progress.missionTimeline.slice(-6).reverse().flatMap(entry => {
    const mission = MISSIONS.find(m => m.id === entry?.missionId);
    if (!mission) return [];
    const [first, assisted, revealed] = ['first', 'assisted', 'revealed'].map(key => {
      const value = Number(entry[key]);
      return Number.isInteger(value) && value >= 0 && value <= 3 ? value : 0;
    });
    const total = first + assisted + revealed;
    if (total !== 3) return [];
    return [`<li><div class="between wrap"><strong>${esc(mission.title)}</strong><time datetime="${esc(entry.date)}">${esc(entry.date)}</time></div><span class="small subtle">${AdaptiveLearning.modes[AdaptiveLearning.mode(entry.mode)]} · ${first}/${total} iniciales · ${assisted} con ayuda · ${revealed} soluciones</span>${progressBar(first, total)}</li>`];
  });
  return `<section class="card"><h2 class="section-h">Evolución reciente</h2><p class="subtle">Aciertos al primer intento por sesión de misión, de la más reciente a la más antigua.</p>${recent.length
    ? `<ol class="progress-timeline">${recent.join('')}</ol>`
    : '<p>Tus próximas misiones aparecerán aquí. El historial anterior sigue disponible más abajo.</p>'}</section>`;
}

function learningProgress() {
  const history = progress.missionHistory;
  const plays = missionCount();
  const rate = missionAccuracy();
  const skills = Object.entries(progress.missionSkills).filter(([, v]) => Number(v?.questions) > 0)
    .sort((a, b) => b[1].questions - a[1].questions);
  const latest = Object.keys(history).filter(id => history[id])
    .sort((a, b) => String(history[b].lastDate || '').localeCompare(String(history[a].lastDate || '')));
  return heading('MI PROGRESO', 'Tu progreso de aprendizaje', 'Consulta tus resultados, las habilidades que puedes reforzar y tus próximos repasos.') +
    `<div class="stats progress-stats"><div class="stat"><div class="value">${plays}</div><div class="label">Misiones finalizadas</div></div><div class="stat"><div class="value">${rate === null ? '—' : rate + '%'}</div><div class="label">Aciertos al primer intento</div></div><div class="stat"><div class="value">${dueMissionReviews().length}</div><div class="label">Repasos pendientes</div></div><div class="stat"><div class="value">${pendingErrors()}</div><div class="label">Errores pendientes</div></div></div><div class="grid grid-2 mt">${recentEvolution()}${frequentSkills()}</div>` +
    adaptiveProgress() +
    `<div class="grid grid-2 mt"><section class="card"><h2 class="section-h">Precisión inicial por habilidad</h2>${skills.length ? skills.map(([skill, v]) => `<div class="skill-row"><div class="between"><strong>${esc(skill)}</strong><span>${pct(Number(v.first) || 0, Number(v.questions))}% · ${Number(v.questions)} decisiones</span></div>${progressBar(Number(v.first) || 0, Number(v.questions))}</div>`).join('') : '<p>Completa una misión para empezar a ver datos de tus habilidades.</p>'}</section><section class="card"><h2 class="section-h">Historial de misiones</h2><p class="subtle">Incluye tu actividad anterior al cambio de marca.</p>${latest.length ? latest.slice(0, 8).map(id => {const mission = MISSIONS.find(m => m.id === id), v = history[id];return `<div class="activity-row"><strong>${esc(mission?.title || id)}</strong><span>${esc(v.lastAccuracy)}% · ${esc(v.lastDate)}</span></div>`;}).join('') : '<p>Aún no hay misiones completadas.</p>'}<button class="button ghost mt" data-a="nav" data-id="missions">Practicar misiones ↗</button></section></div>`;
}

function recordCloudEvent(type, id, score) {
  if (!ui.analyticsConsent || !ui.cloudUser || !window.XannyCloud?.studyAnalyticsAvailable()) return;
  window.XannyCloud.track(type, id, score).catch(() => {});
}


function switchWorkspace(user) {
  const key = user ? KEY + ':account:' + user.id : KEY;
  if (key === progressKey) return;
  progressSync?.stop();
  progressSync = null;
  syncSession = null;
  ui.syncState = {kind:'pending'};
  ui.deletionRequested = false;
  progressKey = key;
  progress = load();
  ui.syncName = user ? cleanAlias(readBrowserValue(key + ':alias')) : 'Estudiante';
  ui.lesson = null;
  ui.mission = null;
  ui.diagnostic = null;
  ui.writeFeedback = null;
  try { ui.recognition?.abort(); } catch {}
  ui.recognition = null;
  ui.speaking = false;
  ui.speakText = '';
  ui.speakFeedback = null;
  ui.listenIndex = Math.max(0, DATA.listening.findIndex(item => item.level === progress.level));
  ui.listenQuiz = null;
  ui.listenChoice = null;
  ui.listenAttempts = 0;
  ui.listenWrong = [];
  ui.listenChecked = false;
  ui.showTranscript = false;
  ui.speakIndex = Math.max(0, DATA.speaking.findIndex(item => item.level === progress.level));
  ui.writeIndex = Math.max(0, DATA.writing.findIndex(item => item.level === progress.level));
  ui.reviewQueue = null;
  ui.resetArmed = false;
  ui.classroomData = null;
  ui.classroomReport = null;
  ui.reportGroup = null;
  ui.classroomMessage = '';
  ui.teacherStats = null;
  ui.teacherRoster = null;
}

async function refreshCloudUser() {
  const cloud = window.XannyCloud;
  if (!cloud?.available() || ui.cloudBusy) return;
  const oldKey = progressKey;
  ui.cloudBusy = true;
  if (ui.page === 'account' || ui.page === 'classroom') render();
  try {
    const previous = ui.cloudUser?.id;
    ui.cloudUser = await cloud.currentUser();
    switchWorkspace(ui.cloudUser);
    ui.cachedAccount = false;
    rememberActiveAccount(ui.cloudUser?.id);
    if (previous !== ui.cloudUser?.id) {
      ui.analyticsConsent = false;
    }
    if (!ui.cloudUser) {
      cloud.startAnonymousVisits();
    } else {
      if (new URLSearchParams(location.search).has('auth')) {
        history.replaceState(null, '', location.pathname + '#account');
      }
      if (cloud.classroomAvailable() || cloud.studyAnalyticsAvailable()) {
        ui.analyticsConsent = await cloud.readConsent().catch(() => false);
      }
      if (cloud.classroomAvailable()) {
        try {
          ui.classroomData = await cloud.classroomContext();
          ui.classroomMessage = '';
        } catch {
          ui.classroomMessage = 'No se pudo consultar el aula. Puedes volver a intentarlo.';
        }
      }
      if (!progressSync) startProgressSync(ui.cloudUser.id);
      else if (ui.syncState.login) void progressSync.check();
      if (ui.page === 'account') ui.deletionRequested = await syncSession.readDeletion().catch(() => ui.deletionRequested);
    }
    ui.cloudNotice = '';
  } catch {
    ui.cloudNotice = 'No se pudo verificar la sesión. El historial de este navegador sigue disponible.';
    if (!ui.cloudUser) loadCachedAccount();
  } finally {
    ui.cloudBusy = false;
    if (progressKey !== oldKey || ui.page === 'account' || ui.page === 'classroom') render();
  }
}


function readBrowserValue(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function rememberActiveAccount(account) {
  try {
    if (account) localStorage.setItem(activeAccountKey, account);
    else localStorage.removeItem(activeAccountKey);
  } catch {}
}

function loadCachedAccount() {
  const id = readBrowserValue(activeAccountKey);
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id || '')) return;
  switchWorkspace({id});
  ui.cachedAccount = true;
  setSyncState({kind: navigator.onLine === false ? 'offline' : 'error'});
}

function cleanAlias(value) {
  return String(value || '').trim().slice(0,60) || 'Estudiante';
}

function displaySyncStatus() {
  const state = ui.syncState;
  const label = $('accountSyncStatus');
  if (label) {
    label.textContent = ProgressSync.labels[state.kind];
    label.dataset.state = state.kind;
  }
  const help = $('accountSyncHelp');
  if (help) {
    help.textContent = state.login ? 'Vuelve a iniciar sesión. Tus cambios pendientes siguen aquí.' :
      state.conflict ? 'Hay otra copia guardada. Elige qué historial usar antes de continuar.' :
      state.kind === 'offline' ? 'Tu avance se guarda aquí hasta recuperar la conexión.' :
      state.kind === 'error' ? 'Tu historial local sigue disponible. Puedes volver a intentar la sincronización.' :
      state.updatedAt ? 'Última copia confirmada: ' + new Date(state.updatedAt).toLocaleString('es') :
      'Se sincroniza automáticamente cuando hay conexión.';
  }
  const choices = $('accountSyncConflict');
  if (choices) {
    choices.hidden = !state.conflict;
    $('accountConflictDate').textContent = state.remoteDate ? 'Copia remota del ' + new Date(state.remoteDate).toLocaleString('es') :
      'La copia remota ya no está disponible.';
    $('accountConflictRestore').disabled = !state.remoteRevision || state.kind === 'offline';
    $('accountConflictKeep').disabled = state.kind === 'offline';
  }
  const login = $('accountSyncLogin');
  if (login) login.hidden = !state.login;
  const backup = $('accountUndo');
  if (backup) backup.hidden = !canRestorePrevious();
  const otherTab = $('accountOtherTab');
  if (otherTab) otherTab.hidden = !readBrowserValue(progressKey + ':other-tab');
  const nickname = $('accountNickname');
  if (nickname && document.activeElement !== nickname && nickname.dataset.touched !== 'true') nickname.value = ui.syncName;
  const level = $('accountLevel');
  if (level && document.activeElement !== level && level.dataset.touched !== 'true') level.value = progress.level;
}

function setSyncState(state) {
  ui.syncState = state;
  displaySyncStatus();
}

function recoveryKey() {
  return progressKey + ':recovery';
}

function canRestorePrevious() {
  return Boolean(readBrowserValue(recoveryKey()));
}

function currentProfile() {
  return {nickname: ui.syncName, snapshot: StudyProfile.snapshot(progress)};
}

function archiveProfile(profile) {
  localStorage.setItem(recoveryKey(), JSON.stringify(profile));
}

function setProfileName(value) {
  const name = cleanAlias(value);
  localStorage.setItem(progressKey + ':alias', name);
  ui.syncName = name;
}

function applyStudyProfile(payload, previous, allowSync) {
  if (previous) archiveProfile(previous);
  const next = normalizeProgress({...progress, ...payload.snapshot});
  const raw = JSON.stringify(next);
  localStorage.setItem(progressKey, raw);
  localStorage.setItem(progressKey + ':alias', cleanAlias(payload.nickname));
  lastLocalRecord = raw;
  storageOK = true;
  progress = next;
  ui.syncName = cleanAlias(payload.nickname);
  ui.reviewQueue = null;
  if (allowSync) progressSync?.queue();
  if (ui.page === 'home' || ui.page === 'progress') render();
}

function startProgressSync(account) {
  const scope = progressKey;
  const session = XannyCloud.bindProgress(account);
  syncSession = session;
  progressSync = ProgressSync.create({
    online: () => navigator.onLine !== false,
    readLocal: currentProfile,
    hasLocal: () => Boolean(readBrowserValue(scope) || readBrowserValue(scope + ':alias')),
    readMeta: () => {
      try { return JSON.parse(readBrowserValue(scope + ':sync') || '{}'); } catch { return {}; }
    },
    writeMeta: meta => localStorage.setItem(scope + ':sync', JSON.stringify(meta)),
    readRemote: session.read,
    writeRemote: (value, revision) => {
      if (scope !== progressKey || !storageOK) throw Error('La copia local no se pudo guardar.');
      return session.write(value, revision);
    },
    convertRemote: row => ({nickname: cleanAlias(row.nickname), snapshot: StudyProfile.snapshot(
      normalizeProgress({...defaults(), ...StudyProfile.snapshot(row.snapshot), level: row.level})
    )}),
    applyLocal: (payload, previous, backup) => applyStudyProfile(payload, backup ? previous : null, false),
    archive: archiveProfile,
    onState: setSyncState
  });
  void progressSync.check();
}

function updateAccountProfile() {
  if (!ui.cloudUser && !ui.cachedAccount) return;
  const value = $('accountLevel')?.value;
  if (!StudyProfile.levels.includes(value)) return;
  try {
    setProfileName($('accountNickname')?.value);
    progress.level = value;
    ui.reviewQueue = null;
    if (!save()) throw Error('No se pudo guardar.');
    ui.cloudNotice = 'Perfil actualizado en este navegador.';
    render();
  } catch {
    toast('No se pudo guardar el perfil en este navegador.');
  }
}

function undoCloudRestore() {
  if (!ui.cloudUser && !ui.cachedAccount) return;
  try {
    const record = JSON.parse(readBrowserValue(recoveryKey()) || 'null');
    const previous = StudyProfile.snapshot(record?.snapshot || record);
    if (previous?.version !== 1 || !confirm('¿Recuperar el respaldo anterior? La siguiente sincronización usará estos cambios.')) return;
    applyStudyProfile({nickname: record.nickname || ui.syncName, snapshot: previous}, currentProfile(), true);
    ui.cloudNotice = 'Progreso anterior recuperado en este navegador.';
    render();
  } catch {
    toast('No se pudo recuperar el respaldo anterior.');
  }
}

function copyGuestProgress(combine) {
  if ((!ui.cloudUser && !ui.cachedAccount) || ui.cloudBusy) return;
  try {
    const guest = StudyProfile.snapshot(JSON.parse(readBrowserValue(KEY) || 'null'));
    if (guest?.version !== 1) {
      toast('Este navegador todavía no tiene progreso sin cuenta.');
      return;
    }
    const prompt = combine ? '¿Combinar ambos historiales? Las actividades coincidentes conservan el mayor avance registrado.' :
      '¿Reemplazar el historial de estudio de la cuenta con el progreso sin cuenta?';
    if (!confirm(prompt + ' Tus borradores permanecen en su espacio original y se guardará un respaldo local.')) return;
    const current = currentProfile();
    const snapshot = combine ? StudyProfile.combine(current.snapshot, guest) :
      StudyProfile.snapshot(normalizeProgress({...defaults(), ...guest}));
    applyStudyProfile({nickname: current.nickname, snapshot}, current, true);
    ui.cloudNotice = 'Se importó el progreso de estudio sin cuenta.';
    render();
  } catch {
    toast('No se pudo importar el avance sin cuenta.');
  }
}

async function requestAccountDeletion(requested) {
  if (!ui.cloudUser || !syncSession || ui.cloudBusy) return;
  const message = requested ? '¿Solicitar la eliminación de tu cuenta y sus datos en la nube? El responsable verificará la solicitud.' :
    '¿Cancelar la solicitud de eliminación?';
  if (!confirm(message)) return;
  ui.cloudBusy = true;
  render();
  try {
    ui.deletionRequested = await syncSession.requestDeletion(requested);
    ui.cloudNotice = requested ? 'Solicitud registrada. Puedes cancelarla mientras esté pendiente.' : 'Solicitud de eliminación cancelada.';
  } catch {
    ui.cloudNotice = 'No se pudo actualizar la solicitud.';
  } finally {
    ui.cloudBusy = false;
    if (ui.page === 'account') render();
  }
}

async function changeAnalyticsConsent(enabled) {
  if (!ui.cloudUser || ui.cloudBusy || (enabled && !window.XannyCloud?.studyAnalyticsAvailable())) return;
  if (!enabled) ui.analyticsConsent = false;
  ui.cloudBusy = true;
  render();
  try {
    ui.analyticsConsent = await XannyCloud.setConsent(enabled);
    ui.cloudNotice = enabled ? 'Analítica de estudio autorizada.' : 'Analítica desactivada y eventos de estudio eliminados.';
  } catch {
    ui.cloudNotice = 'No se pudo actualizar la autorización en el servidor. Vuelve a intentarlo.';
  } finally {
    ui.cloudBusy = false;
    if (ui.page === 'account') render();
  }
}

async function cloudLogin(register, emailHint) {
  const cloud = window.XannyCloud;
  if (!cloud?.available() || ui.cloudBusy) return;
  const email = (emailHint || $('accountEmail')?.value || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    toast('Escribe un correo válido.');
    return;
  }
  if (register && (!$('accountAdult')?.checked || !$('accountConsent')?.checked)) {
    toast('Confirma la mayoría de edad y acepta la política de privacidad para registrarte.');
    return;
  }
  ui.cloudBusy = true;
  ui.cloudNotice = 'Enviando enlace…';
  render();
  try {
    await cloud.sendLogin(email, register);
    ui.cloudNotice = 'Si el correo puede continuar, recibirás un enlace de acceso. Ábrelo en este navegador.';
  } catch {
    ui.cloudNotice = 'No se pudo enviar el enlace. Revisa el correo o vuelve a intentarlo.';
  } finally {
    ui.cloudBusy = false;
    if (ui.page === 'account') render();
  }
}

function cloudRestore() {
  if (!progressSync || ui.syncState.kind === 'syncing') return;
  if (confirm('¿Usar la copia en la nube en este navegador? Conservaremos un respaldo del historial local.')) void progressSync.restore();
}
function keepLocalCopy() {
  if (!progressSync || !ui.syncState.conflict || ui.syncState.kind === 'syncing') return;
  if (confirm('¿Guardar el progreso de este navegador en la nube? Conservaremos un respaldo de la otra copia.')) void progressSync.keep();
}
async function cloudLogout(clearDevice = false) {
  if (!ui.cloudUser || ui.cloudBusy) return;
  if (clearDevice && !confirm('¿Cerrar sesión y borrar las copias locales de esta cuenta? Exporta antes cualquier cambio pendiente que quieras conservar.')) return;
  const oldScope = progressKey;
  ui.cloudBusy = true;
  render();
  try {
    await XannyCloud.logout();
    ui.cloudUser = null;
    ui.cachedAccount = false;
    rememberActiveAccount(null);
    switchWorkspace(null);
    if (clearDevice) {
      for (const suffix of ['', ':alias', ':sync', ':recovery', ':other-tab']) localStorage.removeItem(oldScope + suffix);
    }
    ui.analyticsConsent = false;
    ui.teacherStats = null;
    ui.teacherRoster = null;
    ui.cloudNotice = 'Sesión cerrada. El progreso sin cuenta sigue disponible en este navegador.';
  } catch {
    ui.cloudNotice = 'No se pudo cerrar la sesión.';
  } finally {
    ui.cloudBusy = false;
    if (ui.page === 'account') render();
  }
}
async function cloudTeacher(){if(!ui.cloudUser){toast('Necesitas iniciar sesión.');return}ui.cloudBusy=true;render();try{ui.teacherStats=await XannyCloud.teacherSummary();ui.cloudNotice='Estadísticas del proyecto consultadas con permisos de administrador.'}catch(e){ui.teacherStats=null;ui.cloudNotice='Panel no disponible: '+e.message}finally{ui.cloudBusy=false;render()}}
async function cloudRoster(){if(!ui.cloudUser){toast('Necesitas iniciar sesión.');return}ui.cloudBusy=true;render();try{ui.teacherRoster=await XannyCloud.teacherRoster();ui.cloudNotice='Listado de alumnos guardado y consultado con permisos de administrador.'}catch(e){ui.teacherRoster=null;ui.cloudNotice='Listado no disponible: '+e.message}finally{ui.cloudBusy=false;render()}}

function account() {
  const cloud = window.XannyCloud;
  const configured = Boolean(cloud?.available());
  const user = ui.cloudUser;
  const localAccount = user || ui.cachedAccount;
  const ss = ui.teacherStats;
  const analytics = Boolean(cloud?.studyAnalyticsAvailable());
  const disabled = !configured || ui.cloudBusy ? 'disabled' : '';
  const admin = ui.classroomData?.role === 'admin';
  const login = configured ? `<label class="label-input" for="accountEmail">Correo electrónico</label><input id="accountEmail" class="account-input" type="email" autocomplete="email" placeholder="nombre@correo.com" ${disabled}><div class="button-group mt"><button class="button primary" data-a="cloudLogin" ${disabled}>Iniciar sesión</button><button class="button ghost" data-a="cloudRegister" ${disabled}>Crear cuenta</button></div><label class="consent-row mt"><input type="checkbox" id="accountConsent"><span>Para crear una cuenta, acepto el uso de mi correo y el guardado automático del progreso. <a href="${esc(cloud.privacyPolicyUrl)}" target="_blank" rel="noopener noreferrer">Política de privacidad</a></span></label><label class="consent-row"><input type="checkbox" id="accountAdult"><span>Declaro que soy mayor de 18 años.</span></label><p class="subtle">Abre el enlace desde el navegador que lo solicitó.</p>`
    : '<p>Próximamente podrás acceder o crear una cuenta mediante un enlace enviado por correo. El servicio de cuentas todavía está desactivado.</p><div class="button-group"><button class="button primary" disabled>Iniciar sesión</button><button class="button ghost" disabled>Crear cuenta</button></div>';
  const profile = localAccount ? `<p>${user ? 'Sesión de <strong>' + esc(user.email || 'estudiante') + '</strong>' : 'Espacio de cuenta guardado en este navegador.'}</p><div class="grid grid-2 account-fields"><div><label class="label-input" for="accountNickname">Nombre visible</label><input id="accountNickname" class="account-input" maxlength="60" value="${esc(ui.syncName)}"></div><div><label class="label-input" for="accountLevel">Nivel de inglés</label><select class="field" id="accountLevel">${StudyProfile.levels.map(level => `<option ${level === progress.level ? 'selected' : ''}>${level}</option>`).join('')}</select></div></div><div class="button-group mt"><button class="button primary" data-a="saveAccountProfile" ${disabled}>Guardar perfil</button><button class="button ghost" data-a="cloudLogout" ${user ? disabled : 'disabled'}>Cerrar sesión</button></div>` : login;
  const storage = localAccount ? `<div class="account-sync-status"><strong id="accountSyncStatus" role="status" aria-live="polite"></strong><p id="accountSyncHelp"></p></div><div id="accountSyncConflict" class="info-note mt" hidden><strong>Hay dos versiones del progreso</strong><p id="accountConflictDate"></p><div class="button-group"><button class="button ghost" id="accountConflictKeep" data-a="keepLocalCopy">Usar esta copia</button><button class="button ghost" id="accountConflictRestore" data-a="cloudRestore">Usar la copia de la nube</button></div></div><div class="button-group mt"><button class="button ghost sm" data-a="cloudSave" ${user ? disabled : 'disabled'}>Sincronizar ahora</button><button class="button ghost sm" data-a="cloudRestore" ${user ? disabled : 'disabled'}>Restaurar copia</button><button class="button ghost sm" id="accountSyncLogin" data-a="renewCloudSession" hidden>Solicitar otro enlace</button></div><details class="account-history mt"><summary>Importar o recuperar historial</summary><p>Importa el progreso que hiciste en este navegador sin cuenta. Los borradores permanecen en el espacio donde se escribieron.</p><div class="button-group"><button class="button ghost sm" data-a="copyGuestProgress">Combinar progreso sin cuenta</button><button class="button ghost sm" data-a="replaceGuestProgress">Reemplazar con progreso sin cuenta</button><button class="button ghost sm" id="accountUndo" data-a="undoCloudRestore" hidden>Recuperar respaldo previo</button></div><button class="button ghost sm mt" id="accountOtherTab" data-a="exportOtherTab" hidden>Descargar historial de otra pestaña</button></details>`
    : `<p>${configured ? 'Inicia sesión para recuperar tu avance y sincronizarlo entre dispositivos.' : 'La sincronización en la nube está desactivada.'}</p>`;
  return heading('MI CUENTA', 'Tu cuenta y tus datos', 'Estudia sin cuenta o lleva tu progreso a tus dispositivos. Los borradores permanecen en este navegador.') +
    `<div class="grid grid-2"><section class="card"><h2 class="section-h">Cuenta de estudiante</h2>${profile}${ui.cloudNotice ? `<div class="info-note mt" role="status">${esc(ui.cloudNotice)}</div>` : ''}</section><section class="card"><h2 class="section-h">Progreso y sincronización</h2>${storage}<div class="divider"></div><p>${storageOK ? 'Tu avance se guarda en este navegador.' : 'El navegador restringe el guardado local. Exporta tu avance antes de cerrar.'}</p><button class="button ghost sm" data-a="nav" data-id="settings">Exportar o importar un archivo</button></section></div><section class="card mt"><h2 class="section-h">Privacidad y actividad</h2><div class="activity-row"><span>Visitas anónimas agregadas</span><strong>${cloud?.visitorAnalyticsAvailable() ? 'Activadas' : 'Desactivadas'}</strong></div><div class="activity-row"><span>Analítica de estudio en la nube</span><strong>${analytics ? 'Disponible con tu autorización' : 'Desactivada'}</strong></div><label class="consent-row mt"><input id="studyAnalyticsConsent" type="checkbox" ${ui.analyticsConsent ? 'checked' : ''} ${(analytics || ui.analyticsConsent) && user && !ui.cloudBusy ? '' : 'disabled'}><span>Permitir el registro de inicios de práctica, actividades terminadas, tipos de error y resultados por habilidad.</span></label>${user ? `<details class="account-history mt"><summary>Eliminar cuenta y datos</summary><p>${ui.deletionRequested ? 'Tu solicitud está pendiente de revisión.' : 'Puedes solicitar la eliminación de la cuenta, el progreso remoto y los datos asociados.'} Puedes borrar por separado los datos de esta cuenta en este navegador.</p><button class="button ghost" data-a="${ui.deletionRequested ? 'cancelDeletion' : 'requestDeletion'}" ${disabled}>${ui.deletionRequested ? 'Cancelar solicitud' : 'Solicitar eliminación'}</button><button class="button ghost mt" data-a="clearAccountDevice" ${disabled}>Cerrar sesión y limpiar este navegador</button></details>` : ''}${admin ? `<div class="button-group mt"><button class="button ghost" data-a="cloudTeacher" ${disabled}>Resumen administrativo</button><button class="button ghost" data-a="cloudRoster" ${disabled}>Listado de alumnos</button></div>` : ''}</section>` + `${Array.isArray(ui.teacherRoster)?`<section class="card mt"><h2 class="section-h">Alumnos con perfil guardado · hasta 200</h2><p class="subtle">Los alias y niveles son información voluntaria. No se muestran correos ni escritos.</p>${ui.teacherRoster.length?ui.teacherRoster.map(r=>`<div class="activity-row"><span><strong>${esc(r.alias)}</strong> · ${esc(r.level)}</span><span>${Number(r.activities)||0} eventos · ${r.lastActivity?esc(String(r.lastActivity).slice(0,10)):'Sin actividad'}</span></div>`).join(''):'<p>No hay perfiles guardados todavía.</p>'}</section>`:''}${ss?`<section class="card mt"><h2 class="section-h">Resumen del proyecto · acceso autorizado</h2><div class="stats"><div class="stat"><div class="value">${Number(ss.accounts)||0}</div><div class="label">Estudiantes registrados</div></div><div class="stat"><div class="value">${Number(ss.profiles)||0}</div><div class="label">Con respaldo de progreso</div></div><div class="stat"><div class="value">${Number(ss.active7d)||0}</div><div class="label">Estudiantes activos (7 días)*</div></div><div class="stat"><div class="value">${Number(ss.events7d)||0}</div><div class="label">Módulos registrados 7 días</div></div></div><p class="subtle">*Activos = usuarios con al menos un evento registrado (requiere que hayan autorizado el registro). No equivale a visitas.</p></section>`:''}<section class="card mt"><h2 class="section-h">Antes de abrir a alumnos reales</h2><p>Se requiere política de privacidad, autorización informada, revisión de seguridad y pruebas con varios usuarios. Si se aceptan menores, deben aplicarse garantías adicionales y autorización válida de sus representantes.</p></section>`;
}


function numeric(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function classroomReportHtml(group, report) {
  const totals = report.totals || {};
  const metrics = [
    ['Alumnos inscritos', report.members], ['Actividades completadas', totals.completed],
    ['Resultados enviados', totals.attempts], ['Aciertos iniciales', totals.first],
    ['Aciertos con ayuda', totals.assisted], ['Textos entregados', totals.written],
    ['Repasos pendientes informados', report.pending]
  ];
  const skills = report.skills || [];
  const recent = report.recent || [];
  const roster = report.roster || [];
  return `<section class="card mt"><h2 class="section-h">Resultados de ${esc(group.name)}</h2><p class="subtle">Los datos reflejan intentos compartidos por los alumnos. Los repasos usan la fecha compartida más reciente por alumno y actividad. La entrega escrita registra participación sin corrección lingüística.</p><dl class="result-list">${metrics.map(([label, value]) => `<div><dt>${label}</dt><dd>${numeric(value)}</dd></div>`).join('')}</dl><h3>Evolución semanal por habilidad</h3>${skills.length
    ? `<ol class="progress-timeline">${skills.map(row => `<li><div class="between wrap"><strong>${esc(row.skill)}</strong><time>${esc(row.week)}</time></div><span>${numeric(row.first)}/${numeric(row.attempts) * 3} iniciales · ${numeric(row.assisted)} con ayuda</span></li>`).join('')}</ol>`
    : '<p>Aún no hay resultados semanales.</p>'}<h3>Alumnos inscritos</h3>${roster.length
    ? `<ul class="progress-ranking">${roster.map(row => `<li><strong>${esc(row.alias)}</strong><span>${numeric(row.completed)} misiones compartidas</span></li>`).join('')}</ul>`
    : '<p>Aún no hay alumnos inscritos.</p>'}<h3>Resultados recientes</h3>${recent.length
    ? `<ol class="progress-timeline">${recent.map(row => `<li><strong>${esc(row.alias)}</strong> · ${esc(MISSIONS.find(m => m.id === row.mission)?.title || row.mission)}<br><span>${numeric(row.first)} iniciales · ${numeric(row.assisted)} con ayuda · ${row.written ? 'Texto entregado' : 'Sin texto registrado'}</span></li>`).join('')}</ol>`
    : '<p>Aún no hay entregas compartidas.</p>'}</section>`;
}

function classroomGroup(group) {
  const disabled = ui.classroomBusy ? 'disabled' : '';
  const id = esc(group.id);
  const assigned = group.assignments || [];
  const available = MISSIONS.filter(m => !assigned.some(item => item.missionId === m.id));
  const manage = group.manage ? `<label class="label-input" for="code-${id}">Código privado de inscripción</label><input class="field" id="code-${id}" value="${esc(group.invite)}" readonly><div class="button-group mt"><button class="button ghost sm" data-a="classRotate" data-id="${id}" ${disabled}>Renovar código</button><button class="button ghost sm" data-a="classReport" data-id="${id}" ${disabled}>Ver resultados</button></div>${available.length ? `<div class="divider"></div><label class="label-input" for="assign-${id}">Asignar una misión</label><select class="field" id="assign-${id}">${available.map(m => `<option value="${esc(m.id)}">${esc(m.title)}</option>`).join('')}</select><button class="button primary sm mt" data-a="classAssign" data-id="${id}" ${disabled}>Asignar misión</button>` : ''}` : '';
  return `<section class="card"><h2 class="section-h">${esc(group.name)}</h2>${manage}<h3>Misiones asignadas</h3>${assigned.length ? `<ul class="progress-timeline">${assigned.map(item => {
    const mission = MISSIONS.find(m => m.id === item.missionId);
    if (!mission) return '';
    return `<li class="activity-row"><span><strong>${esc(mission.title)}</strong>${item.sent ? '<br><span class="subtle">Resultado enviado</span>' : ''}</span>${group.manage ? '' : `<button class="button ghost sm" data-a="classMission" data-id="${esc(item.id)}" ${disabled}>Practicar</button>`}</li>`;
  }).join('')}</ul>` : '<p>Aún no hay misiones asignadas.</p>'}</section>`;
}

function classroom() {
  const head = heading('AULA VIRTUAL', 'Tu aula virtual', 'Accede a tus clases, practica misiones asignadas y consulta los resultados compartidos.');
  if (!window.XannyCloud?.classroomAvailable()) {
    return head + '<section class="card"><p>El aula virtual está desactivada. Las misiones y el progreso local siguen disponibles.</p><button class="button primary" data-a="nav" data-id="missions">Practicar misiones</button></section>';
  }
  if (ui.cloudBusy) return head + '<p role="status">Consultando el aula…</p>';
  if (!ui.cloudUser) return head + '<section class="card"><p>Inicia sesión para unirte a una clase.</p><button class="button primary" data-a="nav" data-id="account">Ir a Mi cuenta</button></section>';
  const state = ui.classroomData;
  const status = ui.classroomMessage ? `<p class="info-note" role="status">${esc(ui.classroomMessage)}</p>` : '';
  if (!state) return head + status + '<button class="button ghost" data-a="cloudRefresh">Volver a consultar</button>';
  const group = state.groups.find(g => g.id === ui.reportGroup);
  const disabled = ui.classroomBusy ? 'disabled' : '';
  const tools = state.role === 'student'
    ? `<section class="card"><h2 class="section-h">Unirme a una clase</h2><label class="label-input" for="classCode">Código de inscripción</label><input class="field" id="classCode" maxlength="36" autocomplete="off"><label class="label-input mt" for="classAlias">Alias visible para el docente</label><input class="field" id="classAlias" maxlength="60"><button class="button primary mt" data-a="classJoin" ${disabled}>Unirme a la clase</button></section>`
    : `<section class="card"><h2 class="section-h">Crear un grupo</h2><label class="label-input" for="className">Nombre del grupo</label><input class="field" id="className" maxlength="80"><button class="button primary mt" data-a="classCreate" ${disabled}>Crear grupo</button></section>`;
  return head + status + tools + (state.groups.length ? `<div class="grid grid-2 mt">${state.groups.map(classroomGroup).join('')}</div>` : '<p class="mt">Aún no tienes clases.</p>') +
    (group?.manage && ui.classroomReport ? classroomReportHtml(group, ui.classroomReport) : '');
}

async function classroomAction(task, success, reportGroup = null) {
  if (!ui.cloudUser || ui.cloudBusy || ui.classroomBusy || !window.XannyCloud?.classroomAvailable()) return;
  const owner = ui.cloudUser.id;
  ui.classroomBusy = true;
  render();
  try {
    const result = await task();
    if (ui.cloudUser?.id !== owner) return;
    if (reportGroup) {
      ui.reportGroup = reportGroup;
      ui.classroomReport = result;
    } else {
      const state = await XannyCloud.classroomContext();
      if (ui.cloudUser?.id !== owner) return;
      ui.classroomData = state;
    }
    ui.classroomMessage = success;
  } catch (error) {
    if (ui.cloudUser?.id !== owner) return;
    ui.classroomMessage = error?.code === '42501' ? 'Tu cuenta no tiene permiso para esa acción.' :
      error?.code === '22023' ? 'Revisa el código o los datos de la actividad.' : 'No se pudo completar la acción. Vuelve a intentarlo.';
  } finally {
    ui.classroomBusy = false;
    if (ui.page === 'classroom') render();
  }
}

function openClassMission(assignmentId) {
  if (ui.classroomData?.role !== 'student') return;
  for (const group of ui.classroomData.groups) {
    const assignment = group.assignments.find(a => a.id === assignmentId);
    if (assignment) {
      openMission(assignment.missionId, {id: assignment.id, name: group.name, owner: ui.cloudUser?.id});
      return;
    }
  }
}

function classroomResultActions(session) {
  return `<div class="info-note"><p>El envío comparte los aciertos, la fecha de repaso y si entregaste un texto con el docente de ${esc(session.assignment.name)}. Tu texto permanece en este dispositivo.</p><button class="button ghost" data-a="classSubmit" ${session.sent || session.sending ? 'disabled' : ''}>${session.sent ? 'Resultado enviado' : session.sending ? 'Enviando…' : 'Compartir resultado con mi clase'}</button>${session.classNotice ? `<p role="status">${esc(session.classNotice)}</p>` : ''}</div>`;
}

async function sendClassResult() {
  const s = ui.mission;
  if (s?.stage !== 'done' || !s.assignment || s.sent || s.sending || !ui.cloudUser || ui.cloudUser.id !== s.assignment.owner) return;
  s.sending = true;
  render();
  try {
    await XannyCloud.submitResult(s.assignment.id, {attempt: s.attempt, mode: s.mode, ...s.results,
      written: s.writingSubmitted, reviewDue: progress.missionReviews[s.id].due});
    s.sent = true;
    s.classNotice = 'Tu clase recibió el resultado.';
  } catch {
    s.classNotice = 'No se pudo compartir. Tu resultado sigue guardado en el progreso local.';
  } finally {
    s.sending = false;
    if (ui.page === 'mission' && ui.mission === s) render();
  }
}

function render(){if(!sections.some(s=>s[0]===ui.page)&&!['lesson','mission','diagnostic'].includes(ui.page))ui.page='home';const page={home,missions,mission,progress:learningProgress,account,classroom,path,listen,speak,cards,errors,grammar,lesson,write,resources,settings,diagnostic}[ui.page];shell(page());if(ui.page==='account')displaySyncStatus();}
function speakText(text,rate){if(!('speechSynthesis'in window)){toast('Este navegador no ofrece voz sintética. Prueba con Chrome, Edge o Safari.');return}try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(text).replace(/\b[A-Za-z]+:\s/g,''));u.lang=progress.accent||'en-US';u.rate=rate||Number(progress.rate||0.9);u.pitch=1;const voices=speechSynthesis.getVoices();const desired=voices.find(v=>v.lang===u.lang)||voices.find(v=>v.lang.startsWith('en'));if(desired)u.voice=desired;u.onerror=e=>{if(e.error!=='canceled'&&e.error!=='interrupted')toast('No se pudo reproducir el audio. Verifica las voces del dispositivo.')};speechSynthesis.speak(u)}catch(e){toast('Error de audio: comprueba las opciones de voz del navegador.')}}
function compareSpeech(expected,actual){const a=normal(expected).split(' ').filter(Boolean),b=normal(actual).split(' ').filter(Boolean);const dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=0;i<=a.length;i++)dp[i][0]=i;for(let j=0;j<=b.length;j++)dp[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));const score=Math.round(Math.max(0,1-dp[a.length][b.length]/Math.max(1,a.length,b.length))*100);const rest=[...b],missing=[];for(const w of a){let ix=rest.indexOf(w);if(ix===-1)missing.push(w);else rest.splice(ix,1)}return {score,missing:missing.slice(0,8),message:score>=90?'¡Muy buena coincidencia! Intenta decirlo otra vez sin leer.':score>=70?'Buena base. Repite fijándote en el ritmo y las palabras que faltaron.':'Escucha de nuevo y practica en fragmentos de 3 a 5 palabras.'}}
function record(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast('Reconocimiento de voz no disponible aquí. Usa el cuadro de texto.');return}if(ui.speaking){try{ui.recognition?.stop()}catch(e){}ui.speaking=false;render();return}try{const r=new SR();ui.recognition=r;r.lang=progress.accent;r.interimResults=false;r.continuous=false;r.maxAlternatives=1;ui.speaking=true;r.onresult=e=>{const t=e.results[0][0].transcript;ui.speakText=t;ui.speakFeedback=null;ui.speaking=false;render();toast('Voz reconocida. Puedes comparar la frase.')};r.onerror=e=>{ui.speaking=false;render();const dict={not:'', 'not-allowed':'Permiso de micrófono denegado. Revisa los permisos del navegador.',network:'El servicio de voz no está disponible. Usa el modo escrito.', 'no-speech':'No se detectó voz. Prueba otra vez.'};toast(dict[e.error]||`No fue posible reconocer la voz (${e.error}).`)};r.onend=()=>{if(ui.speaking){ui.speaking=false;render()}};r.start();render()}catch(e){ui.speaking=false;toast('No se pudo iniciar el micrófono. Usa HTTPS o localhost y revisa permisos.');render()}}
function downloadData(other){try{const source=typeof other==='string'?JSON.parse(other):progress;const blob=new Blob([JSON.stringify({...source,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`Aprende-con-Xanny-progreso-${day()}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Copia del progreso exportada.')}catch(e){toast('No fue posible exportar el archivo.')}}
function importData(file){if(!file)return;if(file.size>2_000_000){toast('La copia es demasiado grande (máximo 2 MB).');return}const rd=new FileReader();rd.onload=()=>{try{const p=JSON.parse(rd.result);if(p.version!==1||!StudyProfile.levels.includes(p.level)||typeof p.xp!=='number'||typeof p.completed!=='object'||!p.completed)throw Error('invalid');if(progressKey!==KEY){if(!confirm('¿Reemplazar el progreso de esta cuenta con el archivo? Se guardará un respaldo local.'))return;archiveProfile(currentProfile());}progress=normalizeProgress(p);save();ui.reviewQueue=null;toast('Progreso importado correctamente.');navPage('home')}catch(e){toast('Archivo no válido: importa una copia JSON de tu progreso.')}};rd.readAsText(file)}
function doReview(rating){const id=ui.reviewQueue?.shift(),v=DATA.vocabulary.find(x=>x.id===id);if(!v)return;const prev=progress.srs[id]||{interval:0,ease:2.4,reps:0};let iv=prev.interval,reps=prev.reps,ease=prev.ease;if(rating==='again'){iv=0;reps=0;ease=Math.max(1.3,ease-.18)}else if(rating==='hard'){iv=1;reps++;ease=Math.max(1.3,ease-.1)}else if(rating==='good'){iv=prev.interval===0?1:Math.max(2,Math.round(prev.interval*ease));reps++}else{iv=prev.interval===0?4:Math.max(4,Math.round(prev.interval*(ease+.4)));reps++;ease+=.1}progress.srs[id]={interval:iv,reps,ease,due:plusDays(iv),last:day()};if(rating!=='again'){ui.reviewSuccess++;awardOnce('reviewRewarded',`${day()}:${id}`,5)}else{activity(0)}ui.reviewCount++;ui.cardFlipped=false;save();render()}
function recordLessonResult(lesson, session) {
  const old = progress.lessonResults[lesson.id] || {};
  progress.lessonResults[lesson.id] = {
    sessions: (old.sessions || 0) + 1,
    first: (old.first || 0) + session.firstTry,
    assisted: (old.assisted || 0) + session.score - session.firstTry,
    revealed: (old.revealed || 0) + session.items.length - session.score,
    lastDate: day()
  };
}

function checkWriting(){const item=getWriting();const s=$('writingText')?.value||'';progress.drafts[item.id]=s;const f=writingFeedback(s,item);ui.writeFeedback=f;if(f.passes){awardOnce('writingDone',item.id,20);toast('Alcanzaste la extensión orientativa. Guardamos tu actividad de escritura.')}else save();render()}
function clickAction(e){const el=e.target.closest('[data-a]');if(!el)return;const action=el.dataset.a,id=el.dataset.id,ix=Number(el.dataset.index);switch(action){
case 'nav':navPage(id);break;
case 'missionFilter':ui.missionFilter=id;render();break;
case 'openMission':openMission(id);break;
case 'missionChoice':missionChoice(ix);break;
case 'missionCheck':missionCheck();break;
case 'missionReveal':missionCheck(true);break;
case 'missionNext':missionNext();break;
case 'missionModel':if(ui.mission?.stage==='transfer'){ui.mission.showModel=!ui.mission.showModel;render();document.querySelector('[data-a="missionModel"]')?.focus()}break;
case 'missionFinish':finishMission();break;
case 'cloudLogin':cloudLogin(false);break;
case 'cloudRegister':cloudLogin(true);break;
case 'cloudRefresh':refreshCloudUser();break;
case 'cloudSave':if(!ui.cloudBusy)void progressSync?.check();break;
case 'saveAccountProfile':updateAccountProfile();break;
case 'copyGuestProgress':copyGuestProgress(true);break;
case 'replaceGuestProgress':copyGuestProgress(false);break;
case 'keepLocalCopy':keepLocalCopy();break;
case 'renewCloudSession':if(ui.cloudUser?.email)cloudLogin(false,ui.cloudUser.email);break;
case 'requestDeletion':requestAccountDeletion(true);break;
case 'cancelDeletion':requestAccountDeletion(false);break;
case 'exportOtherTab':downloadData(readBrowserValue(progressKey + ':other-tab'));break;
case 'undoCloudRestore':undoCloudRestore();break;
case 'cloudRestore':cloudRestore();break;
case 'cloudLogout':cloudLogout();break;
case 'clearAccountDevice':cloudLogout(true);break;
case 'cloudTeacher':cloudTeacher();break;
case 'cloudRoster':cloudRoster();break;
case 'classCreate':{const name=$('className')?.value.trim();if(name)classroomAction(()=>XannyCloud.createGroup(name),'Grupo creado.');else toast('Escribe un nombre de grupo.');break}
case 'classJoin':{const code=$('classCode')?.value.trim(),alias=$('classAlias')?.value.trim();if(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(code||'')&&alias)classroomAction(()=>XannyCloud.joinGroup(code,alias),'Te uniste a la clase.');else toast('Escribe un código válido y un alias.');break}
case 'classRotate':if(confirm('¿Renovar el código? El código anterior dejará de aceptar inscripciones.'))classroomAction(()=>XannyCloud.rotateInvite(id),'Código renovado.');break;
case 'classAssign':{const mission=$('assign-'+id)?.value;if(mission)classroomAction(()=>XannyCloud.assignMission(id,mission),'Misión asignada.');break}
case 'classReport':classroomAction(()=>XannyCloud.classroomReport(id),'Resultados actualizados.',id);break;
case 'classMission':openClassMission(id);break;
case 'classSubmit':sendClassResult();break;
case 'openLesson':openLesson(id);break;
case 'retryError':openLesson(id,el.dataset.q);break;
case 'pathFilter':ui.pathFilter=id;render();break;
case 'grammarFilter':ui.grammarFilter=id;render();break;
case 'resourceFilter':ui.resourceFilter=id;render();break;
case 'speakAudio':speakText(el.dataset.text);break;
case 'speakSlow':speakText(el.dataset.text,.7);break;
case 'stopAudio':window.speechSynthesis?.cancel();break;
case 'lessonOption':if(ui.lesson&&!ui.lesson.checked&&!ui.lesson.wrongOptions.includes(ix)){ui.lesson.selected=ix;render()}break;
case 'lessonCheck':{const s=ui.lesson;if(!s||s.selected===null||s.checked)return;const l=DATA.lessons.find(l=>l.id===s.id),q=s.items[s.index],ok=s.selected===q.answer;if(ok){s.score++;if(!s.attempts){s.firstTry++;awardOnce('wins',l.id+'-'+q.id,5);repairError(l,q)}s.checked=true;s.feedback='right';s.responses.push({id:q.id,text:q.text,correct:q.options[q.answer],why:q.why,attempts:s.attempts,success:true});}else{s.attempts++;s.wrongOptions.push(s.selected);if(s.attempts===1){rememberError(l,q);s.feedback='retry';s.selected=null;}else{s.checked=true;s.feedback='wrong';s.responses.push({id:q.id,text:q.text,correct:q.options[q.answer],why:q.why,attempts:s.attempts,success:false});}}render();break}
case 'lessonNext':{const s=ui.lesson;if(!s||!s.checked)return;const l=DATA.lessons.find(l=>l.id===s.id);s.index++;s.selected=null;s.checked=false;s.attempts=0;s.wrongOptions=[];s.feedback='';if(s.index>=s.items.length){recordLessonResult(l,s);if(!awardOnce('completed',l.id,30))save();toast('¡Sesión terminada! Revisa las soluciones y explicaciones.');recordCloudEvent('lesson_completed',l.id,Math.round(s.firstTry/s.items.length*100))}render();break}
case 'listenSelect':switchListen(ix);break;
case 'listenOption':if(!ui.listenChecked&&!ui.listenWrong.includes(ix)){ui.listenChoice=ix;render()}break;
case 'listenCheck':{if(ui.listenChoice===null||ui.listenChecked)return;const item=DATA.listening[ui.listenIndex],q=ui.listenQuiz;if(q.answer===ui.listenChoice){ui.listenChecked=true;awardOnce('listeningDone',item.id,15);toast('¡Entendiste el mensaje! +15 XP si es nuevo.');recordCloudEvent('listening_completed',item.id,ui.listenAttempts===0?100:50);}else{ui.listenAttempts++;ui.listenWrong.push(ui.listenChoice);if(ui.listenAttempts===1){ui.listenChoice=null;}else{ui.listenChecked=true;}}render();break}
case 'listenAudio':speakText(DATA.listening[ui.listenIndex].audio);break;
case 'listenNext':switchListen((ui.listenIndex+1)%DATA.listening.length);break;
case 'toggleTranscript':ui.showTranscript=!ui.showTranscript;render();break;
case 'recordSpeech':record();break;
case 'speakCheck':{ui.speakText=$('speakText')?.value||'';if(!normal(ui.speakText)){toast('Primero graba o escribe tu frase.');return}const item=DATA.speaking[ui.speakIndex];ui.speakFeedback=compareSpeech(item.target,ui.speakText);if(ui.speakFeedback.score>=70){awardOnce('speakingDone',item.id,15)}render();break}
case 'speakClear':ui.speakText='';ui.speakFeedback=null;render();break;
case 'flipCard':ui.cardFlipped=true;render();break;
case 'rateCard':if(ui.cardFlipped)doReview(el.dataset.rating);break;
case 'reviewRestart':beginReview(true);render();break;
case 'writeCheck':checkWriting();break;
case 'saveDraft':{let item=getWriting();progress.drafts[item.id]=$('writingText')?.value||'';save();toast('Borrador guardado en este navegador.');break}
case 'startDiagnostic':ui.diagnostic={index:0,selected:null,answers:[]};navPage('diagnostic');break;
case 'diagnosticOption':if(ui.diagnostic){ui.diagnostic.selected=ix;render()}break;
case 'diagnosticNext':{const d=ui.diagnostic;if(!d||d.selected===null)return;d.answers.push(d.selected);d.index++;d.selected=null;render();break}
case 'adoptLevel':if(!['A1','A2','B1','B2'].includes(id))return;progress.level=id;save();ui.reviewQueue=null;navPage('path');toast(`Ruta ajustada a ${id}`);break;
case 'exportData':downloadData();break;
case 'importTrigger':$('importFile')?.click();break;
case 'resetData':{if(!ui.resetArmed){ui.resetArmed=true;toast('Pulsa otra vez para borrar definitivamente.');render()}else{if(progressKey!==KEY){if(!confirm('¿Reiniciar este historial, incluida su próxima copia en la nube? Se guardará un respaldo local.'))return;try{archiveProfile(currentProfile());}catch{toast('No se pudo crear el respaldo local.');return;}progress=defaults();save();}else{localStorage.removeItem(progressKey);localStorage.removeItem(recoveryKey());lastLocalRecord=null;progress=defaults();}ui.reviewQueue=null;ui.resetArmed=false;navPage('home');toast('Progreso reiniciado en este dispositivo.')}break}
default:break}}
document.addEventListener('click',clickAction);
document.addEventListener('input',e=>{if(['accountNickname','accountLevel'].includes(e.target.id))e.target.dataset.touched='true';if(e.target.id==='speakText')ui.speakText=e.target.value;if(e.target.id==='missionWrite'&&ui.mission){ui.mission.transferText=e.target.value;progress.missionDrafts[ui.mission.id]=e.target.value.slice(0,5000);save();e.target.removeAttribute?.('aria-invalid');const status=$('missionWriteStatus');if(status)status.textContent='';}if(e.target.id==='writingText'){const count=words(e.target.value).length;const n=$('wordCount');if(n)n.textContent=`${count} palabras · mínimo orientativo ${getWriting().min}`;}if(e.target.id==='pathSearch')ui.pathSearch=e.target.value});
document.addEventListener('keydown', e => {
  if (e.target.id === 'pathSearch' && e.key === 'Enter') {
    e.preventDefault();
    render();
  }
  if (e.key === 'Escape') {
    const menu = document.querySelector('.mobile-more[open]');
    if (menu) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
  }
});
document.addEventListener('click', e => {
  const menu = document.querySelector('.mobile-more[open]');
  if (menu && !menu.contains(e.target)) menu.open = false;
});
document.addEventListener('change',e=>{const el=e.target;switch(el.id){
case 'learningMode':progress.learningMode=AdaptiveLearning.mode(el.value);save();break;
case 'settingLevel':if(!StudyProfile.levels.includes(el.value))return;progress.level=el.value;ui.reviewQueue=null;save();toast('Nivel de referencia actualizado.');render();break;
case 'studyAnalyticsConsent':changeAnalyticsConsent(el.checked);break;
case 'settingGoal':progress.goal=Number(el.value);save();toast('Objetivo actualizado.');break;
case 'settingAccent':progress.accent=el.value;save();toast('Variante de voz seleccionada.');break;
case 'settingTheme':progress.theme=el.value;save();render();break;
case 'speechRate':progress.rate=el.value;save();break;
case 'speakSelect':ui.speakIndex=Number(el.value);ui.speakText='';ui.speakFeedback=null;render();break;
case 'writeSelect':ui.writeIndex=Number(el.value);ui.writeFeedback=null;render();break;
case 'importFile':importData(el.files?.[0]);break;
case 'pathSearch':ui.pathSearch=el.value;render();break;
default:break}});
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(h&&h!==ui.page){ui.page=h;ui.lesson=null;render();if(h==='account'||h==='classroom')refreshCloudUser()}});
if('serviceWorker'in navigator&&location.protocol!=='file:'){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}
render();
window.addEventListener('offline', () => progressSync?.offline());
window.addEventListener('online', () => {
  if (window.XannyCloud?.available() && !ui.cloudUser) void refreshCloudUser();
  else void progressSync?.check();
});
window.addEventListener('focus', () => progressSync?.focus());
window.addEventListener('storage', event => {
  if (event.key === activeAccountKey && window.XannyCloud?.available() && event.newValue !== ui.cloudUser?.id) {
    const expected = event.newValue || null;
    if (progressKey !== KEY && progressKey !== KEY + ':account:' + expected) {
      ui.cloudUser = null;
      ui.cachedAccount = false;
      ui.analyticsConsent = false;
      switchWorkspace(null);
      render();
    }
    if (expected && navigator.onLine !== false) void refreshCloudUser();
    return;
  }
  if (event.key === progressKey && event.newValue !== lastLocalRecord) {
    progress = load();
    ui.reviewQueue = null;
    progressSync?.queue();
    if (ui.page === 'progress' || ui.page === 'home') render();
  }
});
if(window.XannyCloud?.available()){
  if(navigator.onLine===false){loadCachedAccount();render();}
  else void refreshCloudUser();
}else window.XannyCloud?.startAnonymousVisits();
})();
