# Escalar — web de presentación

Web-escaparate de **Escalar**, empresa de soluciones informáticas con IA para pymes y autónomos.
Sitio estático hecho con [Astro](https://astro.build), con dos funciones *serverless* para el
chatbot y el formulario de "solicita que te llamemos".

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
| `ANTHROPIC_API_KEY` | Clave de la API de Claude, usada **solo en el servidor** por el chatbot | Sí (para el chat) |
| `CHAT_MODEL` | Modelo del chatbot. Por defecto `claude-haiku-4-5` | No |
| `TELEGRAM_BOT_TOKEN` | Bot de Telegram donde llegan los leads (el mismo de CitasMonitor) | Sí (para avisos) |
| `TELEGRAM_CHAT_ID` | Chat/grupo de Telegram donde recibir los leads | Sí (para avisos) |

> La clave de API nunca se expone en el navegador: vive solo en las funciones `/api/*`.
> Sin `ANTHROPIC_API_KEY`, el chat responde con un mensaje de respaldo (email) sin romperse.

## Estructura

```
src/
├─ styles/tokens.css      # paleta Grafito + Oro, tipografía y estilos comunes
├─ layouts/Base.astro     # <head>/SEO, header, footer, chat, scroll-reveal
├─ components/            # Hero, Problema, Servicios, ComoFunciona, Caso, SobreEscalar,
│                         # Contacto, ChatWidget, Header, Footer, Logo, Icon
├─ pages/
│  ├─ index.astro         # portada (one-page)
│  ├─ aviso-legal.astro   # RGPD — completar datos entre [corchetes]
│  ├─ privacidad.astro    # RGPD — completar datos entre [corchetes]
│  └─ api/
│     ├─ chat.ts          # chatbot con IA (Claude) + aviso de lead a Telegram
│     └─ callback.ts      # "solicita que te llamemos" → aviso a Telegram
└─ lib/                   # telegram.ts, env.ts
```

## Comandos

| Comando | Acción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en `localhost:4321` |
| `npm run build` | Compila el sitio a `./dist/` |
| `npm run preview` | Previsualiza la build |

## Despliegue

Configurado con el adaptador **@astrojs/netlify**. Para publicar en Netlify:

1. Sube el repositorio a GitHub y conéctalo en Netlify (o usa `netlify deploy`).
2. En Netlify → *Site settings → Environment variables*, añade `ANTHROPIC_API_KEY`,
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (y opcionalmente `CHAT_MODEL`).
3. Conecta tu dominio (p. ej. `escalar.es`).

## Pendiente de completar

- Rellenar los datos fiscales `[entre corchetes]` en `aviso-legal.astro` y `privacidad.astro`.
- Poner el número real de WhatsApp en `src/components/Contacto.astro`.
- Diseñar el logotipo/isotipo definitivo (el actual es provisional).
