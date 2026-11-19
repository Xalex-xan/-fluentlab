# Entorno HTTPS del piloto

La rama de unidades parte de `69cfcab`. La configuración estática del
repositorio conserva cuentas, aula y analítica desactivadas. GitHub Pages
continúa desplegando desde `main`. El ensayo usa un origen independiente y
el proyecto **xanny-dev**; no necesita tocar GitHub Pages.

## Ensayo reproducible

El flujo de Actions crea un Supabase y Mailpit efímeros y genera un certificado
TLS para `https://127.0.0.1:4173/`. Chrome acepta solo el certificado de esa
ejecución mediante su huella SPKI. La prueba valida que el enlace iniciado
por correo vuelve al origen HTTPS y que el contexto es seguro. Comprueba dos
alumnos y un docente, aislamiento, restauración y sincronización. El correo
se captura dentro del runner. Las migraciones del runner se ejecutan sobre
una base vacía y desechable.

## Instancia alojada

`node tools/staging-server.cjs` sirve la aplicación desde un dominio de
ensayo con HTTPS y usa exclusivamente **xanny-dev**
(`eoivuyvdohlehygxnmye`). Inyecta la configuración pública en memoria.
La rama puede alojarse detrás de controles de acceso para el equipo del piloto.

| Variable | Valor |
| --- | --- |
| `XANNY_STAGING_ORIGIN` | Origen HTTPS del dominio de ensayo, con puerto si se usa uno distinto de 443. |
| `XANNY_TLS_CERT` y `XANNY_TLS_KEY` | Rutas a un certificado válido y a su clave en el host. Guarda ambos fuera del repositorio. |
| `XANNY_STAGING_PUBLISHABLE_KEY` | Clave publicable de **xanny-dev**. |
| `XANNY_STAGING_PRIVACY_URL` | URL HTTPS del aviso completado y aprobado para el piloto. |
| `XANNY_STAGING_PRIVACY_FILE` | HTML aprobado si la URL del aviso es `/privacy.html` en el mismo dominio. |
| `XANNY_STAGING_BIND` y `XANNY_STAGING_PORT` | Interfaz y puerto de escucha del proceso. El valor predeterminado de la interfaz es `127.0.0.1`. |

El servidor comprueba el origen y devuelve `noindex` para los recursos del
piloto. Usa un subdominio específico de pruebas, un certificado válido y
controles de acceso para los destinatarios del piloto. Mantén la clave
privada de TLS y las credenciales SMTP en el gestor de secretos del host.

## Supabase Auth y SMTP

1. En **xanny-dev**, abre **Authentication → URL Configuration**. Usa el
   origen del piloto como **Site URL** y permite el destino exacto
   `https://TU-DOMINIO-DE-ENSAYO/?auth=1`. La aplicación solicita ese destino
   mediante `emailRedirectTo`. Completa el enlace en el mismo navegador
   que inició la solicitud de acceso.
2. Activa el proveedor de correo con confirmación. En la configuración de
   SMTP personalizado de Supabase, define un remitente verificado y registra
   las credenciales en Supabase. Usa la configuración de remitente y dominio
   que indique tu proveedor. Desactiva el seguimiento de clics en correos de
   inicio de sesión para conservar el enlace de Auth.
3. Prueba registro y acceso de dos buzones autorizados. Confirma recepción,
   dominio y redirección HTTPS, caducidad y uso de un solo enlace, cierre de
   sesión y recuperación en otro dispositivo. Comprueba que cada alumno
   solo puede acceder a su progreso.
4. Publica el aviso aprobado en el entorno de ensayo antes de invitar a
   estudiantes. Completa responsable, contacto, proveedores, región,
   plazos y procedimiento de baja. Si sirves el HTML desde el mismo dominio,
   el servidor exige un archivo aprobado para sustituir la plantilla.

Referencias de Supabase
[Correo SMTP personalizado](https://supabase.com/docs/guides/auth/auth-smtp),
[redirecciones](https://supabase.com/docs/guides/auth/redirect-urls) y
[acceso sin contraseña](https://supabase.com/docs/guides/auth/auth-email-passwordless).

## Revisión de seguridad

Se comprobó en `xanny-dev` el historial de migraciones existente y se realizó
una auditoría de solo lectura. Las 12 tablas revisadas tenían RLS. No hubo
permisos anónimos en esas tablas ni en las funciones privilegiadas revisadas,
ni permisos de escritura en las tablas de roles para el rol autenticado.
Los RPC privilegiados revisados fijan el `search_path` y comprueban la
identidad del actor; los de clase verifican pertenencia o autoridad.

El asesor registra 13 avisos de RPC autenticados con `SECURITY DEFINER` y
ocho avisos informativos de tablas con RLS sin política. En las tablas
internas se deniega el acceso directo; los RPC forman la interfaz de acceso
autenticado y siguen requiriendo pruebas de permisos. Conserva la lista de
RPC y las pruebas de aislamiento al cambiar el esquema. No se volvieron a
aplicar las migraciones de `xanny-dev`.

[Advertencia de funciones privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) ·
[Tablas con RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
