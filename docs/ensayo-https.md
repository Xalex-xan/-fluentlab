# Lanzamiento de cuentas · candidato de ensayo

Esta rama parte de `44b3ad5`. GitHub Pages sigue usando la configuración
estática con las cuentas y la analítica desactivadas. El servidor de ensayo
inyecta la configuración de **xanny-dev** en memoria sobre un origen HTTPS
independiente.

## Despliegue privado

La [comparación de costos y requisitos](opciones-piloto.md) recomienda
Render Free para el piloto. La [guía operativa](operar-piloto.md) reúne el
despliegue, el aviso, los dos buzones y la matriz de pruebas. El procedimiento
de esta sección sirve para un host Linux que administra su propio TLS.


Usa un host reservado para el piloto con Node.js 22 o posterior, DNS y un
certificado válido. En Linux, la unidad `deploy/xanny-staging.service` ejecuta
el servicio como usuario dedicado. El proceso termina TLS y exige un acceso
HTTP Basic individual antes de devolver la página, los archivos, el aviso
o `cloud-config.js`. El servidor rechaza un encabezado de host distinto al
de ensayo, omite el Service Worker y envía instrucciones para evitar caché
e indexación.

1. Instala el commit revisado en `/opt/xanny-staging` y crea la cuenta local
   de servicio `xanny-staging`. Usa `deploy/staging.env.example` como plantilla
   de `/etc/xanny-staging/preview.env`. Almacena el certificado, su clave,
   el archivo de accesos y el aviso aprobado fuera del repositorio, con acceso
   de lectura limitado al usuario de servicio y al operador.
2. Completa las variables de la tabla. Mantén la escucha en loopback si hay
   un proxy HTTPS de ensayo. Configura el proxy para conservar el encabezado
   `Host` público de ensayo y usar TLS en su conexión al servicio. En una
   instalación directa, usa una interfaz de la red de ensayo y restringe su
   acceso por firewall o VPN.
3. Usa `deploy/access.example.json` como estructura. Asigna un identificador
   y un secreto aleatorio diferente por probador. El servidor exige al menos
   32 caracteres de secreto. Entrega los accesos por un canal privado.
   Para revocar un acceso, retira su entrada y reinicia el servicio.
4. Inicia `node tools/staging-server.cjs` en el host con esas variables, o
   instala e inicia la unidad de servicio. Comprueba que el dominio responde
   con certificado válido. Una visita sin credenciales debe recibir 401,
   incluso en `/cloud-config.js` y `/privacy.html`. Comprueba ambos accesos
   y que el aviso aprobado aparece sin la sección de plantilla.

| Variable | Valor que aporta el propietario |
| --- | --- |
| `XANNY_STAGING_ORIGIN` | Origen HTTPS exclusivo del piloto; incluye puerto si es distinto de 443. |
| `XANNY_STAGING_BIND` y `XANNY_STAGING_PORT` | Interfaz y puerto del host de ensayo. |
| `XANNY_TLS_CERT` y `XANNY_TLS_KEY` | Rutas al certificado y a su clave privada en el host. |
| `XANNY_STAGING_PUBLISHABLE_KEY` | Clave publicable de **xanny-dev** (`eoivuyvdohlehygxnmye`). |
| `XANNY_STAGING_ACCESS_FILE` | Ruta al archivo de accesos individuales. |
| `XANNY_STAGING_PRIVACY_JSON` | Ruta al aviso completo aprobado, basado en `privacy-fields.example.json`. |

## Supabase Auth y SMTP externo

Configura estos ajustes exclusivamente en **xanny-dev**.

| Ajuste | Valor que debe aportar el propietario |
| --- | --- |
| Site URL | El origen HTTPS privado. |
| Redirect URLs | El destino exacto `https://TU-DOMINIO-DE-ENSAYO/?auth=1`, con el puerto real si corresponde. |
| Proveedor | Correo activado y confirmación de email. Deshabilita el alta anónima para el piloto. |
| SMTP | Host, puerto y modo TLS recomendados por el proveedor, usuario y credencial SMTP. |
| Remitente | Correo de remitente y nombre visible autorizados en el proveedor. Configura sus registros de dominio. |
| Límites | Frecuencia compatible con el plan SMTP y los dos buzones de prueba. |
| Plantillas | Mantén el enlace de Supabase Auth `{{ .ConfirmationURL }}` en las plantillas aplicables y desactiva el seguimiento de clics del proveedor para esos mensajes. |

Los secretos SMTP se introducen en Supabase. Los secretos de acceso al
servidor y TLS se guardan en el host. En GitHub se versionan únicamente las
plantillas vacías.

