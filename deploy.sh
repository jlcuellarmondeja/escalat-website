#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Despliegue de Escalat (web) en Linux
# =============================================================================
set -euo pipefail

PHASE="init"

on_error() {
  local rc=$?
  echo "❌ ERROR (rc=$rc, fase=$PHASE)"
  case "$PHASE" in
    init|git_update|validate)
      echo ">>> Fallo antes del deploy. Contenedores NO tocados."
      exit "$rc"
      ;;
    up|health)
      echo ">>> Fallo durante deploy — Iniciando rollback..."
      if [[ -f "LAST_WORKING_TAG" ]]; then
        LAST_TAG=$(cat LAST_WORKING_TAG)
        git checkout "$LAST_TAG"
        docker compose down || true
        docker compose up -d
      fi
      exit "$rc"
      ;;
  esac
}

trap 'on_error' ERR

echo "=================================================="
echo " Escalat — Despliegue"
echo "=================================================="

# ── Auto-actualización del script ─────────────────────────────────────────────
if [[ "${DEPLOY_RELOADED:-}" != "1" ]]; then
    PHASE="git_update"
    echo ">>> Actualizando código desde Git..."

    git reset --hard HEAD
    OLD_SHA=$(sha256sum "$0" | awk '{print $1}')
    git fetch origin master
    git reset --hard origin/master
    NEW_SHA=$(sha256sum "$0" | awk '{print $1}')

    if [[ "$OLD_SHA" != "$NEW_SHA" ]]; then
        echo ">>> deploy.sh actualizado. Reejecutando..."
        DEPLOY_RELOADED=1 exec bash "$0" "$@"
    fi
fi

PHASE="validate"

command -v docker >/dev/null 2>&1 || { echo "ERROR: Docker no instalado"; exit 1; }

if [ ! -f ".env" ]; then
  echo "ERROR: No se encontró .env (crea uno con N8N_CHAT_WEBHOOK_URL y sus credenciales)"
  exit 1
fi

echo ">>> Construyendo y levantando servicios..."

PHASE="up"
# Sin 'compose down' previo: el build corre con el contenedor viejo aún sirviendo,
# y compose solo hace el swap al final (~segundos de corte en vez de todo el build).
docker compose up -d --build

PHASE="health"
echo ">>> Esperando a que la aplicación esté lista..."
sleep 10

PHASE="done"

echo ""
echo ">>> Estado final:"
docker compose ps

echo ""
echo "=================================================="
echo " ✅ Despliegue exitoso"
echo " Escalat → https://escalat.es"
echo "=================================================="

CURRENT_TAG=$(git describe --tags --exact-match 2>/dev/null || git rev-parse --short HEAD)
echo "$CURRENT_TAG" > LAST_WORKING_TAG

docker system prune -f
echo "✅ Limpieza completada"
