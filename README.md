# Aprende con Xanny 3.3 — Aula virtual

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
- La copia se crea manualmente. Guardar sobre una copia existente y restaurar
  requieren confirmación. Si otro dispositivo guarda entre la lectura y el
  intento de escritura, el servidor rechaza el cambio. Antes de restaurar se
  guarda un respaldo local recuperable. El progreso, temas e historial
  permitidos se copian sin borradores ni preferencias de consentimiento.

## Preparar un entorno de desarrollo

1. Usa un proyecto separado o Supabase CLI con Docker. En una base nueva aplica
   `supabase_setup.sql` y luego `supabase_aula_33.sql`. Si el esquema 3.2 ya
   existe, aplica solo la segunda migración. `xanny-dev` ya tiene aplicada
   `xanny_aula_virtual_33` en el historial de migraciones. Haz un respaldo antes de migrar un
   proyecto con datos. Ambos archivos están diseñados para ejecutarse una vez.
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
- `tests/browser.cjs` recorre escritorio, móvil y PWA. `tests/aula.sql` usa
  PostgreSQL para comprobar roles, RLS y concurrencia de copias.
- GitHub Actions prepara un Supabase propio del runner con Auth, PostgREST y
  Mailpit. `tests/auth.cjs` comprueba registro por enlace, sesión, dos
  navegadores y un flujo real de clase. Esta prueba no usa un proyecto de
  producción ni entrega correo a destinatarios externos.