El hook `xanny_pilot_before_signup` y su lista privada ya existen en
**xanny-dev**. Usa el [orden de activación para dos buzones](operar-piloto.md#3-configurar-correo-agregar-los-dos-buzones-y-habilitar-el-hook).
El correo externo se configura primero y las altas permanecen cerradas
hasta verificar la lista y seleccionar el hook.

[SMTP de Supabase](https://supabase.com/docs/guides/auth/auth-smtp) ·
[Redirecciones de Auth](https://supabase.com/docs/guides/auth/redirect-urls) ·
[Hook Before User Created](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)

## Verificación con buzones reales

1. Usa dos buzones controlados y autorizados, registros de prueba y dos
   perfiles independientes de navegador. Para la prueba docente, usa una
   cuenta permitida con su rol asignado desde administración. Conserva
   evidencia de fecha, estado de entrega, origen de retorno y resultado,
   sin registrar credenciales, enlaces mágicos, tokens ni datos de alumnos.
2. En cada perfil, registra su buzón y comprueba que recibe el mensaje del
   remitente esperado. Abre el enlace desde el perfil que lo solicitó.
   Verifica que vuelve por HTTPS a Mi cuenta del dominio de ensayo y que
   no es reutilizable. Repite para inicio de sesión y cierre de sesión.
   Comprueba que un buzón fuera de la lista no puede darse de alta.
3. Crea progreso con el primer alumno. En otro perfil, entra con esa cuenta,
   confirma la copia restaurada y fuerza un conflicto cambiando ambas copias.
   Confirma el respaldo y la recuperación. Entra con el segundo alumno y
   comprueba que su copia sigue separada. Verifica que un docente solo puede
   consultar los grupos autorizados y los resultados compartidos.
4. Con una cuenta de prueba, registra una solicitud de eliminación desde
   Mi cuenta. El operador comprueba la identidad y que la solicitud sigue
   vigente, revoca las sesiones y realiza el borrado definitivo con
   Supabase Auth desde administración. Si la cuenta docente posee clases,
   reasígnalas antes de un borrado autorizado para evitar el efecto de la
   cascada. Comprueba que desaparecen la cuenta, copia, eventos,
   consentimiento, solicitud, membresías y resultados de prueba y se
   conserva el otro alumno. El borrado de la cuenta en la nube y la limpieza
   del historial local se realizan por separado.
5. Abre B1 y B2 desde la instancia alojada y comprueba una sesión, el
   guardado, las animaciones y el modo de movimiento reducido.

## Privacidad y revisión de seguridad

`privacy.html` sigue siendo la plantilla en la versión estática. El servidor
privado renderiza la versión aprobada con los valores proporcionados por el
responsable. Rechaza archivos incompletos o sin aprobación. Los campos
cubren identidad, contacto, jurisdicción, vigencia, fundamentos, proveedores
y transferencias, conservación por categoría, derechos y participación de
menores. El responsable aprueba el contenido y el proceso operativo de
eliminación antes del piloto.

La auditoría de solo lectura confirmó RLS en las 12 tablas existentes,
sin acceso anónimo a datos protegidos, sin invocación anónima de RPC
privilegiados y sin escritura desde el navegador en las tablas de roles.
El asesor mantiene 13 avisos de RPC autenticados con `SECURITY DEFINER`
y ocho avisos informativos de RLS sin política en tablas de acceso interno.
La [auditoría individual y sus tres cambios propuestos](auditoria-piloto.md)
detalla los límites de los accesos. Los RPC fijan `search_path` y verifican identidad. Los del
aula verifican pertenencia o autoridad. Revisar un RPC nuevo incluye probar
que los roles ajenos siguen sin acceso.

La revocación impide reutilizar la renovación de sesión. Un token de acceso
emitido antes del borrado puede sobrevivir hasta su caducidad. Las pruebas
comprueban que la copia y los vínculos autorizados del usuario desaparecen
y no se pueden recrear con la sesión eliminada. No se reaplican las
migraciones anteriores de `xanny-dev`.

[Aviso sobre RPC privilegiados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) ·
[Sesiones de Supabase](https://supabase.com/docs/guides/auth/sessions)

## Criterios para autorizar el lanzamiento

- [ ] Instancia HTTPS privada accesible para las personas autorizadas y bloqueo sin acceso.
- [ ] Enlaces reales entregados y redirección exacta comprobada con los dos buzones.
- [ ] Aviso aprobado publicado y procedimiento de solicitudes de eliminación asignado a un responsable.
- [ ] Progreso, conflictos, restauración, aislamiento, permisos docentes y eliminación comprobados en el piloto.
- [ ] Revisión del PR y aprobación explícita del cambio de registro. La incorporación de este candidato conserva el registro público desactivado.
