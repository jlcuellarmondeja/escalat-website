# Desplegar Escalat (autoalojado, Docker + Caddy)

Mismo patrón que MagikFood: la web corre en un contenedor Docker, la sirve el **Caddy compartido**
del servidor, y **GitHub Actions** despliega solo en cada push a `master`.

Arquitectura: **Cloudflare (DNS/proxy) → servidor → Caddy → contenedor `escalat` (:4321)**.

## Requisitos
- Servidor con Docker y Docker Compose (el mismo de las otras apps).
- La red externa de Caddy ya existe: `escalat-caddy_shared-network`.
- Repo en GitHub (p. ej. `jlcuellarmondeja/escalat-website`).

## Paso 1 — Clonar el repo en el servidor
Clónalo en `~/escalat-website` (la ruta que usa el workflow):
```bash
cd ~
git clone https://github.com/jlcuellarmondeja/escalat-website.git
cd escalat-website
```

## Paso 2 — Variables de entorno (`.env`)
En `~/escalat-website/.env` (no se sube a git):
```bash
cp .env.example .env
nano .env
```
Rellena:
- `N8N_CHAT_WEBHOOK_URL` — webhook del *Chat Trigger* de n8n que atiende el chatbot.
- `N8N_CHAT_BASIC_USER` / `N8N_CHAT_BASIC_PASSWORD` — credenciales Basic Auth de ese webhook.
- `ANTHROPIC_API_KEY` — clave de la API de Claude. Solo si NO usas n8n.
- `CHAT_MODEL` — opcional (por defecto `claude-haiku-4-5`).

## Paso 3 — GitHub Secrets
En el repo → **Settings → Secrets and variables → Actions**, crea:

| Secret | Valor |
|--------|-------|
| `DEPLOY_HOST` | IP o dominio del servidor |
| `DEPLOY_USER` | usuario SSH |
| `SSH_PRIVATE_KEY` | contenido de la clave privada SSH con acceso al servidor |

(Son los mismos que ya usas en MagikFood; si la clave sirve para ese servidor, vale.)

## Paso 4 — Caddy (en el repo del Caddy compartido)
Añade este bloque a tu `Caddyfile` (repo `escalat-caddy`) y despliégalo como haces siempre:
```
escalat.es {
    reverse_proxy escalat:4321
}

# Opcional: redirige www al dominio raíz
www.escalat.es {
    redir https://escalat.es{uri} permanent
}
```
Caddy alcanza al contenedor por su nombre (`escalat`) porque ambos comparten la red
`escalat-caddy_shared-network`, y saca el certificado HTTPS automáticamente.

## Paso 5 — DNS en Cloudflare
Apunta el dominio a tu servidor (igual que las otras apps):
- Registro **A**: `escalat.es` → IP del servidor.
- Registro **A** o **CNAME**: `www` → el servidor / `escalat.es`.
- Deja el proxy de Cloudflare como lo tengas en el resto de apps.

## Paso 6 — Desplegar
Primer despliegue manual (o para probar) desde el servidor:
```bash
cd ~/escalat-website
chmod +x deploy.sh
./deploy.sh
```
A partir de ahí, **cada push a `master`** dispara el deploy automático (GitHub → Actions).

## Operaciones
```bash
# Logs en vivo
docker compose logs -f escalat

# Estado
docker compose ps

# Rollback rápido
git checkout HEAD~1 && docker compose up -d --build
```

## Notas
- La web es **sin estado** (no hay base de datos), así que no necesita volúmenes.
- El contenedor **no publica puertos** al exterior; solo Caddy le habla por la red interna.
- Cambia `master` por `main` en `deploy.sh` y en el workflow si prefieres esa rama.
