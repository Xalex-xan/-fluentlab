# FluentLab 3.1

Laboratorio de inglés con lecciones, escucha, voz, tarjetas y 16 misiones.
Cada misión tiene dos variantes, con dos decisiones situadas y una decisión de
transferencia en un contexto nuevo.

- **Práctica libre:** el texto de la misión es opcional.
- **Curso evaluado:** requiere una entrega escrita de al menos tres palabras.
  Se registra la entrega y se ofrecen un modelo y criterios de autoevaluación.
- **Mi progreso:** separa cierres de misión, aciertos iniciales, aciertos
  asistidos y soluciones explicadas. El historial de FluentLab 3.0 se conserva.
- **Mis errores:** prioriza decisiones falladas y muestra repasos pendientes.
  Un repaso acertado sin ayuda avanza por 1, 3, 7 y 28 días. Un resultado con
  ayuda durante un repaso reinicia el intervalo a 1 día. La evidencia de
  transferencia requiere aciertos en ambas variantes y un repaso tras 28 días.

La aplicación se sirve desde GitHub Pages con rutas relativas. El progreso y los
borradores se guardan en el navegador. Las funciones opcionales de cuentas y
estadísticas requieren configuración explícita.

## Verificación

`node --test tests/fluentlab.test.cjs` comprueba la lógica y los recursos.
Las pruebas de navegador en Actions validan escritorio, móvil y el Service Worker.
