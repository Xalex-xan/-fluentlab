# Aprende con Xanny

Laboratorio de inglés con lecciones, escucha, voz, tarjetas y 16 misiones.
Cada misión ofrece dos variantes y una decisión de transferencia en otro contexto.
En práctica libre puedes consultar soluciones sin responder. El curso evaluado
solicita un texto de al menos tres palabras y registra la entrega para
autoevaluación.

## Progreso y compatibilidad

El progreso se guarda en el navegador. La clave histórica `fluentlab_v1`,
el formato de exportación y la ruta de GitHub Pages se mantienen para conservar
los datos de FluentLab 3.0 y 3.1. Los borradores permanecen en el dispositivo.
La vista de progreso muestra sesiones, resultados por modalidad, errores por
habilidad, repasos, transferencia demostrada y las seis últimas sesiones del
nuevo historial. El historial anterior sigue disponible en la misma vista.

## Cuentas y servicios opcionales

El sitio publicado funciona con los tres servicios externos desactivados.
`cloud.js` desacopla la interfaz del proveedor y `study-profile.js` define
los campos que se sincronizan y los eventos permitidos.

1. En un proyecto de desarrollo de Supabase sin tablas previas de la app, revisa
   y aplica `supabase_setup.sql`. Activa los enlaces de correo y autoriza la
   URL de retorno de GitHub Pages con `?auth=1`.
2. Configura la URL HTTPS, la política de privacidad y la clave **publicable**
   de Supabase en `cloud-config.js`. Habilita las cuentas tras validar el
   acceso y las políticas con dos usuarios. Los permisos de docencia se
   asignan en la base a través de `study_admins`.
3. Con una sesión iniciada, guardar y restaurar copias son acciones manuales.
   Restaurar requiere confirmación. Las copias excluyen borradores y
   preferencias de consentimiento.
4. La analítica de estudio requiere un interruptor independiente y el
   consentimiento de cada estudiante. Registra inicios de práctica, misiones
   finalizadas, identificadores de errores y resultados por habilidad.
   Cloudflare Web Analytics, si se configura y activa, mide visitas agregadas
   por separado.

## Verificación

`node --test tests/fluentlab.test.cjs` comprueba lógica, progreso y recursos.
GitHub Actions también verifica el flujo en Chrome de escritorio y móvil, la PWA
sin conexión y las restricciones de acceso del esquema en PostgreSQL.
