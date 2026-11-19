# Aprende con Xanny — Unidades piloto

Laboratorio de inglés con lecciones, escucha, voz, tarjetas y 16 misiones.
Cada misión tiene dos variantes y una decisión de transferencia. En práctica libre
se pueden consultar soluciones sin responder. El curso evaluado registra entregas
escritas y ofrece autoevaluación orientativa.

La rama de desarrollo mantiene desactivados cuentas, aula y analítica en la
configuración publicada. La versión de GitHub Pages sigue en `main`.

## Progreso y cuentas

- Estudiar sin cuenta conserva la clave `fluentlab_v1` y las exportaciones de
  FluentLab 3.0, 3.1 y Aprende con Xanny. Se admite C1 como nivel de referencia;
  las microlecciones siguen llegando a B2 y las misiones a C1.
- Al iniciar sesión, el navegador abre un espacio local de esa cuenta. En Mi
  cuenta se puede copiar el progreso anterior sin cuenta con confirmación.
  Los borradores permanecen en el espacio local donde se escribieron.
- El acceso usa enlaces de Supabase Auth con PKCE. Abre el enlace en el mismo
  navegador que lo solicitó. La sesión se recupera al recargar y se puede cerrar
  en cada dispositivo. Para volver a entrar, solicita otro enlace.
- El progreso se guarda primero en el navegador y se sincroniza automáticamente
  al iniciar sesión, recuperar la conexión o terminar un lote de cambios.
  Cambios rápidos se agrupan durante unos segundos. Al abrir otra sesión se
  recupera la última copia si ese navegador no tiene cambios pendientes.
- La sincronización compara la revisión de la copia. Si dos dispositivos
  guardaron historiales distintos, pide elegir cuál usar y conserva un respaldo
  local de la alternativa. El guardado en la nube excluye borradores, respuestas
  escritas y preferencias de consentimiento. Las copias locales se conservan al
  cerrar sesión, salvo que elijas limpiarlas desde Mi cuenta.
- Mi cuenta permite editar el nombre visible y el nivel. El progreso sin
  cuenta puede reemplazar o combinarse con el de la cuenta, previa confirmación.
  La combinación une actividades distintas y conserva el mayor avance de los
  registros coincididos para evitar sumar dos veces el mismo historial.

## Preparar un entorno de desarrollo

1. Usa un proyecto separado o Supabase CLI con Docker. En una base nueva aplica
   `supabase_setup.sql`, `supabase_aula_33.sql` y `supabase_progress_sync.sql`
   en ese orden. Si el Aula 3.3 ya está instalada, aplica solo la última.
   Usa un respaldo antes de migrar una base con datos. Cada migración se
   ejecuta una vez.
2. Configura los enlaces por correo y autoriza la URL exacta de la app de
   desarrollo con `?auth=1`. Para el entorno local de CI la app usa
   `http://127.0.0.1:4173`. El acceso de un despliegue web requiere HTTPS y
   una clave publicable. El modo local admite exclusivamente la clave
   pública local y nunca debe activarse en un despliegue web.
3. Completa y publica una política de privacidad del entorno correspondiente.
   La configuración de desarrollo activa `accountsEnabled` y
   `classroomEnabled` con la URL del proyecto y la clave publicable. Mantén
   separadas las credenciales de desarrollo y producción. Las claves de
   servicio y la contraseña de la base se usan en administración.
4. Las cuentas nuevas son estudiantes. Asigna roles desde la consola SQL de
   administración mediante `study_teachers` o `study_admins`, usando el
   identificador verificado de Auth. La gestión docente queda limitada a
   los grupos que posee. Solo el administrador tiene alcance global.
5. El docente crea un grupo, comparte el código por un canal privado y asigna
   misiones. El alumno se inscribe con un alias y elige cuándo compartir
   resultados. Los resultados incluyen métricas de práctica y fecha de
   repaso comunicadas por el dispositivo. Son datos orientativos, y una
   entrega escrita no equivale a calificación lingüística. El progreso
   privado de la cuenta no aparece en los informes docentes.
