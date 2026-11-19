# Alojamiento y correo para el piloto privado

Condiciones revisadas el 19 de noviembre de 2026. Precios en USD. Las cuotas
se comparten según el proveedor. El registro o la renovación de un dominio
de correo, si hace falta, se presupuestan por separado.

## Dónde alojar el ensayo

| Opción | Costo y límites | Compatibilidad |
| --- | --- | --- |
| **Render Free, recomendado** | **USD 0/mes**. Incluye subdominio y TLS, y 750 horas por espacio de trabajo y mes. Suspende el proceso tras 15 min sin tráfico y tarda alrededor de un minuto en reanudarlo. Hay cuotas de transferencia y compilación. | Ejecuta el servidor Node con el adaptador de este PR. El proxy de Render termina el TLS y el servidor protege el contenido con HTTP Basic individual. El disco efímero es suficiente porque el progreso se guarda en Supabase o en el navegador. |
| Railway Free / Hobby | Free cuesta **USD 0/mes** e incluye USD 1 mensual de consumo. Suspende servicios inactivos y, agotado el crédito, el servicio se detiene hasta el próximo ciclo. Hobby parte de **USD 5/mes**, con consumo adicional según uso. | Puede ejecutar Node detrás de su propio proxy HTTPS. Requiere adaptar el arranque, el dominio y la carga de archivos reservados a Railway. El modo Render solo se ejecuta allí. |
| Cloudflare Tunnel + host existente | Cloudflare Access tiene plan gratuito para equipos de hasta 50 usuarios. El host en marcha y el dominio administrado en Cloudflare tienen el costo que ya corresponda. | Conserva el servidor Node HTTPS y añade `cloudflared`. Requiere host disponible, DNS y configuración del certificado, del encabezado Host y del túnel. Tiene sentido si ya están disponibles. |

Render Free es el camino más corto con un origen estable y sin comprar
dominio web ni administrar certificados. El subdominio es accesible desde
internet y el contenido del piloto exige una credencial individual. El
endpoint `/healthz` devuelve solo 204. Los puertos SMTP salientes del plan
gratuito están bloqueados. En esta arquitectura **Supabase Auth** entrega
el correo directamente al proveedor SMTP.

[Cuotas de Render](https://render.com/docs/free) ·
[TLS y proxy de Render](https://render.com/docs/web-services) ·
[Railway Free](https://docs.railway.com/pricing/free-plan) ·
[HTTPS en Railway](https://docs.railway.com/networking/public-networking) ·
[Planes de Cloudflare Access](https://www.cloudflare.com/plans/zero-trust-services/) ·
[Publicación de aplicaciones vía Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)

## Correo transaccional de Supabase Auth

| Proveedor | Cuota gratuita | Remitente y seguridad |
| --- | --- | --- |
| **Resend Free, recomendado si el propietario administra el DNS del dominio** | 3.000 mensajes al mes, 100 al día, hasta 3 dominios verificados. Las cuotas se comparten. | Verifica un dominio o subdominio propio con SPF y DKIM y configura DMARC según la política del dominio. Usa `smtp.resend.com`, 587 con STARTTLS, usuario `resend` y una clave de solo envío restringida al dominio del piloto. El remitente de demostración de Resend tiene restricciones de destinatario. |
| Brevo Free | 300 envíos diarios, sin acumular. Incluye correo transaccional; al agotar el cupo puede encolar mensajes. | Verifica el remitente y autentica el dominio con los registros que indique Brevo. La dirección visible puede cambiar con un dominio no autenticado. Usa `smtp-relay.brevo.com`, 587 con TLS, el usuario SMTP indicado en el panel y una clave SMTP dedicada. |
| Mailjet Free | 6.000 mensajes al mes, 200 al día. | Verifica una dirección mediante correo o verifica todo el dominio. Configura SPF/DKIM y comprueba alineación con DMARC. Usa `in-v3.mailjet.com`, 587 con STARTTLS o 465 con TLS implícito, y las credenciales SMTP de Mailjet. |

Resend tiene una guía específica de Supabase. Los tres planes alcanzan para
dos buzones y sus reintentos si el proyecto y la cuenta del proveedor
tienen cuota disponible. Desactiva la reescritura de enlaces y el
seguimiento de clics en el correo de acceso. El SMTP integrado de Supabase
tiene restricciones de destinatarios y de caudal para pruebas de equipo.
Configura el correo externo antes de abrir el piloto.

[Cuotas de Resend](https://resend.com/docs/knowledge-base/account-quotas-and-limits) ·
[Dominios en Resend Free](https://resend.com/changelog/three-domains-on-the-free-tier) ·
[SMTP de Resend](https://resend.com/docs/send-with-smtp) ·
[Resend y Supabase](https://resend.com/blog/how-to-configure-supabase-to-send-emails-from-your-domain) ·
[Cuota de Brevo](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) ·
[SMTP de Brevo](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP) ·
[Dominio en Brevo](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC) ·
[Cuotas de Mailjet](https://documentation.mailjet.com/hc/en-us/articles/19154256993051-Understanding-Mailjet-Free-Plan-Limits) ·
[Remitentes, DNS y SMTP de Mailjet](https://documentation.mailjet.com/hc/en-us/articles/37251169295003--Quick-Start-with-Mailjet) ·
[SMTP de Supabase](https://supabase.com/docs/guides/auth/auth-smtp)
