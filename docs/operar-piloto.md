# Operación del piloto privado

Los pasos se realizan en la rama del [PR borrador #1](https://github.com/Xalex-xan/-fluentlab/pull/1)
y en **xanny-dev** (`eoivuyvdohlehygxnmye`). Mantén cerrado el registro de
Github Pages. Usa identidades y datos de prueba. Los dos buzones los
autoriza y controla el responsable del piloto.

## 1. Completar y aprobar el aviso

1. Copia `privacy-fields.example.json` como `privacy.json` **fuera del
   repositorio**. Mantén `approved: false` durante la preparación. Usa como
   referencia la [página de privacidad y sus campos](privacidad-aula.md).
2. El responsable completa `controller` (identidad, contacto y ámbito),
   `effectiveOn` (fecha real, formato AAAA-MM-DD), `purposes` (finalidad y
   fundamento aplicable para cada función), `processors` (alojamiento,
   Supabase Auth, proveedor de correo, ubicación y transferencias),
   `retention` (cuenta, progreso, aula, registros y respaldos),
   `rights` (solicitudes y reclamaciones) y `minors` (si participan y bajo
   qué condiciones). Confirma los plazos con los procesos y proveedores
   reales. Indica que la analítica está desactivada en este piloto.
3. Comprueba que el contacto funciona, prueba la recepción de una solicitud
   interna de eliminación y verifica que la descripción coincide con lo
   que se guarda y quién puede verlo. Registra por vía interna quién
   aprobó el texto, en qué fecha y qué versión del archivo aprobó. El
   responsable cambia `approved` a `true` al terminar. No uses textos
   provisionales ni fechas supuestas.
4. Desde la raíz del repositorio, valida el archivo antes de cargarlo.
   El comando comprueba formato y campos completos. La aprobación sustantiva
   la realiza el responsable.

```sh
node -e "const fs=require('node:fs'); require('./tools/privacy-notice.cjs').renderPrivacyNotice(fs.readFileSync('privacy.html','utf8'),JSON.parse(fs.readFileSync(process.argv[1],'utf8'))); console.log('Aviso listo para cargar');" /ruta/privada/privacy.json
```

## 2. Desplegar el sitio de ensayo en Render Free

1. En Render selecciona **New → Blueprint** y el repositorio
   `Xalex-xan/-fluentlab`. Selecciona la rama
   `development/xanny-rc-cuentas` y el `render.yaml` de la raíz. Revisa
   que la vista previa solo contemple un Web Service en **Free** y que la
   rama y región sean las del piloto. Elige la región tras revisar el
   aviso. El autodespliegue del servicio está deshabilitado.
2. Introduce en Render `XANNY_STAGING_PUBLISHABLE_KEY` con la clave
   **Publishable** de xanny-dev. Render proporciona `PORT` y
   `RENDER_EXTERNAL_URL`. Usa el subdominio oficial `onrender.com`.
3. En **Environment → Secret Files**, carga `access.json` con la
   estructura de `deploy/access.example.json` y `privacy.json` aprobado.
   Genera un secreto aleatorio y diferente, de al menos 32 caracteres,
   por persona. Distribúyelo por un canal privado. El servicio exige
   ambos archivos y falla al arrancar si faltan o son inválidos. Si
   Render inicia el primer despliegue antes de cargarlos, vuelve a
   desplegar al guardarlos.
4. Ejecuta el deploy manual del commit que pasó CI. Antes de distribuir el
   enlace, verifica TLS válido, redirección de HTTP a HTTPS y los
   códigos de respuesta de la matriz. Si un acceso válido obtiene 403
   desde HTTPS, revisa que el proxy envíe `X-Forwarded-Proto: https`
   y conserva la validación de origen mientras se resuelve. El URL de
   retorno de Auth debe apuntar a este mismo origen.
5. Mantén copia privada de los dos archivos. Si revocas un acceso al
   sitio, retira su entrada y vuelve a desplegar. Para desactivar el
   sitio completo, suspende el servicio en Render.

[Blueprint de Render](https://render.com/docs/infrastructure-as-code) ·
[Archivos reservados en Render](https://render.com/docs/configure-environment-variables) ·
[Comprobaciones de salud](https://render.com/docs/health-checks)

## 3. Configurar correo, agregar los dos buzones y habilitar el hook

1. En **xanny-dev → Authentication**, mantén desactivadas las altas
   nuevas mientras preparas el piloto y deja deshabilitado el acceso
   anónimo. Revisa que las cuentas existentes del proyecto correspondan a
   personal autorizado o a pruebas controladas. El hook solo comprueba
   altas nuevas. Conserva las cuentas legítimas; retira el acceso de
   cualquier identidad ajena al piloto a través de su responsable.
2. En **URL Configuration**, configura como **Site URL** el origen
   `https://TU-SERVICIO.onrender.com` y como redirección exacta
   `https://TU-SERVICIO.onrender.com/?auth=1`. Retira comodines de
   ensayo innecesarios después de revisar sus dependencias. Usa el
   proveedor Email con confirmación de correo activada.
3. Activa **Custom SMTP** en Supabase. Introduce remitente, nombre visible,
   host, puerto TLS, usuario y credencial de envío del proveedor. Usa un
   remitente verificado y revisa DNS, cuota de Auth y plantilla
   `{{ .ConfirmationURL }}`. Deshabilita el seguimiento de clics y las
   reescrituras de enlace. Revisa el funcionamiento del remitente desde el
   proveedor. Si ya existe una identidad de prueba autorizada en el
   proyecto, verifica un inicio de sesión de esa cuenta con el registro
   cerrado. Conserva la credencial SMTP exclusivamente en Supabase.
4. Confirma en el historial que el cambio `xanny_pilot_signup_gate` ya está
   aplicado en xanny-dev. **Omite esa migración.** Revisa el nuevo cambio
   de [endurecimiento](auditoria-piloto.md), comprueba el CI y que no hay
   clientes activos que llamen al RPC legado. Aplica únicamente ese nuevo
   cambio en xanny-dev y comprueba sus permisos antes de abrir el piloto.
5. Carga los dos buzones en el SQL Editor de **xanny-dev**, sustituyendo
   los dos marcadores por direcciones exactas de tu lista aprobada. Haz
   primero una revisión de las entradas actuales allí mismo. Si quedan
   direcciones de ensayos anteriores, resuélvelas con el responsable
   antes de continuar. Guarda el resultado de la aprobación sin incluir
   las direcciones en el PR.

```sql
begin;
insert into xanny_private.pilot_mailboxes(email)
values (lower(btrim('<BUZÓN_1_AUTORIZADO>'))),
       (lower(btrim('<BUZÓN_2_AUTORIZADO>')))
on conflict (email) do nothing;
do $$
begin
  if (select count(*) from xanny_private.pilot_mailboxes) <> 2 then
    raise exception 'La lista del piloto requiere exactamente dos buzones';
  end if;
end;
$$;
commit;
```

6. Con SMTP configurado y la lista verificada, ve a **Authentication →
   Hooks → Before User Created** y activa
   `public.xanny_pilot_before_signup` como **Postgres Function**. Verifica
   que seleccionaste el proyecto de ensayo. Solo entonces permite altas
   por correo en xanny-dev. Haz primero la prueba de rechazo y luego
   las dos positivas. Si falla el rechazo, vuelve a cerrar las altas y
   detén el piloto. Conserva habilitado el hook al cerrar las altas.
7. El registro de los dos alumnos se hace con sus propios buzones.
   Para la prueba docente utiliza una cuenta docente de prueba existente
   y autorizada. Si solo están disponibles los dos buzones, termina las
   pruebas de aislamiento entre alumnos y usa después una de esas
   cuentas, sin datos de alumno que deban conservarse, como docente
   temporal. Asigna y retira el rol en `public.study_teachers` desde
   administración con el UUID verificado en Auth. Conserva una cuenta
   de alumno independiente. La prueba automatizada cubre el acceso
   denegado a un profesor ajeno al grupo.

[SMTP de Supabase](https://supabase.com/docs/guides/auth/auth-smtp) ·
[Redirecciones de Auth](https://supabase.com/docs/guides/auth/redirect-urls) ·
[Hook de alta](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)

## 4. Matriz de aceptación manual

Usa dos perfiles de navegador independientes y un móvil, con datos
sintéticos. Anota fecha, commit, caso y resultado. Conserva estado de
entrega, origen de retorno y códigos HTTP sin copiar correos, tokens,
enlaces completos ni datos privados. Un fallo en altas, privacidad o
aislamiento bloquea la invitación a estudiantes reales.

| Caso | Acción | Resultado esperado |
| --- | --- | --- |
| Origen privado | Abre `http://` y luego `https://` desde un navegador limpio. Consulta `/`, `/app.js`, `/cloud-config.js` y `/privacy.html` sin credenciales. Prueba una credencial incorrecta y una válida. | HTTP redirige a HTTPS. TLS tiene certificado válido. Los recursos y el aviso devuelven 401 antes de autorizar. La sesión autorizada carga el portal y el aviso completo. `GET /healthz` devuelve 204 vacío. El piloto omite el Service Worker. |
| Buzón no autorizado | Solicita el alta con un buzón de control que el responsable autorice para la prueba negativa y que quede fuera de la lista. | El hook rechaza la creación. No llega ningún enlace, no aparece un usuario en Auth y el registro de Auth acredita el rechazo. |
| Alta y acceso por correo | Crea cada alumno desde Mi cuenta. Abre el enlace en el perfil que lo solicitó. Cierra sesión e inicia de nuevo con otro enlace. Prueba un enlace usado y uno caducado. | Los dos mensajes llegan del remitente previsto y vuelven por HTTPS a `/?auth=1` del piloto. Los enlaces usados o caducados no reabren una sesión. Se puede pedir otro. |
| Recuperación en otro dispositivo | Completa una sesión B1 y una misión, espera **Guardado**, e inicia con la misma cuenta en otro perfil. Solicita y abre su propio enlace en ese perfil. | Se recuperan nivel, experiencia, resultados y repasos. El borrador escrito permanece en su dispositivo de origen. |
| Historial local | En un perfil limpio, importa un respaldo de prueba con progreso histórico y estudia sin cuenta. Al entrar, revisa la confirmación para combinar o reemplazar, cancela una vez y confirma después. | Cancelar conserva ambos historiales. La acción confirmada conserva un respaldo recuperable y la evolución sigue visible. |
| Sin conexión y conflicto | Con el mismo alumno, cambia ambas copias antes de sincronizar. Interrumpe internet en una, crea progreso local, restaura red y abre la resolución de conflicto. | Hay aviso de cambios pendientes o conflicto. Seleccionar una copia requiere confirmación y deja un respaldo. Ninguna versión más reciente se sobrescribe automáticamente. |
| Aislamiento de alumnos | Cambia a la segunda cuenta en un perfil nuevo y verifica sus datos. Comprueba en Auth/SQL como actor de prueba la separación de lecturas, sincronización y solicitudes de baja. | Cada alumno solo ve su progreso. El segundo no puede consultar ni escribir la copia del primero ni cancelar su solicitud. |
| Permisos docentes | Crea una clase con un docente autorizado, incorpora solo un alumno, asigna una misión y comparte el resultado. Comprueba el informe como docente y repite con un alumno y, si existe, un docente ajeno. | El docente autorizado ve el informe de su clase. Los demás no pueden consultar informes ni asignar fuera de su ámbito. Se comparte el indicador de entrega, no el texto escrito ni su calificación lingüística. |
| Baja de prueba | El alumno presenta una solicitud desde Mi cuenta. El operador verifica identidad y conserva una nota interna del trámite. Si es docente, reasigna previamente las clases a su responsable. Revoca sesiones y borra al usuario desde administración de Auth. | Se eliminan la cuenta, progreso remoto, eventos, preferencias, solicitud, membresías y resultados vinculados. El otro alumno sigue intacto. Un token de acceso anterior puede durar hasta caducar; no puede recrear los datos del usuario borrado. El historial local se limpia aparte, desde el dispositivo. |
| Regresión visual | Abre las dos unidades B1/B2 y completa una sesión piloto en escritorio y móvil, con y sin reducción de movimiento. Comprueba luego la página pública desde otro perfil. | Las unidades y la mascota funcionan con las preferencias del dispositivo. GitHub Pages sigue disponible y el registro público sigue desactivado. |

Al terminar, cierra las altas de xanny-dev, retira los accesos de prueba
que ya no se necesiten y revoca las sesiones de las identidades que deban
salir. El responsable firma la matriz y registra las incidencias. El PR
sigue en borrador hasta la revisión del piloto.
