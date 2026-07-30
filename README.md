# Escalat — web de presentación

Web-escaparate de **Escalat**, empresa de soluciones informáticas con IA para pymes y autónomos.
Sitio estático hecho con [Astro](https://astro.build), con una función *serverless* para el chatbot
con IA. El contacto se canaliza a **WhatsApp** (enlaces *click-to-chat*).

## Puesta en marcha (local)

```sh
npm install
cp .env.example .env   # y rellena tus claves (ver abajo)
npm run dev            # http://localhost:4321
```

## Variables de entorno

Copia `.env.example` a `.env` y rellena:

| Variable | Para qué | Obligatoria |
| --- | --- | --- |
| `N8N_CHAT_WEBHOOK_URL` | Webhook del nodo *Chat Trigger* de n8n. Si está puesta, el chatbot lo lleva ese workflow | Sí (si usas n8n) |
| `N8N_CHAT_BASIC_USER` / `N8N_CHAT_BASIC_PASSWORD` | Credenciales del webhook cuando el Chat Trigger usa *Basic Auth* (recomendado) | Sí, si lo proteges |
| `N8N_CHAT_AUTH_HEADER` / `N8N_CHAT_AUTH_VALUE` | Solo si el chat pasa a un nodo *Webhook* normal, que sí tiene *Header Auth* | No |
| `N8N_CHAT_TIMEOUT_MS` | Espera máxima al workflow. Por defecto `30000` | No |
| `ANTHROPIC_API_KEY` | Clave de la API de Claude, usada **solo en el servidor**. Alternativa a n8n | Sí (si NO usas n8n) |
| `CHAT_MODEL` | Modelo del chatbot cuando se usa Claude. Por defecto `claude-haiku-4-5` | No |
| `CHAT_RATE_LIMIT_IP` | Mensajes por visitante y ventana. Por defecto `20` | No |
| `CHAT_RATE_LIMIT_GLOBAL` | Mensajes de toda la web por ventana. Por defecto `300` | No |
| `CHAT_RATE_WINDOW_MS` | Ventana del límite. Por defecto `600000` (10 min) | No |

### Señales del asistente a la web

El agente puede pedirle cosas a la interfaz terminando su mensaje con una línea especial.
`/api/chat` la separa antes de responder, así que **el visitante nunca la ve**:

| Línea | Efecto en el chat |
| --- | --- |
| `FORM::contacto` | Pinta un formulario (nombre, email, teléfono) dentro del hilo |
| `FORM::cita` | Pinta el selector de día y hora para reservar una entrevista |
| `LEAD::{"nombre":…,"necesidad":…,"contacto":…}` | Muestra el botón de WhatsApp ya relleno |

Los campos del formulario y sus validaciones viven en [ChatWidget.astro](src/components/ChatWidget.astro),
no en n8n: el agente solo decide **cuándo** pedirlos. Los nombres de formulario válidos
son una lista cerrada en `chat.ts`, de modo que el modelo no puede inventarse uno.

Al enviarlo, los datos vuelven al asistente como un mensaje normal y la conversación sigue.

Para activarlo, añade esto al prompt del agente en n8n:

```text
Cuando toque pedir los datos de contacto (nombre, email y teléfono), NO los pidas
uno a uno. Escribe una frase breve anunciándolo y termina el mensaje con esta línea
exacta, sola en su propia línea:
FORM::contacto
La web mostrará un formulario. No menciones nunca esa línea ni la palabra
"formulario". Úsala una sola vez por conversación.
```

### Agenda de entrevistas

**El modelo no decide horas.** Si se le pregunta qué huecos hay, se los inventa con
total naturalidad, y una hora inventada es una persona plantada en la puerta. Por eso
la disponibilidad va por un camino aparte, sin IA de por medio:

```
navegador → /api/slots → n8n (BUSY) → Google Calendar
                ↓
        lib/agenda.ts calcula los huecos libres
```

Las reglas del negocio —horario, duración, margen entre citas, antelación mínima,
horizonte— están en [lib/agenda.ts](src/lib/agenda.ts), no en n8n: hacer cuentas de
fechas en nodos es un suplicio y allí no se pueden probar. **n8n solo responde qué
está ocupado.**

Al confirmar, `/api/book` **vuelve a consultar el calendario** antes de crear el
evento: entre que se pintan los huecos y el visitante decide pueden pasar minutos, y
otra persona puede haberse adelantado. Si pasa, devuelve `409` y el selector se
recarga conservando los datos ya escritos.

> Queda una ventana de carrera de milisegundos entre revalidar y crear, porque Google
> Calendar no ofrece reserva atómica. Para el volumen de una pyme es asumible; si
> algún día hay solapes reales, tocaría un motor de reservas tipo Cal.com.

Hacen falta **dos workflows nuevos en n8n**, cada uno con su webhook:

| | Recibe | Debe responder |
| --- | --- | --- |
| **BUSY** | `{action:"busy", start, end}` (ISO UTC) | `{"busy":[{"start":"…","end":"…"}]}` |
| **BOOK** | `{action:"book", start, nombre, email, telefono, nota}` | `{"ok":true}` (o `{"ok":false}` si no pudo) |

BUSY es un único nodo *Google Calendar → Get Many Events* con el rango recibido.
También se acepta el formato crudo de Google (`{items:[{start:{dateTime}}]}`), por si
sale directo del nodo. BOOK es un *Google Calendar → Create Event* de
`AGENDA.duracionMin` minutos.

Sus URL van en `N8N_BUSY_WEBHOOK_URL` y `N8N_BOOK_WEBHOOK_URL`. Si faltan, el selector
avisa y el resto del chat sigue funcionando.

### Protección del chat

Cada respuesta del chat cuesta tokens de IA, así que `/api/chat` no es de acceso libre:

- **Límite por IP y límite global** ([lib/rate-limit.ts](src/lib/rate-limit.ts)), en memoria del proceso.
  Al superarlo devuelve `429` con `Retry-After` y el widget muestra un aviso amable.
  La IP real se lee de `CF-Connecting-IP` (Cloudflare) con respaldo en `X-Forwarded-For`.
- **Tamaño máximo de petición** y recorte del historial a 20 mensajes de 2000 caracteres.
- **Cabeceras de seguridad** en el Caddyfile de `escalat-infra`, y **CSP con hashes**
  generada por Astro (`security.csp` en `astro.config.mjs`) — sin `unsafe-inline`.
- El contenedor corre como usuario **`node`**, no como root.

> Si algún día la web pasa a tener varias réplicas, el límite tendría que moverse a Redis:
> tal cual está, cada proceso lleva su propia cuenta.

### Cómo elige el chat su cerebro

`/api/chat` mira `N8N_CHAT_WEBHOOK_URL`:

- **Definida** → reenvía el mensaje al workflow de n8n (`{"action":"sendMessage","sessionId","chatInput"}`)
  y devuelve al navegador el texto del último nodo (`output`, `text`, `message`…).
- **Vacía** → llama a Claude directamente con el prompt de sistema de `src/pages/api/chat.ts`.

> Ni la URL del webhook ni sus credenciales llegan al navegador: la llamada se hace desde el
> servidor, así que tampoco hace falta abrir CORS en n8n.
> Sin ninguna de las dos configuraciones, el chat responde con un mensaje de respaldo sin romperse.
>
> El **número de WhatsApp** para el contacto se configura en `src/config.ts` (`WHATSAPP_NUMBER`),
> no como variable de entorno (se usa en el navegador para los enlaces click-to-chat).

## Estructura

```
src/
├─ styles/tokens.css      # paleta Grafito + Oro, tipografía y estilos comunes
├─ layouts/Base.astro     # <head>/SEO, header, footer, chat, scroll-reveal
├─ config.ts              # WHATSAPP_NUMBER, email y helper de enlaces WhatsApp
├─ components/            # Hero, Problema, Servicios, ComoFunciona, Caso, SobreEscalar,
│                         # Contacto, ChatWidget, Header, Footer, Logo, Icon
├─ pages/
│  ├─ index.astro         # portada (one-page)
│  ├─ aviso-legal.astro   # RGPD — completar datos entre [corchetes]
│  ├─ privacidad.astro    # RGPD — completar datos entre [corchetes]
│  └─ api/
│     └─ chat.ts          # chatbot con IA (Claude); devuelve el lead para el botón de WhatsApp
└─ lib/                   # env.ts
```

## Idiomas (i18n)

Web bilingüe: **español** en la raíz (`/`) e **inglés** en `/en/`. Todos los textos están
centralizados en `src/i18n/ui.ts` (objeto `ui.es` / `ui.en`); cada componente lee el idioma activo
con `useT(Astro.currentLocale)`. Hay selector ES/EN en la cabecera y etiquetas `hreflang` para SEO.

- Para **editar un texto**: cámbialo en `src/i18n/ui.ts` (en `es` y en `en`).
- Para **añadir un idioma**: añádelo a `locales` en `astro.config.mjs`, agrega su bloque en `ui.ts`
  y crea sus páginas en `src/pages/<lang>/`.
- El **inglés es un borrador** generado automáticamente: conviene revisarlo antes de publicar.
- Las páginas legales en inglés están en `src/pages/en/legal-notice.astro` y `.../privacy.astro`.

## Comandos

| Comando | Acción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en `localhost:4321` |
| `npm run build` | Compila el sitio a `./dist/` |
| `npm run preview` | Previsualiza la build |

## Despliegue

Autoalojado con **Docker** detrás de un **Caddy compartido** (mismo patrón que las demás apps),
con autodespliegue vía **GitHub Actions** (push a `master` → SSH al servidor → `deploy.sh`).

- Adaptador de Astro: **@astrojs/node** (modo *standalone*) → servidor Node que escucha en `:4321`.
- `Dockerfile`, `docker-compose.yml` (se une a la red externa `escalat-caddy_shared-network`),
  `deploy.sh` y `.github/workflows/deploy.yml`.
- Secretos: `.env` en el servidor (con `ANTHROPIC_API_KEY`), nunca en git.

Guía paso a paso en **[DEPLOY.md](DEPLOY.md)**.

## Pendiente de completar

- Poner el número real de WhatsApp en `src/config.ts` (`WHATSAPP_NUMBER`).
- Rellenar los datos fiscales `[entre corchetes]` en `aviso-legal.astro` y `privacidad.astro`.
- Diseñar el logotipo/isotipo definitivo (el actual es provisional).
