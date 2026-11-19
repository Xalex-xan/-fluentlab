# Aprende con Xanny · Demostración para amigos

Rama `development/xanny-demo-amigos`, basada en `4bb639b`. GitHub
Actions ejecuta la demo y adjunta el paquete `aprende-con-xanny-demo` en
**Artifacts**. Usa el artefacto del commit que haya superado todas las
pruebas. El artefacto es para revisar el sitio en el equipo y no crea un
enlace público.

## Probar en tu equipo

1. Descarga y extrae el artefacto de GitHub Actions en una carpeta nueva.
   Si trabajas desde el código, ejecuta `node tools/build-demo.cjs` con
   Node.js 22. El resultado queda en `dist-demo/`. Usa una carpeta de
   salida vacía para cada compilación.
2. Sirve la carpeta extraída mediante HTTP local. Por ejemplo, si se
   llama `dist-demo` y tienes Python, ejecuta desde su carpeta superior:

   ```sh
   python -m http.server 4174 --bind 127.0.0.1 --directory dist-demo
   ```

3. Abre `http://127.0.0.1:4174/`. El empaquetado local no necesita
   claves ni un servicio de cuentas. El servidor local sirve para
   revisión en tu equipo. La variante de Render añade el control de
   acceso individual al sitio.

## Texto para invitar a los amigos

> Aprende con Xanny es un sitio para practicar inglés con situaciones
> reales. Entra a la demo sin crear una cuenta. Puedes resolver un
> cambio de viaje, practicar una entrevista, negociar una propuesta
> o escuchar un diálogo. Xanny te da pistas y te explica las respuestas.
> Si puedes, prueba también desde el celular. En «Opinar» puedes
> descargar tus comentarios y compartirlos con quien te invitó.

## Qué se puede probar

- Diagnóstico de 12 preguntas con soluciones explicadas y selección de ruta.
- Lecciones, vocabulario, gramática, lectura, escritura, tarjetas y repasos.
- Las ocho sesiones de cada unidad B1 y B2, con entradas directas a dos
  ejercicios. Las 16 misiones y sus variantes siguen en el catálogo.
- Pistas, reintentos y decisiones de transferencia. Xanny reacciona a lo que
  ocurre en la sesión y respeta la preferencia de movimiento reducido.
- Progreso real en el navegador. Las pantallas de ejemplo identifican sus
  datos como ficticios. Reiniciar borra solo el espacio de práctica de la demo.
- Escritura con sugerencias orientativas y modelos. La entrega de un escrito
  no equivale a una evaluación lingüística.
- Opiniones opcionales en un archivo de texto generado en el navegador. El
  formulario no lo envía ni lo guarda automáticamente.

El acceso por correo, la recuperación entre dispositivos y el Aula Virtual
con grupos y alumnos reales siguen en el piloto privado de cuentas. La demo
solo ilustra su funcionamiento. La síntesis de voz necesita una voz local
en inglés. Si falta, se puede leer la transcripción. La sección Hablar
ofrece comparación escrita en la demo. El micrófono permanece desactivado.
Los enlaces de Biblioteca abren recursos externos por elección del visitante.

## Publicar en Render Free tras la aprobación del propietario

1. En Render, crea un **Blueprint nuevo** con el repositorio
   `Xalex-xan/-fluentlab`, selecciona `development/xanny-demo-amigos`
   y escribe `deploy/render-demo.yaml` como ruta del Blueprint.
   Comprueba que el plan seleccionado sea **Free** y que la vista previa
   cree únicamente `xanny-demo-amigos`. Elige el commit aprobado para el
   despliegue. El despliegue automático del servicio está desactivado.
2. En **Environment → Secret Files**, añade `access-demo.json` con la
   estructura de `deploy/access.example.json`. Genera un identificador
   distinto y un secreto aleatorio de al menos 32 caracteres para cada
   amigo autorizado. Usa un canal privado para entregarlos. El sitio
   exige acceso individual a todos los archivos, salvo su comprobación
   vacía `/healthz`. Las credenciales del sitio son independientes de una
   cuenta estudiantil y se guardan en Render.
3. Despliega manualmente la versión revisada. El primer arranque puede
   fallar hasta que se cargue el archivo de accesos. La configuración
   prepara un sitio separado del ensayo de cuentas y de GitHub Pages.
   Usa el subdominio HTTPS de Render. El servicio no requiere claves de
   Supabase, cambios en xanny-dev, correo ni un backend para opiniones.
4. Comprueba el enlace HTTPS en una ventana privada. Espera 401 en
   `/`, `/app.js` y `/privacy.html` sin acceso, 200 tras autorizar y
   404 para `/cloud-config.js` y `/sw.js` tras autorizar. Comprueba el
   aviso, una sesión B1 y otra B2, la descarga de opiniones y el reinicio
   en un teléfono real. Comparte el enlace solo después de esta prueba.
   Cuando concluya la demo, retira los accesos y suspende el servicio.

[Blueprint de Render](https://render.com/docs/infrastructure-as-code) ·
[Archivos reservados de Render](https://render.com/docs/configure-environment-variables) ·
[Condiciones de Render Free](https://render.com/docs/free)

Para centralizar opiniones más adelante, el propietario puede preparar
un formulario externo sin inicio de sesión ni recopilación de correo.
Debe revisar la configuración y el aviso del proveedor, así como la
retención y el acceso a respuestas, antes de añadir ese enlace. Durante
la demo invita a los amigos autorizados y evita recoger datos de menores.
