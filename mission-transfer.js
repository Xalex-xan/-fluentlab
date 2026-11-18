/* Decisiones de transferencia. Cada variante practica la misma habilidad en otro contexto. */
const MISSION_TRANSFERS = {
  "a2-delivery": [
    {
      "context": "Una lavandería te devolvió la bolsa equivocada.",
      "prompt": "Pide que revisen el número de tu recibo.",
      "choices": [
        "I received the wrong bag. Could you check my receipt number?",
        "You always lose my clothes.",
        "The bag is blue."
      ],
      "answer": 0,
      "why": "Describe la diferencia entre lo esperado y lo recibido y ofrece un dato con el que pueden rastrear el pedido.",
      "hint": "Explica lo sucedido y ofrece un identificador.",
      "details": [
        "Describe la diferencia entre lo esperado y lo recibido y ofrece un dato con el que pueden rastrear el pedido.",
        "Acusa sin explicar el incidente concreto.",
        "El color puede servir como detalle, pero falta la petición."
      ],
      "example": "I received the wrong bag. Could you check my receipt number?",
      "translation": "Recibí la bolsa equivocada. ¿Podrías revisar mi número de recibo?"
    },
    {
      "context": "Tu biblioteca registra un libro como pendiente, aunque ya lo devolviste.",
      "prompt": "Solicita que verifiquen el registro de devolución.",
      "choices": [
        "I returned this book yesterday. Could you check your records?",
        "Please lend me another book.",
        "I am sure nobody works here."
      ],
      "answer": 0,
      "why": "Indica cuándo devolviste el libro y pide verificar una fuente concreta.",
      "hint": "Combina la acción que ya hiciste con un registro verificable.",
      "details": [
        "Indica cuándo devolviste el libro y pide verificar una fuente concreta.",
        "Pide un préstamo y deja abierto el problema.",
        "Es una acusación sin una solicitud útil."
      ],
      "example": "I returned this book yesterday. Could you check your records?",
      "translation": "Devolví este libro ayer. ¿Podrías revisar tus registros?"
    }
  ],
  "a2-clarify": [
    {
      "context": "En la piscina oyes «Meet at the side entrance» y hay dos entradas laterales.",
      "prompt": "Confirma cuál de las dos debes usar.",
      "choices": [
        "Do you mean the entrance next to the café?",
        "Is the pool open tomorrow?",
        "I know where every entrance is."
      ],
      "answer": 0,
      "why": "Repite una interpretación específica como pregunta y permite que la otra persona la confirme o la corrija.",
      "hint": "Repite una interpretación concreta como pregunta.",
      "details": [
        "Repite una interpretación específica como pregunta y permite que la otra persona la confirme o la corrija.",
        "Cambia el tema a los horarios.",
        "No confirma a cuál se referían."
      ],
      "example": "Do you mean the entrance next to the café?",
      "translation": "¿Te refieres a la entrada junto al café?"
    },
    {
      "context": "En una receta oyes «fold in the flour», pero no reconoces la técnica.",
      "prompt": "Pide una demostración de ese paso.",
      "choices": [
        "Could you show me what you mean by “fold in the flour”?",
        "Should I buy a new oven?",
        "I’ll just skip the flour."
      ],
      "answer": 0,
      "why": "“Could you show me…?” pide una demostración de la acción que no entendiste.",
      "hint": "Pide que te muestren el paso difícil.",
      "details": [
        "“Could you show me…?” pide una demostración de la acción que no entendiste.",
        "No aclara la técnica mencionada.",
        "Cambia la receta sin verificar qué hacer."
      ],
      "example": "Could you show me what you mean by “fold in the flour”?",
      "translation": "¿Podrías mostrarme qué quieres decir con «incorporar la harina con movimientos envolventes»?"
    }
  ],
  "a2-schedule": [
    {
      "context": "Un plomero puede venir el martes a las 8, cuando no hay nadie en casa.",
      "prompt": "Propón una hora específica sin dar el cambio por hecho.",
      "choices": [
        "I’m not home at eight. Would eleven work instead?",
        "You’re coming at eleven now.",
        "Tuesday is a busy day."
      ],
      "answer": 0,
      "why": "Explica el impedimento y usa “Would … work?” para proponer una hora sin imponerla.",
      "hint": "Explica el conflicto y sugiere otra hora.",
      "details": [
        "Explica el impedimento y usa “Would … work?” para proponer una hora sin imponerla.",
        "Impone el cambio sin confirmar disponibilidad.",
        "No propone una solución."
      ],
      "example": "I’m not home at eight. Would eleven work instead?",
      "translation": "No estoy en casa a las ocho. ¿Te vendría bien a las once?"
    },
    {
      "context": "Tu equipo de voluntariado propone limpiar el parque el domingo, cuando trabajas.",
      "prompt": "Ofrece un momento alternativo concreto.",
      "choices": [
        "I’m working on Sunday. Could we do Saturday morning instead?",
        "I can’t come, and that’s all.",
        "Sunday morning is perfect."
      ],
      "answer": 0,
      "why": "Menciona el conflicto y propone un día y una franja concretos.",
      "hint": "Ofrece un día y una franja en que puedas ir.",
      "details": [
        "Menciona el conflicto y propone un día y una franja concretos.",
        "Avisa que no puedes ir, pero no propone otra fecha.",
        "Contradice tu disponibilidad."
      ],
      "example": "I’m working on Sunday. Could we do Saturday morning instead?",
      "translation": "Trabajo el domingo. ¿Podríamos hacerlo el sábado por la mañana?"
    }
  ],
  "a2-travel": [
    {
      "context": "En la estación de tren cambian el andén a última hora.",
      "prompt": "Pide confirmar desde dónde sale tu tren.",
      "choices": [
        "Could you confirm which platform the train to Leeds leaves from?",
        "I need to buy a suitcase.",
        "The platform must be number two."
      ],
      "answer": 0,
      "why": "Identifica el tren y pide un dato verificable antes de dirigirte al andén.",
      "hint": "Incluye el destino y pregunta por el andén.",
      "details": [
        "Identifica el tren y pide un dato verificable antes de dirigirte al andén.",
        "No resuelve el cambio de andén.",
        "Adivina el dato que necesitas verificar."
      ],
      "example": "Could you confirm which platform the train to Leeds leaves from?",
      "translation": "¿Podrías confirmar desde qué andén sale el tren a Leeds?"
    },
    {
      "context": "Tu autobús llega tarde y perderás el enlace del ferry.",
      "prompt": "Pregunta por una salida que aún puedas tomar.",
      "choices": [
        "I may miss my ferry. Is there a later sailing I can take?",
        "The ferry is definitely waiting for me.",
        "Are there any seats on yesterday’s ferry?"
      ],
      "answer": 0,
      "why": "“May miss” presenta la conexión como un riesgo y “later sailing” identifica la alternativa que necesitas.",
      "hint": "Busca una salida posterior, aunque todavía no sepas si perderás la conexión.",
      "details": [
        "“May miss” presenta la conexión como un riesgo y “later sailing” identifica la alternativa que necesitas.",
        "Supone que el ferry esperará, sin confirmación.",
        "Pregunta por un viaje que ya salió."
      ],
      "example": "I may miss my ferry. Is there a later sailing I can take?",
      "translation": "Puede que pierda mi ferry. ¿Hay una salida más tarde que pueda tomar?"
    }
  ],
  "b1-support": [
    {
      "context": "Una socia del gimnasio recibió un cobro duplicado y está molesta.",
      "prompt": "Reconoce su preocupación y ofrece revisar el cobro.",
      "choices": [
        "I can see why that’s frustrating. I’ll check both charges and get back to you today.",
        "Our billing system never makes mistakes.",
        "I promise the refund is already complete."
      ],
      "answer": 0,
      "why": "Valida la frustración, ofrece investigar los dos cobros y da un plazo de respuesta.",
      "hint": "Reconoce cómo se siente la persona y promete solo lo que puedes hacer.",
      "details": [
        "Valida la frustración, ofrece investigar los dos cobros y da un plazo de respuesta.",
        "Descarta el problema antes de investigar.",
        "Promete un resultado que aún no se ha verificado."
      ],
      "example": "I can see why that’s frustrating. I’ll check both charges and get back to you today.",
      "translation": "Entiendo por qué es frustrante. Revisaré ambos cargos y te responderé hoy."
    },
    {
      "context": "Una familia lleva media hora esperando una mesa con reserva.",
      "prompt": "Reconoce la espera y comprométete a dar información concreta.",
      "choices": [
        "I’m sorry you’ve had to wait. I’ll check when your table will be ready.",
        "Everyone waits here.",
        "Your table will be ready right now, I guarantee it."
      ],
      "answer": 0,
      "why": "Reconoce la demora y promete comprobar el estado de la mesa, una acción que sí puedes realizar.",
      "hint": "Combina una disculpa con una comprobación que puedas cumplir.",
      "details": [
        "Reconoce la demora y promete comprobar el estado de la mesa, una acción que sí puedes realizar.",
        "Minimiza la situación y no ofrece ayuda.",
        "Da una garantía antes de verificar la disponibilidad."
      ],
      "example": "I’m sorry you’ve had to wait. I’ll check when your table will be ready.",
      "translation": "Siento que hayan tenido que esperar. Voy a verificar cuándo estará lista su mesa."
    }
  ],
  "b1-interview": [
    {
      "context": "Te postulas para coordinar un club de lectura y te preguntan cómo organizas grupos.",
      "prompt": "Elige un ejemplo con una acción y un resultado.",
      "choices": [
        "I set up a rota for our reading group, and every member led at least one discussion.",
        "I’m simply good with every kind of group.",
        "I have read many novels."
      ],
      "answer": 0,
      "why": "Identifica tu contribución y un resultado observable: todas las personas dirigieron una conversación.",
      "hint": "Busca una acción que hiciste y un resultado observable.",
      "details": [
        "Identifica tu contribución y un resultado observable: todas las personas dirigieron una conversación.",
        "Es una afirmación general sin evidencia.",
        "Es relevante al club, pero no muestra cómo organizas un grupo."
      ],
      "example": "I set up a rota for our reading group, and every member led at least one discussion.",
      "translation": "Organicé un calendario de turnos para nuestro grupo de lectura y cada integrante dirigió al menos una conversación."
    },
    {
      "context": "En una audición para la radio comunitaria te piden un ejemplo de trabajo bajo presión.",
      "prompt": "Resume la acción que tomaste y el resultado que obtuviste.",
      "choices": [
        "When a guest cancelled, I prepared a short interview with another volunteer and kept the show on schedule.",
        "I always work perfectly under pressure.",
        "Our station has a new microphone."
      ],
      "answer": 0,
      "why": "Expone el imprevisto, la acción que tomaste y el resultado que se mantuvo gracias a esa acción.",
      "hint": "Conecta el imprevisto, tu acción y su resultado.",
      "details": [
        "Expone el imprevisto, la acción que tomaste y el resultado que se mantuvo gracias a esa acción.",
        "No muestra una experiencia concreta.",
        "Es un detalle ajeno a tu contribución."
      ],
      "example": "When a guest cancelled, I prepared a short interview with another volunteer and kept the show on schedule.",
      "translation": "Cuando un invitado canceló, preparé una entrevista breve con otro voluntario y mantuve el programa en horario."
    }
  ],
  "b1-tech": [
    {
      "context": "Una sala de estudio se queda sin wifi durante una videollamada.",
      "prompt": "Haz una pregunta que ayude a saber si el fallo es general.",
      "choices": [
        "Can other devices in the room connect to the same network?",
        "Your laptop definitely needs replacing.",
        "Have you picked a new wallpaper?"
      ],
      "answer": 0,
      "why": "Comprobar otros equipos en la misma red ayuda a distinguir un problema de un solo equipo de un fallo común.",
      "hint": "Compara qué ocurre con otros equipos en la misma red.",
      "details": [
        "Comprobar otros equipos en la misma red ayuda a distinguir un problema de un solo equipo de un fallo común.",
        "Atribuye una causa sin comprobar si afecta a otros equipos.",
        "El fondo de pantalla no ayuda a delimitar el fallo."
      ],
      "example": "Can other devices in the room connect to the same network?",
      "translation": "¿Pueden conectarse otros dispositivos de la sala a la misma red?"
    },
    {
      "context": "Una balanza digital marca valores distintos al pesar el mismo objeto.",
      "prompt": "Propón una comprobación sencilla antes de cambiar el equipo.",
      "choices": [
        "Let’s place it on a flat surface and weigh the same item again.",
        "We must order a replacement immediately.",
        "Try weighing a completely different item each time."
      ],
      "answer": 0,
      "why": "Repetir la medición con el mismo objeto controla una variable y permite comprobar si influye la superficie.",
      "hint": "Cambia una sola condición por vez.",
      "details": [
        "Repetir la medición con el mismo objeto controla una variable y permite comprobar si influye la superficie.",
        "Se adelanta al diagnóstico.",
        "Cambiar el objeto impide comparar las mediciones."
      ],
      "example": "Let’s place it on a flat surface and weigh the same item again.",
      "translation": "Pongámosla en una superficie plana y volvamos a pesar el mismo objeto."
    }
  ],
  "b1-housing": [
    {
      "context": "En la sala de ensayo entra agua por una ventana cuando llueve.",
      "prompt": "Describe cuándo ocurre y pide que inspeccionen la ventana.",
      "choices": [
        "Water comes in around the window when it rains. Could someone take a look this week?",
        "The whole building is unsafe, I’m sure.",
        "Please tell me where to buy an umbrella."
      ],
      "answer": 0,
      "why": "Ubica la entrada de agua, señala qué la desencadena y concreta cuándo quieres que la revisen.",
      "hint": "Menciona el lugar, la condición y la acción que solicitas.",
      "details": [
        "Ubica la entrada de agua, señala qué la desencadena y concreta cuándo quieres que la revisen.",
        "Exagera lo que se sabe del problema.",
        "No resuelve la entrada de agua."
      ],
      "example": "Water comes in around the window when it rains. Could someone take a look this week?",
      "translation": "Entra agua por el marco de la ventana cuando llueve. ¿Podría alguien revisarla esta semana?"
    },
    {
      "context": "En un centro deportivo la luz del vestuario se apaga a ratos.",
      "prompt": "Indica qué luz falla y solicita una revisión.",
      "choices": [
        "The light in the changing room keeps going out. Could maintenance check it?",
        "Somewhere here looks a bit odd.",
        "I’ll tell everyone the centre is closing."
      ],
      "answer": 0,
      "why": "Identifica el lugar y el fallo intermitente, y dirige la petición al equipo indicado.",
      "hint": "Indica dónde ocurre el fallo y quién podría revisarlo.",
      "details": [
        "Identifica el lugar y el fallo intermitente, y dirige la petición al equipo indicado.",
        "No identifica el lugar ni el fallo.",
        "Afirma algo que el incidente no demuestra."
      ],
      "example": "The light in the changing room keeps going out. Could maintenance check it?",
      "translation": "La luz del vestuario se apaga repetidamente. ¿Podría revisarla el personal de mantenimiento?"
    }
  ],
  "b1-team": [
    {
      "context": "En una feria escolar falta una persona para atender el puesto al mediodía.",
      "prompt": "Reparte las tareas y pide confirmación.",
      "choices": [
        "I can cover the first shift. Could you take over at noon? Let me know if that works.",
        "I’ve put your name down for the whole day.",
        "Let’s hope the stand will be fine."
      ],
      "answer": 0,
      "why": "Ofrece cubrir un turno, identifica el relevo que falta y deja un espacio para confirmarlo.",
      "hint": "Di qué turno cubres y pide confirmación del otro.",
      "details": [
        "Ofrece cubrir un turno, identifica el relevo que falta y deja un espacio para confirmarlo.",
        "Asigna el trabajo sin negociar.",
        "Deja el turno sin cubrir."
      ],
      "example": "I can cover the first shift. Could you take over at noon? Let me know if that works.",
      "translation": "Puedo cubrir el primer turno. ¿Podrías relevarme al mediodía? Avísame si te viene bien."
    },
    {
      "context": "Tu grupo de teatro debe entregar un cartel y el diseñador está ocupado.",
      "prompt": "Ofrece encargarte de una parte y pide ayuda con la otra.",
      "choices": [
        "I can write the copy today. Could you handle the layout tomorrow?",
        "The designer can do it all tonight.",
        "We should forget about making a poster."
      ],
      "answer": 0,
      "why": "Divide el trabajo en texto y maquetación y propone plazos para cada parte.",
      "hint": "Busca una división concreta de las tareas.",
      "details": [
        "Divide el trabajo en texto y maquetación y propone plazos para cada parte.",
        "Ignora la carga de trabajo y supone su disponibilidad.",
        "Abandona el objetivo sin explorar un reparto viable."
      ],
      "example": "I can write the copy today. Could you handle the layout tomorrow?",
      "translation": "Puedo redactar el texto hoy. ¿Podrías encargarte de la maquetación mañana?"
    }
  ],
  "b1-misunderstanding": [
    {
      "context": "Tu vecina interpretó «Drop by anytime» como una invitación para esa misma noche.",
      "prompt": "Aclara lo que querías decir y ofrece una hora.",
      "choices": [
        "Sorry, I meant any time on Saturday. Would ten in the morning suit you?",
        "You should have known what I meant.",
        "Yes, come tonight, even though I won’t be home."
      ],
      "answer": 0,
      "why": "Corrige con tacto el alcance de “any time” y propone una hora para confirmar.",
      "hint": "Reformula “any time” indicando el día.",
      "details": [
        "Corrige con tacto el alcance de “any time” y propone una hora para confirmar.",
        "Culpa a la vecina sin resolver la ambigüedad.",
        "Confirma un momento en el que no puedes recibirla."
      ],
      "example": "Sorry, I meant any time on Saturday. Would ten in the morning suit you?",
      "translation": "Perdón, quería decir a cualquier hora del sábado. ¿Te viene bien a las diez de la mañana?"
    },
    {
      "context": "Un compañero entendió «That’s ambitious» como una crítica personal.",
      "prompt": "Aclara tu intención y concreta el aspecto que te preocupa.",
      "choices": [
        "I meant the deadline looks tight. I wasn’t questioning your ability.",
        "You’re too sensitive.",
        "Let’s pretend I never said anything."
      ],
      "answer": 0,
      "why": "Distingue la preocupación por el plazo de una valoración de la persona.",
      "hint": "Habla del plazo sin valorar las capacidades de la otra persona.",
      "details": [
        "Distingue la preocupación por el plazo de una valoración de la persona.",
        "Culpa a la persona por su reacción.",
        "Evita aclarar lo que motivó el comentario."
      ],
      "example": "I meant the deadline looks tight. I wasn’t questioning your ability.",
      "translation": "Quería decir que el plazo parece ajustado. No estaba poniendo en duda tu capacidad."
    }
  ],
  "b2-negotiate": [
    {
      "context": "Alquilas un local para un taller y el precio supera tu presupuesto.",
      "prompt": "Propón una concesión a cambio de una tarifa viable.",
      "choices": [
        "Would you consider a lower rate if we booked all four Tuesdays in advance?",
        "That price is absurd. Cut it in half.",
        "We’ll pay whatever you ask."
      ],
      "answer": 0,
      "why": "Ofrece una reserva anticipada de varios días a cambio de un precio menor, con valor para ambas partes.",
      "hint": "Ofrece algo que también beneficie al arrendador.",
      "details": [
        "Ofrece una reserva anticipada de varios días a cambio de un precio menor, con valor para ambas partes.",
        "No ofrece una razón ni una contrapartida atractiva.",
        "Renuncia a la restricción de presupuesto."
      ],
      "example": "Would you consider a lower rate if we booked all four Tuesdays in advance?",
      "translation": "¿Consideraría una tarifa menor si reserváramos los cuatro martes por adelantado?"
    },
    {
      "context": "Un proveedor propone un contrato anual antes de que puedas evaluar el servicio.",
      "prompt": "Pide un piloto y sugiere cómo decidir después.",
      "choices": [
        "Could we start with a one-month pilot and review delivery times before committing to a year?",
        "An annual contract is always a bad idea.",
        "We’ll sign today and assess the service next year."
      ],
      "answer": 0,
      "why": "Reduce el compromiso inicial y propone un criterio observable para decidir si ampliarlo.",
      "hint": "Propón un periodo de prueba y un criterio de decisión.",
      "details": [
        "Reduce el compromiso inicial y propone un criterio observable para decidir si ampliarlo.",
        "Generaliza y no ofrece una opción viable.",
        "Aplaza la comprobación hasta después del compromiso."
      ],
      "example": "Could we start with a one-month pilot and review delivery times before committing to a year?",
      "translation": "¿Podríamos empezar con un piloto de un mes y revisar los tiempos de entrega antes de comprometernos por un año?"
    }
  ],
  "b2-disagree": [
    {
      "context": "En tu barrio proponen eliminar los bancos de una plaza para reducir el ruido nocturno.",
      "prompt": "Reconoce el objetivo y propone una alternativa que conserve los asientos.",
      "choices": [
        "I agree the noise is a problem. Could we try better lighting and evening patrols before removing the benches?",
        "Anyone who supports that plan hates older people.",
        "There’s nothing to discuss because the noise doesn’t exist."
      ],
      "answer": 0,
      "why": "Reconoce el problema común y plantea medidas reversibles antes de quitar los asientos.",
      "hint": "Busca una respuesta que reconozca el ruido y mantenga los bancos.",
      "details": [
        "Reconoce el problema común y plantea medidas reversibles antes de quitar los asientos.",
        "Ataca las intenciones de quienes apoyan la idea.",
        "Descarta la preocupación sin considerar la evidencia."
      ],
      "example": "I agree the noise is a problem. Could we try better lighting and evening patrols before removing the benches?",
      "translation": "Estoy de acuerdo en que el ruido es un problema. ¿Podríamos probar con mejor iluminación y patrullas nocturnas antes de retirar los bancos?"
    },
    {
      "context": "Un colega propone que toda la formación se haga por vídeo para ahorrar tiempo.",
      "prompt": "Reconoce una ventaja y sugiere un matiz para las tareas prácticas.",
      "choices": [
        "Videos could save time on introductions, but I’d keep a live session for hands-on skills.",
        "Videos are useless in all training.",
        "Fine, let’s replace every session today."
      ],
      "answer": 0,
      "why": "Identifica dónde ahorra tiempo el vídeo y conserva la práctica en directo donde aporta valor.",
      "hint": "Distingue los contenidos introductorios de la práctica.",
      "details": [
        "Identifica dónde ahorra tiempo el vídeo y conserva la práctica en directo donde aporta valor.",
        "Rechaza incluso los usos en los que podrían ayudar.",
        "Acepta la propuesta sin abordar la limitación."
      ],
      "example": "Videos could save time on introductions, but I’d keep a live session for hands-on skills.",
      "translation": "Los vídeos podrían ahorrar tiempo en las introducciones, pero mantendría una sesión en directo para las habilidades prácticas."
    }
  ],
  "b2-data": [
    {
      "context": "Tras abrir un carril bici, bajó el tráfico de coches durante un mes con obras en la misma calle.",
      "prompt": "Interpreta el resultado con cautela.",
      "choices": [
        "Traffic fell after the lane opened, but the roadworks may also have affected the figures.",
        "The lane alone caused the entire drop.",
        "The counts tell us nothing at all."
      ],
      "answer": 0,
      "why": "Distingue la secuencia temporal de una relación causal y señala otro factor plausible.",
      "hint": "Considera qué más cambió en el mismo periodo.",
      "details": [
        "Distingue la secuencia temporal de una relación causal y señala otro factor plausible.",
        "Atribuye todo el cambio a una causa sin aislarla.",
        "Las cifras sí describen un cambio, aunque no establezcan su causa."
      ],
      "example": "Traffic fell after the lane opened, but the roadworks may also have affected the figures.",
      "translation": "El tráfico bajó después de abrirse el carril, pero las obras también pudieron afectar las cifras."
    },
    {
      "context": "Una encuesta de 25 personas en un club de ciencia muestra apoyo a abrir los domingos.",
      "prompt": "Describe qué población respalda la conclusión.",
      "choices": [
        "Most respondents from the club supported Sunday opening. We’d need a broader survey to draw conclusions about the whole town.",
        "Everyone in town wants Sunday opening.",
        "Nobody in the club has an opinion."
      ],
      "answer": 0,
      "why": "Limita el hallazgo a las personas encuestadas e identifica qué dato adicional haría falta.",
      "hint": "Limita la conclusión a las personas que respondieron.",
      "details": [
        "Limita el hallazgo a las personas encuestadas e identifica qué dato adicional haría falta.",
        "Generaliza más allá de las personas encuestadas.",
        "Contradice el resultado de la encuesta."
      ],
      "example": "Most respondents from the club supported Sunday opening. We’d need a broader survey to draw conclusions about the whole town.",
      "translation": "La mayoría de quienes respondieron en el club apoyó abrir los domingos. Haría falta una encuesta más amplia para sacar conclusiones sobre toda la ciudad."
    }
  ],
  "b2-project": [
    {
      "context": "Una exposición depende de una entrega que el transportista aún no confirma.",
      "prompt": "Comunica el riesgo, una contingencia y el momento de decisión.",
      "choices": [
        "The delivery is unconfirmed. If we don’t have a date by noon, we’ll open with the backup exhibit.",
        "We will definitely open with every item.",
        "There could be a problem someday."
      ],
      "answer": 0,
      "why": "Informa qué falta por confirmar y fija una hora y una alternativa explícitas.",
      "hint": "Fija un plazo para decidir qué hacer si la entrega sigue sin confirmarse.",
      "details": [
        "Informa qué falta por confirmar y fija una hora y una alternativa explícitas.",
        "Promete un resultado que depende de la entrega.",
        "No identifica una decisión ni un momento para actuar."
      ],
      "example": "The delivery is unconfirmed. If we don’t have a date by noon, we’ll open with the backup exhibit.",
      "translation": "La entrega sigue sin confirmarse. Si al mediodía no tenemos fecha, abriremos con la exposición de respaldo."
    },
    {
      "context": "Un festival al aire libre podría sufrir fuertes lluvias y la previsión aún varía.",
      "prompt": "Define cuándo se activa el plan alternativo.",
      "choices": [
        "If the morning forecast still shows heavy rain, we’ll move the afternoon performances indoors.",
        "There’s no reason to plan until it rains.",
        "We know exactly how the weather will turn out."
      ],
      "answer": 0,
      "why": "Vincula una condición observable con una acción específica en un momento útil para organizar el evento.",
      "hint": "Combina una condición observable con un plan alternativo.",
      "details": [
        "Vincula una condición observable con una acción específica en un momento útil para organizar el evento.",
        "Espera hasta que quede poco tiempo para actuar.",
        "Presenta como certeza una previsión variable."
      ],
      "example": "If the morning forecast still shows heavy rain, we’ll move the afternoon performances indoors.",
      "translation": "Si la previsión de la mañana aún indica lluvias intensas, trasladaremos las actuaciones de la tarde a un espacio cubierto."
    }
  ],
  "c1-crisis": [
    {
      "context": "Una cafetería recibe avisos sobre alérgenos en una tanda de productos y está verificando las etiquetas.",
      "prompt": "Comunica la medida de precaución, la incertidumbre y la próxima actualización.",
      "choices": [
        "We’ve withdrawn the batch while we verify the labels. We’ll share another update by 3 p.m.",
        "We can confirm that no customer was exposed.",
        "Someone on the kitchen staff must be responsible."
      ],
      "answer": 0,
      "why": "Separa la acción tomada de la verificación pendiente e indica cuándo llegará más información.",
      "hint": "Distingue una medida ya tomada de una conclusión aún no verificada.",
      "details": [
        "Separa la acción tomada de la verificación pendiente e indica cuándo llegará más información.",
        "Afirma una conclusión que la verificación aún no permite.",
        "Especula acerca de la responsabilidad y omite la medida de protección."
      ],
      "example": "We’ve withdrawn the batch while we verify the labels. We’ll share another update by 3 p.m.",
      "translation": "Hemos retirado el lote mientras verificamos las etiquetas. Publicaremos otra actualización a más tardar a las tres."
    },
    {
      "context": "Una biblioteca detecta accesos inusuales a su sistema de reservas y aún no conoce su alcance.",
      "prompt": "Distingue lo observado de lo que sigue bajo investigación.",
      "choices": [
        "We detected unusual access and paused online reservations. We’re still determining whether any account information was affected.",
        "All account data was certainly stolen.",
        "The system is fine and requires no action."
      ],
      "answer": 0,
      "why": "Separa el hecho detectado, la medida de contención y la investigación pendiente.",
      "hint": "Separa lo detectado de lo que aún se investiga.",
      "details": [
        "Separa el hecho detectado, la medida de contención y la investigación pendiente.",
        "Presenta una hipótesis como un hecho.",
        "Contradice la medida tomada y oculta el estado de la investigación."
      ],
      "example": "We detected unusual access and paused online reservations. We’re still determining whether any account information was affected.",
      "translation": "Detectamos accesos inusuales y suspendimos las reservas en línea. Seguimos determinando si se vio afectada información de alguna cuenta."
    }
  ],
  "c1-reason": [
    {
      "context": "Un artículo afirma que todos los centros con horario flexible retienen mejor a su personal.",
      "prompt": "Identifica qué observación refutaría esa afirmación universal.",
      "choices": [
        "A centre with flexible hours and no improvement in retention would challenge the universal claim.",
        "A centre with better retention proves the claim is universally true.",
        "The claim can only be challenged by a centre without flexible hours."
      ],
      "answer": 0,
      "why": "Un solo centro dentro del grupo descrito que no cumple el resultado basta para refutar la afirmación universal.",
      "hint": "Busca un caso que pertenezca al grupo y carezca del resultado esperado.",
      "details": [
        "Un solo centro dentro del grupo descrito que no cumple el resultado basta para refutar la afirmación universal.",
        "Un caso favorable no demuestra una regla universal.",
        "Un centro fuera del grupo descrito no contradice por sí solo lo que se afirma de ese grupo."
      ],
      "example": "A centre with flexible hours and no improvement in retention would challenge the universal claim.",
      "translation": "Un centro con horario flexible y sin mejoras en la retención cuestionaría la afirmación universal."
    },
    {
      "context": "Un informe concluye que la mentoría mejora resultados; las personas que se apuntaron ya partían con mejores notas.",
      "prompt": "Señala una explicación alternativa y un modo de examinarla.",
      "choices": [
        "Baseline differences could explain the gap. Compare students with similar prior grades and check how their results change.",
        "Higher final grades prove the mentoring worked.",
        "The starting grades prove mentoring could never help."
      ],
      "answer": 0,
      "why": "Propone comparar cambios entre estudiantes con condiciones iniciales similares para examinar la diferencia.",
      "hint": "Piensa en cómo comparar grupos que empiezan en condiciones similares.",
      "details": [
        "Propone comparar cambios entre estudiantes con condiciones iniciales similares para examinar la diferencia.",
        "Ignora que los grupos ya empezaron con resultados diferentes.",
        "La diferencia inicial limita la inferencia, pero no demuestra que la mentoría sea ineficaz."
      ],
      "example": "Baseline differences could explain the gap. Compare students with similar prior grades and check how their results change.",
      "translation": "Las diferencias iniciales podrían explicar la brecha. Comparemos estudiantes con notas previas similares y observemos cómo cambian sus resultados."
    }
  ]
};

