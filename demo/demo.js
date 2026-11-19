/* Recursos de la edición de demostración. No se carga en la aplicación habitual. */
window.XannyDemo = (() => {
  const {icon, mascot} = LearningUI;
  const nav = (id, label, style = 'ghost') =>
    '<button type="button" class="button ' + style + '" data-a="nav" data-id="' + id + '">' + label + '</button>';

  const activities = [
    ['flag', 'nav', 'diagnostic', '', 'Descubre tu punto de partida', 'Haz el diagnóstico y recibe una ruta acorde con tu resultado.'],
    ['route', 'unitSession', 'b1-viaje', 'notice', 'B1 · Un cambio de planes', 'Lee un aviso de viaje y decide cómo llegar a tu destino.'],
    ['layers', 'unitSession', 'b2-proyecto', 'negotiate', 'B2 · Defiende una propuesta', 'Justifica tu decisión y negocia un piloto con criterios medibles.'],
    ['compass', 'openMission', 'b1-interview', '', 'Una entrevista en inglés', 'Elige cómo responder, recibe una pista y aplica lo aprendido en otra situación.'],
    ['headphones', 'demoListen', 'l9', '', '¿Qué salvó el proyecto?', 'Escucha cómo se resolvió una avería y encuentra la pista en el diálogo.'],
    ['pen', 'nav', 'write', '', 'Escribe algo que usarías', 'Redacta una respuesta y revisa una guía de autoevaluación.'],
    ['cards', 'nav', 'cards', '', 'Pon a prueba tu memoria', 'Da la vuelta a las tarjetas y programa el próximo repaso.']
  ];

  function header() {
    return '<div class="demo-bar"><span class="demo-tag">' + icon('spark') + ' Demostración</span>' +
      '<div class="demo-bar-actions"><button class="button ghost sm" data-a="nav" data-id="home">' + icon('home') +
      ' Inicio de la demo</button><button class="button ghost sm" data-a="nav" data-id="demo-feedback-form">Opinar</button>' +
      '<button class="button ghost sm" data-a="demoResetAsk">' + icon('retry') + ' Reiniciar</button></div></div>' +
      '<dialog id="demo-reset-dialog" class="demo-dialog card" aria-labelledby="demo-reset-title">' +
      '<h2 id="demo-reset-title">¿Reiniciar la demostración?</h2><p>Se borrarán únicamente los avances y borradores de la demo en este navegador. Los archivos que descargaste se conservan.</p>' +
      '<form method="dialog" class="button-group mt"><button class="button ghost" autofocus>Cancelar</button>' +
      '<button type="button" class="button primary" data-a="demoReset">Reiniciar demostración</button></form></dialog>';
  }

  function home(showHelp) {
    return '<section class="demo-hero"><div class="demo-hero-copy"><h1 class="page-title">Aprende inglés con Xanny</h1>' +
      '<p>Practica inglés para viajar, conversar y trabajar. Elige una actividad y descubre cómo explica Xanny cada decisión.</p>' +
      '<div class="button-group">' + nav('diagnostic', 'Hacer el diagnóstico ' + icon('arrow'), 'primary') +
      nav('units', 'Ver unidades B1 y B2') + '</div></div>' +
      '<div class="demo-coach">' + mascot(showHelp ? 'help' : 'welcome') + '<div><strong>Xanny</strong>' +
      '<p id="demo-coach-copy" aria-live="polite">' + (showHelp ?
        'Si una respuesta no sale, lee la pista y vuelve a intentarlo. Luego compara tu decisión con la explicación.' :
        '¡Hola! Puedes empezar por una entrevista o por el diagnóstico. Tu avance se guarda en este navegador.') +
      '</p><button class="button ghost sm" data-a="demoHelp" aria-expanded="' + showHelp +
      '" aria-controls="demo-coach-copy">' + (showHelp ? 'Volver al saludo' : 'Pedirle un consejo a Xanny') +
      '</button></div></div></section>' +
      '<section class="demo-section" aria-labelledby="demo-activities"><h2 id="demo-activities">Elige qué probar</h2><div class="demo-grid">' +
      activities.map(([glyph, action, id, session, title, description]) =>
        '<button class="card demo-tile" data-a="' + action + '" data-id="' + id + '"' +
        (session ? ' data-session="' + session + '"' : '') +
        '><span class="demo-tile-icon">' + icon(glyph) + '</span><span><strong>' + title +
        '</strong><span class="demo-tile-copy">' + description + '</span></span>' + icon('arrow') + '</button>').join('') +
      '</div></section><section class="card demo-preview"><div><h2>Cómo se ve el progreso y el Aula Virtual</h2>' +
      '<p>Tu práctica genera resultados en este navegador. Las vistas de muestra usan datos ficticios.</p></div>' +
      '<div class="button-group">' + nav('progress', 'Ver progreso') + nav('classroom', 'Explorar Aula Virtual') + '</div></section>';
  }

  function stats(rows) {
    return '<dl class="demo-stats">' + rows.map(([label, value]) =>
      '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>').join('') + '</dl>';
  }

  function progressExample() {
    return '<details class="card demo-disclosure"><summary>Ver un ejemplo de progreso con datos ficticios</summary>' +
      stats([['Experiencia', '270 XP'], ['Sesiones terminadas', '4'], ['Aciertos al primer intento', '10 de 15'],
        ['Aciertos con ayuda', '3 de 15'], ['Escritos entregados', '2'], ['Repasos pendientes', '2']]) +
      '<p>En este ejemplo, la comprensión auditiva mejoró de 2 de 5 a 4 de 5 respuestas iniciales entre dos sesiones. ' +
      'La entrega de escritura registra que se entregó un texto.</p></details>';
  }

  function account() {
    return '<h1 class="page-title">Mi cuenta</h1><p class="page-desc">En esta demo estudias como visitante. Tus ejercicios y borradores se guardan aquí.</p>' +
      '<div class="grid grid-2"><section class="card"><h2>Cuenta de ejemplo</h2><p><strong>Datos ficticios</strong></p>' +
      '<p>Estudiante de muestra · Nivel B1 · 270 XP</p><p>En el piloto de cuentas, el perfil y el progreso podrían recuperarse al entrar desde otro dispositivo.</p>' +
      nav('progress', 'Ver progreso') + '</section><section class="card"><h2>Acceso y sincronización</h2>' +
      '<p>El registro por correo y la sincronización están pendientes de activación pública. Esta edición no pide correos ni abre sesiones en la nube.</p>' +
      '<p>Para limpiar tus datos locales, usa <strong>Reiniciar</strong>. También puedes leer el <a href="./privacy.html">aviso de la demostración</a>.</p></section></div>';
  }

  function classroom() {
    return '<h1 class="page-title">Aula Virtual</h1><p class="page-desc">Explora cómo se verían las asignaciones de un alumno y el informe de su docente.</p>' +
      '<div class="grid grid-2"><section class="card"><h2>Vista de estudiante</h2><p><strong>Datos ficticios</strong></p>' +
      '<p>Club de conversación B1 · Misión de ejemplo: Entrevista laboral</p><p>Una misión asignada permite practicar decisiones y compartir un resumen con el grupo. Aquí puedes probar la actividad de forma individual.</p>' +
      '<button class="button primary" data-a="openMission" data-id="b1-interview">Practicar la misión ' + icon('arrow') +
      '</button></section><section class="card"><h2>Vista docente</h2><p><strong>Datos ficticios</strong></p>' +
      stats([['Estudiantes del grupo', '3'], ['Misiones finalizadas', '2'], ['Aciertos iniciales', '4 de 6'],
        ['Aciertos con ayuda', '1 de 6'], ['Repasos pendientes', '1']]) +
      '<p>Se muestra el estado de entrega de escritura. El escrito y el progreso privado permanecen fuera del informe.</p></section></div>';
  }

  const ratingLabels = {
    visual:'Diseño visual', navigation:'Facilidad de uso', explanations:'Claridad de las explicaciones',
    exercises:'Calidad de los ejercicios', mobile:'Funcionamiento en celular'
  };
  const ratings = ['Muy bueno', 'Bueno', 'Aceptable', 'Necesita mejorar', 'Tuvo problemas'];
  function feedback() {
    return '<h1 class="page-title">Tu opinión sobre la demo</h1><p class="page-desc">Todo es opcional. Descarga tus respuestas y comparte el archivo con quien te invitó si quieres.</p>' +
      '<form id="demo-feedback" class="card demo-form" autocomplete="off">' +
      '<p id="demo-feedback-privacy">Deja fuera nombres, correos y otros datos personales. Este formulario no envía tus respuestas.</p>' +
      '<div class="demo-ratings">' + Object.entries(ratingLabels).map(([key, label]) =>
        '<label><span>' + label + '</span><select class="field" name="' + key + '"><option value="">Sin responder</option>' +
        ratings.map(r => '<option>' + r + '</option>').join('') + '</select></label>').join('') +
      '</div><label><span>¿Qué función te gustaría encontrar?</span><textarea class="field" name="ideas" rows="2" maxlength="500" aria-describedby="demo-feedback-privacy"></textarea></label>' +
      '<label><span>¿Qué error encontraste?</span><textarea class="field" name="issues" rows="2" maxlength="500" aria-describedby="demo-feedback-privacy"></textarea></label>' +
      '<div class="button-group"><button class="button primary" type="submit">Descargar mis opiniones</button>' +
      nav('home', 'Volver al inicio') + '</div><p id="demo-feedback-status" role="status"></p></form>';
  }

  function downloadFeedback(form) {
    const values = new FormData(form);
    const answers = Object.entries(ratingLabels).flatMap(([key, label]) =>
      ratings.includes(values.get(key)) ? [label + ': ' + values.get(key)] : []);
    for (const [key, label] of [['ideas','Función solicitada'], ['issues','Error observado']]) {
      const value = String(values.get(key) || '').trim().slice(0, 500);
      if (value) answers.push(label + ':\n' + value);
    }
    const status = form.querySelector('[role="status"]');
    if (!answers.length) {
      status.textContent = 'Responde al menos un campo para descargar tus opiniones.';
      return;
    }
    const blob = new Blob(['Opiniones sobre Aprende con Xanny · Demostración\n\n' + answers.join('\n\n')], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'opiniones-xanny.txt';
    form.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Archivo descargado. Puedes compartirlo por el canal que prefieras.';
  }

  const grammar = [
    'Con “I” se usa “am” para indicar el origen. “Is” se usa con he, she o it.',
    'En presente simple afirmativo, “she” necesita el verbo con -s: “drinks”.',
    '“Did” ya marca el pasado de la pregunta. El verbo principal vuelve a su forma base: “like”.',
    'El plan futuro se expresa con “be going to” seguido del verbo en forma base, aquí “visit”.',
    '“Than” introduce la comparación entre dos libros. Con “interesting”, el comparativo se forma con “more”.',
    '“Have” seguido del participio “visited” forma el presente perfecto para una experiencia sin fecha concreta.',
    'La condición posible usa el presente “if it rains”, y su consecuencia futura se expresa con “will stay”.',
    '“Was sleeping” describe la acción en curso. “Called” expresa la llamada puntual que la interrumpió.',
    '“Although” introduce el contraste entre estar cansado y seguir estudiando. “Therefore” introduciría una consecuencia.',
    '“If I had” plantea una situación hipotética. “Would drive” expresa lo que ocurriría en ese caso.',
    'El informe recibe la acción. Con “yesterday” corresponde la pasiva en pasado: “was sent”.',
    'Tras “might”, usa “have” en forma base y luego el participio para expresar una posibilidad pasada.'
  ];
  const listenReasons = [
    ['Pide “a small coffee”. La leche se ofrece después como complemento de la misma bebida.', 'Al ofrecerle leche, la respuesta es afirmativa: “Yes, please”.'],
    ['“Let’s go to the park” identifica el destino. “At ten” solo indica la hora.', '“At ten” indica las diez. El parque indica el lugar, no la hora.'],
    ['Emma dice “my brother and my grandmother”. Max es su perro.', '“His name is Max” se refiere al perro. Emma es quien habla.'],
    ['“Instead” introduce el horario nuevo: “two thirty”. Las tres eran la hora inicial.', '“Our meeting was at three o’clock” describe el horario original, antes de la propuesta.'],
    ['“Now” señala la puerta actual, la 24. La 16 es la anterior y 15 indica minutos.', '“Boarding starts in fifteen minutes” indica cuánto falta para embarcar. Los otros números son puertas.'],
    ['“For two years” expresa cuánto duró su trabajo en atención al cliente.', 'La persona dice “I also repaired computers”. Es la tarea técnica concreta que menciona.'],
    ['“I was working late” explica por qué perdió la llamada. La otra hora es una propuesta futura.', '“This evening around eight” propone hablar sobre las ocho de hoy. Veinte minutos indica duración.'],
    ['“Now” introduce “every day”. Antes estudiaba solo los fines de semana.', '“Twice a week” indica la frecuencia con que repasa expresiones. Quince minutos es el tiempo de práctica diaria.'],
    ['El ordenador se averió. Lo que permitió recuperar el trabajo fue una copia de respaldo.', '“The night before” sitúa el respaldo la noche anterior, antes de la avería.'],
    ['“Offers the best balance” expresa preferencia por un horario híbrido, no solo remoto o solo presencial.', '“Saves commuting time” significa que se ahorra tiempo de desplazamiento.'],
    ['La propuesta parece prometedora, pero el presupuesto original no alcanza para ejecutarla tal como está.', 'Plantea dos alternativas: reducir el alcance o conseguir más fondos.'],
    ['La muestra pequeña limita las conclusiones generales, aunque los resultados parezcan favorables.', '“Until the results have been replicated” indica que primero se deben reproducir los resultados.']
  ];

  function diagnosticReview(questions, answers, escape) {
    return '<details class="card demo-disclosure mt"><summary>Revisar las 12 explicaciones</summary><ol class="demo-review">' +
      questions.map(([question, options, answer], i) =>
        '<li><strong lang="en">' + escape(question) + '</strong><p>Elegiste <b lang="en">' +
        escape(options[answers[i]]) + '</b>. Respuesta correcta: <b lang="en">' + escape(options[answer]) +
        '</b>.</p><p>' + grammar[i] + '</p></li>').join('') + '</ol></details>';
  }

  function listenReason(item, variant) {
    return listenReasons[Number(item.id.slice(1)) - 1]?.[variant] || '';
  }

  return {header, home, progressExample, account, classroom, feedback, downloadFeedback, diagnosticReview, listenReason};
})();
