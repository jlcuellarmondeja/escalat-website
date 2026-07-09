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
| `ANTHROPIC_API_KEY` | Clave de la API de Claude, usada **solo en el servidor** por el chatbot | Sí (para el chat) |
| `CHAT_MODEL` | Modelo del chatbot. Por defecto `claude-haiku-4-5` | No |

> La clave de API nunca se expone en el navegador: vive solo en la función `/api/chat`.
> Sin `ANTHROPIC_API_KEY`, el chat responde con un mensaje de respaldo sin romperse.
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

Configurado con el adaptador **@astrojs/netlify**. Para publicar en Netlify:

1. Sube el repositorio a GitHub y conéctalo en Netlify (o usa `netlify deploy`).
2. En Netlify → *Site settings → Environment variables*, añade `ANTHROPIC_API_KEY`
   (y opcionalmente `CHAT_MODEL`).
3. Conecta tu dominio (p. ej. `escalat.es`).

## Pendiente de completar

- Poner el número real de WhatsApp en `src/config.ts` (`WHATSAPP_NUMBER`).
- Rellenar los datos fiscales `[entre corchetes]` en `aviso-legal.astro` y `privacidad.astro`.
- Diseñar el logotipo/isotipo definitivo (el actual es provisional).
