/**
 * Límite de peticiones en memoria, con ventana deslizante.
 *
 * Protege `/api/chat`: sin esto, cualquiera puede lanzar miles de mensajes contra
 * la web y cada uno dispara el workflow de n8n (y su coste en tokens de IA).
 *
 * Vive dentro del proceso Node, que es justo lo que necesita Escalat: un único
 * contenedor. Si algún día hay varias réplicas, habría que moverlo a Redis para
 * que el recuento sea compartido.
 */

export interface Rule {
  /** Peticiones permitidas dentro de la ventana. */
  limit: number;
  /** Tamaño de la ventana, en milisegundos. */
  windowMs: number;
}

export interface Verdict {
  ok: boolean;
  /** Segundos que conviene esperar antes de reintentar (0 si `ok`). */
  retryAfter: number;
}

/** Marcas de tiempo de cada clave (IP, "global", …). */
const hits = new Map<string, number[]>();

/** Techo de claves en memoria: evita que un ataque distribuido la haga crecer sin fin. */
const MAX_KEYS = 20_000;

/** Nada se guarda más de esto; sirve para limpiar claves olvidadas. */
const MAX_RETENTION_MS = 60 * 60 * 1000;

let lastPrune = 0;

/**
 * Comprueba todas las reglas y, solo si TODAS pasan, apunta la petición.
 *
 * Se hace en dos fases a propósito: si registrásemos sobre la marcha, una petición
 * bloqueada por el límite global gastaría además cupo de la IP, castigándola dos veces.
 */
export function consume(checks: Array<{ key: string; rule: Rule }>): Verdict {
  const now = Date.now();
  prune(now);

  const pending: Array<{ key: string; recent: number[] }> = [];

  for (const { key, rule } of checks) {
    const recent = (hits.get(key) ?? []).filter((t) => t > now - rule.windowMs);
    if (recent.length >= rule.limit) {
      hits.set(key, recent); // aprovechamos para dejar la lista ya recortada
      const freeAt = recent[0] + rule.windowMs;
      return { ok: false, retryAfter: Math.max(1, Math.ceil((freeAt - now) / 1000)) };
    }
    pending.push({ key, recent });
  }

  for (const { key, recent } of pending) {
    recent.push(now);
    hits.set(key, recent);
  }
  return { ok: true, retryAfter: 0 };
}

/** Limpieza perezosa: como mucho una vez por minuto, no en cada petición. */
function prune(now: number): void {
  if (now - lastPrune < 60_000) return;
  lastPrune = now;

  for (const [key, times] of hits) {
    const alive = times.filter((t) => t > now - MAX_RETENTION_MS);
    if (alive.length === 0) hits.delete(key);
    else hits.set(key, alive);
  }

  // Si aun así hay demasiadas claves, tiramos las menos recientes.
  if (hits.size > MAX_KEYS) {
    const porAntiguedad = [...hits.entries()].sort(
      (a, b) => (a[1][a[1].length - 1] ?? 0) - (b[1][b[1].length - 1] ?? 0)
    );
    for (const [key] of porAntiguedad.slice(0, hits.size - MAX_KEYS)) hits.delete(key);
  }
}

/**
 * IP real del visitante. Detrás de Cloudflare + Caddy, la IP que ve Node es la del
 * proxy, así que hay que mirar las cabeceras que añade Cloudflare.
 *
 * Estas cabeceras son falsificables por quien llegue al origen saltándose Cloudflare.
 * Para lo que nos ocupa (encarecer el abuso) es suficiente; el límite global de abajo
 * es el que cubre ese caso.
 */
export function clientIp(request: Request, fallback?: string | null): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();

  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();

  return fallback?.trim() || "desconocida";
}
