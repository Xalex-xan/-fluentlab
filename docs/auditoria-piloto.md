# Auditoría de los 13 avisos de funciones privilegiadas

Revisión del asesor y de las definiciones en `pg_proc` de **xanny-dev** en
solo lectura. Las 13 funciones tenían `SECURITY DEFINER`, `search_path`
vacío y permiso `EXECUTE` para `authenticated`. `anon` carecía de ese
permiso. Los controles de identidad y pertenencia son indispensables porque
estas funciones pueden operar sobre tablas protegidas en nombre del usuario.

| Función | Decisión para el piloto |
| --- | --- |
| `fluentlab_teacher_overview` | Intencional. Resumen global solo para administradores. El recuento de actividad usa el consentimiento del alumno. |
| `fluentlab_teacher_roster` | Cambiar. El acceso administrativo es intencional. La versión alojada presenta métricas de eventos históricos sin verificar consentimiento y puede incluir perfiles del personal. El cambio conserva alias y nivel de alumnos y filtra los eventos por consentimiento vigente. |
| `xanny_account_deletion_request` | Intencional. Crea o cancela solo la solicitud del titular. El borrado definitivo corresponde a la administración tras verificar identidad y la vigencia de la solicitud. |
| `xanny_analytics_consent` | Intencional. Solo cambia el consentimiento propio. Revocarlo borra los eventos individuales del usuario. Las dos opciones de analítica quedan desactivadas en el servidor de ensayo. |
| `xanny_assign_mission` | Intencional. El profesor propietario del grupo o un administrador asigna misiones del catálogo; la combinación grupo/misión es única. |
| `xanny_classroom_context` | Intencional. Devuelve grupos propios, administrables o de pertenencia, y el estado de entrega del usuario. El código de invitación se devuelve solo a quien administra el grupo. |
| `xanny_classroom_report` | Intencional. Restringido al propietario docente del grupo o a un administrador. Informa métricas, alias y entrega de escritura, sin texto del alumno ni progreso privado de su perfil. |
| `xanny_create_group` | Intencional. Solo profesor o administrador y el propietario se fija con el identificador de la sesión. |
| `xanny_join_group` | Intencional. Un alumno se inscribe con un código UUID; el código es reutilizable hasta rotarlo. Compártelo únicamente por un canal autorizado. La rotación no revoca membresías existentes. |
| `xanny_rotate_invite` | Intencional. El propietario docente o un administrador cambia el código. El anterior deja de admitir nuevas inscripciones. |
| `xanny_save_progress` | Retirar de la API autenticada. Es la ruta heredada de escritura por fecha, sustituida en este cliente por la revisión UUID. Retirar el permiso evita mantener dos rutas públicas. Las filas y el historial de migraciones se conservan. |
| `xanny_submit_result` | Intencional para evaluación formativa. Solo el alumno de la clase puede compartir un resultado de la misión asignada. Los contadores provienen del cliente y se validan rangos y consistencia. Para calificar o emitir certificados se requiere verificación de la evidencia en el servidor. |
| `xanny_sync_progress` | Conservar la operación y endurecer el formato. La cuenta se vincula a la sesión y una revisión obsoleta provoca conflicto. Se rechazan nuevas copias con claves superiores que no emite StudyProfile, incluidos los borradores de unidades. Los valores internos los filtra el cliente oficial; antes de aceptar clientes externos, validar también esas estructuras en la API. |

Se preparó `supabase_pilot_hardening.sql` como cambio nuevo para revisar y
probar en una base efímera. Incluye solo los tres cambios de arriba. La
restricción de progreso se aplica a escrituras posteriores y conserva las
filas históricas hasta que el titular guarde una copia nueva. Antes de
aplicarla solo en **xanny-dev**, confirma que no quedan consumidores del
RPC legado y revisa el guion junto con las pruebas. No vuelvas a ejecutar
las migraciones previas ni apliques este cambio a producción durante el
piloto. Después de aplicarlo, vuelve a consultar el asesor: revocar la
ruta heredada debería eliminar su aviso; los otros 12 siguen siendo
entradas privilegiadas deliberadas.

El asesor también lista ocho tablas internas con RLS activada y sin
política de acceso directo para el navegador. Los RPC revisados median el
acceso a los roles, catálogo, clases y resultados. Conserva esa restricción.
El hook de alta es una función invocadora, con ejecución reservada a
`supabase_auth_admin`, fuera de estos 13 avisos.

[Detalle del aviso de Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
