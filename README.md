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