6. Prueba con dos estudiantes y un profesor. Comprueba las rutas de correo,
   el cierre de sesión, la recuperación al recargar, las copias entre
   navegadores, el acceso cruzado y el retiro del consentimiento. Para añadir
   C2, amplía el catálogo `study_levels` mediante una migración y actualiza
   el catálogo de niveles y contenidos en `study-profile.js` y en la app.

## Analítica y privacidad

Las visitas anónimas agregadas son independientes de las cuentas. La suma de
estudiantes registrados excluye a docentes y administradores. La actividad
de siete días cuenta estudiantes con al menos un evento de estudio y consentimiento.
El consentimiento se valida en el servidor. Al retirarlo se eliminan los
eventos propios de estudio. Las entregas que el estudiante comparte
voluntariamente con su grupo constituyen un flujo independiente. Consulta
[el borrador de privacidad](docs/privacidad-aula.md) antes del piloto.

## Verificación

- `node --test tests/fluentlab.test.cjs` comprueba lógica, compatibilidad y
  configuración desactivada.
- `tests/browser.cjs` recorre escritorio, móvil y PWA. `tests/sync-schema.sql` usa
  PostgreSQL para comprobar roles, RLS, revisiones y solicitudes de eliminación.
  `node --test tests/progress-sync.test.cjs` prueba el agrupamiento y la
  recuperación ante falta de conexión, sesión vencida y fallos del servidor.
- GitHub Actions prepara un Supabase propio del runner con Auth, PostgREST y
  Mailpit. `tests/auth.cjs` comprueba registro por enlace, sesión, dos
  navegadores, edición de perfil, conflicto entre dispositivos, reintentos y un
  flujo completo de clase. Se ejecuta con correo de prueba capturado en Mailpit.

## Antes de activar el registro público

- Prueba el flujo de correo con el SMTP y las URL HTTPS y de redirección del
  entorno que se vaya a usar. Conserva `accountsEnabled: false` en GitHub
  Pages hasta comprobarlo con dos buzones autorizados. Configura en el cliente
  únicamente una clave publicable.
- Completa el aviso de privacidad del entorno y define quién atiende las
  solicitudes de eliminación. El alumno puede pedir la baja, cancelarla
  mientras esté pendiente y limpiar su navegador por separado.
- Revisa las solicitudes en `account_deletion_requests` desde administración.
  Verifica la identidad y la solicitud vigente, gestiona cualquier clase del
  titular y elimina la cuenta mediante Supabase Auth desde un servicio
  administrativo o el panel. Las referencias de usuario usan borrado en
  cascada. Si hay respaldos o datos en proveedores externos, aplica la política
  de conservación declarada. Verifica la eliminación y registra su atención
  según el procedimiento del responsable.

## Serie de unidades piloto

- **B1 — Cuando el viaje cambia.** Reprogramación de un viaje, lectura de
  condiciones, escucha de cambios y escritura de avisos.
- **B2 — Decidir con evidencia.** Interpretación de resultados incompletos,
  negociación de un piloto, comunicación de límites y memo de decisión.

Cada unidad contiene ocho sesiones y cinco ejercicios por banco. Cada práctica
presenta tres ejercicios y la evaluación presenta cuatro, evitando repeticiones
recientes cuando el banco lo permite. Hay selección contextual, respuesta de
una palabra y ordenación con teclado o toque. Las sesiones alternan análisis,
escucha con voz del navegador e interacción. Las pistas o transcripciones
cuentan como ayuda. Los resultados y la fecha de repaso se sincronizan con el
progreso existente; el texto de escritura permanece en el dispositivo. La
evaluación separa precisión inicial, corrección asistida y entrega escrita.

El [candidato de ensayo HTTPS privado](docs/ensayo-https.md) documenta el
servidor, el control de altas, el SMTP, la privacidad y las pruebas de
eliminación. GitHub Actions
ejecuta la prueba de cuentas con TLS, revisión de accesibilidad con axe y
presupuestos de recursos en Chrome. La validación del correo real en el host
y la aprobación del aviso siguen siendo condiciones para abrir el registro.