// Traducciones al español, o equivalentes en inglés para respuestas de comprensión.
const MISSION_TRANSLATIONS = {
  "a2-delivery": [
    "Mi paquete figura como entregado, pero no lo he recibido.",
    "Por supuesto. La dirección es King Street 12, apartamento 4.",
    "Mi pedido fue devuelto al almacén. ¿Podrían organizar otra entrega?",
    "¿Hay franjas disponibles más temprano?"
  ],
  "a2-clarify": [
    "¿Podrías decirlo un poco más despacio, por favor?",
    "Entonces, te refieres a las cuatro y media, ¿verdad?",
    "¿Qué significa «onboarding» en este contexto?",
    "Entendido. Entonces, el primer paso es configurar mi cuenta."
  ],
  "a2-schedule": [
    "No puedo asistir el miércoles. ¿Te vendría bien el jueves?",
    "¿Te van bien las tres de la tarde?",
    "¿Podríamos pasar nuestra sesión a las diez, si es posible?",
    "They’re booked until noon."
  ],
  "a2-travel": [
    "Disculpe, ¿ha cambiado la puerta del vuelo 208?",
    "Go to gate B12.",
    "¿Hay otro tren al mismo destino?",
    "The next service leaves in 20 minutes."
  ],
  "b1-support": [
    "Siento que hayas tenido que insistir tantas veces. Déjame revisar el caso.",
    "Necesito un momento para revisar los detalles. ¿Puedo dejarte en espera?",
    "Entiendo por qué es frustrante. Voy a revisar el pedido.",
    "Podemos enviar el artículo correcto. La entrega suele tardar tres días hábiles."
  ],
  "b1-interview": [
    "Un cliente no podía acceder a su cuenta, así que revisé los permisos y restablecí el acceso.",
    "Estoy mejorando mi capacidad de hacer presentaciones practicando cada semana.",
    "El enfoque de su empresa en el soporte encaja con mi experiencia ayudando a usuarios.",
    "Todavía no he usado esa herramienta, pero puedo aprender y al principio pediría orientación."
  ],
  "b1-tech": [
    "¿Podrías describir lo que ocurre al encenderlo?",
    "Revisemos la conexión de la pantalla antes de sacar conclusiones.",
    "¿Me puedes decir qué mensaje de error aparece?",
    "Busca el correo de verificación en la bandeja de entrada y en la carpeta de correo no deseado."
  ],
  "b1-housing": [
    "La calefacción dejó de funcionar ayer. ¿Podría alguien revisarla?",
    "El lunes me viene bien. ¿A qué hora los espero?",
    "Hay una fuga debajo del fregadero. ¿Podrían organizar pronto una reparación?",
    "Claro, puedo enviar una foto de la zona afectada."
  ],
  "b1-team": [
    "¿Podrías compartir tu sección para el miércoles y así revisamos todo?",
    "Revisemos las prioridades y veamos qué podemos redistribuir.",
    "Debemos acordar qué plazo tiene prioridad.",
    "Me preocupa que saltarnos la revisión provoque errores."
  ],
  "b1-misunderstanding": [
    "Entiendo por qué sonó brusco. Mi intención era pedir una aclaración.",
    "Me refería al plazo del borrador, no al del informe final.",
    "Para nada. Solo me estaba concentrando en la tarea.",
    "Asegurémonos de que entendemos lo mismo."
  ],
  "b2-negotiate": [
    "Dado el alcance del puesto, ¿podríamos hablar del rango salarial?",
    "¿Estarías dispuesto a conversar sobre desarrollo profesional o flexibilidad horaria?",
    "Ahora que el puesto incluye supervisar al equipo, ¿podríamos revisar el paquete de remuneración?",
    "¿Podríamos programar una conversación de seguimiento para comienzos del mes próximo?"
  ],
  "b2-disagree": [
    "Entiendo tu punto, pero el efecto puede depender del tipo de trabajo y del equipo.",
    "Deberíamos comparar los resultados de los equipos durante un periodo similar.",
    "Aprender en línea puede ayudar, aunque algunas tareas todavía se benefician de la práctica guiada.",
    "Probemos un enfoque mixto y evaluemos los resultados."
  ],
  "b2-data": [
    "En nuestra pequeña muestra, la mayoría prefirió la nueva función.",
    "Twenty-eight users.",
    "En estos datos, la frecuencia de lectura se asocia con puntuaciones más altas.",
    "Información sobre otros factores que puedan influir en ambas variables."
  ],
  "b2-project": [
    "Deberíamos aplazar el lanzamiento hasta resolver el problema crítico.",
    "Podremos estimar el retraso cuando identifiquemos y probemos una solución.",
    "Las solicitudes adicionales pueden afectar el alcance, el presupuesto y el plazo de entrega.",
    "Ordenemos los cambios por valor e impacto antes de comprometernos."
  ],
  "c1-crisis": [
    "Estamos investigando una interrupción del servicio e informaremos a medida que sepamos más.",
    "Es posible que algunos usuarios no puedan iniciar sesión. Estamos trabajando para restablecer el acceso.",
    "Conocemos los informes de cobros duplicados y estamos investigándolos con urgencia.",
    "Compartiremos un plazo cuando tengamos una estimación fiable."
  ],
  "c1-reason": [
    "Esta afirmación requiere una definición clara de fluidez y pruebas de resultados duraderos.",
    "Un estudio controlado con una evaluación de seguimiento diferida.",
    "Los clics por sí solos no demuestran una mejora del dominio del idioma.",
    "Una evaluación diferida de lo que las personas pueden comunicar de forma independiente."
  ]
};
