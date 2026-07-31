import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env";
import { clientIp, consume } from "../../lib/rate-limit";
import { postN8n } from "../../lib/n8n";
import { AGENDA, huecosLibres, ventanaConsulta, type Intervalo } from "../../lib/agenda";

export const prerender = false;

/**
 * Devuelve los huecos libres para una entrevista.
 *
 * n8n solo contesta qué hay ocupado en el calendario; el cálculo de qué queda libre
 * se hace aquí, con las reglas de `lib/agenda.ts`. El modelo de IA no participa en
 * ningún momento: una hora inventada es una persona plantada en la puerta.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientIp(request, clientAddress);
  const veredicto = consume([
    { key: `slots:${ip}`, rule: { limit: 30, windowMs: 10 * 60 * 1000 } },
    { key: "slots:global", rule: { limit: 400, windowMs: 10 * 60 * 1000 } },
  ]);
  if (!veredicto.ok) {
    return json({ error: "rate_limited" }, 429, { "Retry-After": String(veredicto.retryAfter) });
  }

  const url = readEnv("N8N_BUSY_WEBHOOK_URL");
  if (!url) {
    console.error("[slots] Falta N8N_BUSY_WEBHOOK_URL.");
    return json({ error: "agenda_unavailable" }, 503);
  }

  const ahora = new Date();
  const ventana = ventanaConsulta(ahora);

  try {
    const ocupado = await pedirOcupado(url, ventana);
    const libres = huecosLibres(ocupado, ahora);
    return json({ slots: libres, zona: AGENDA.zona, duracionMin: AGENDA.duracionMin });
  } catch (err) {
    console.error("[slots] Error consultando la agenda:", err);
    return json({ error: "agenda_error" }, 502);
  }
};

/**
 * Pregunta a n8n qué hay ocupado y normaliza la respuesta.
 *
 * Se acepta tanto `{busy:[{start,end}]}` como el formato crudo de Google Calendar
 * (`{items:[{start:{dateTime}}]}`), para no atarse a cómo salga montado el workflow.
 */
export async function pedirOcupado(url: string, ventana: Intervalo): Promise<Intervalo[]> {
  const lista = listaDeEventos(await postN8n(url, { action: "busy", ...ventana }));

  const ocupado: Intervalo[] = [];
  for (const item of lista) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, any>;
    const start = o.start?.dateTime ?? o.start?.date ?? o.start;
    const end = o.end?.dateTime ?? o.end?.date ?? o.end;
    if (typeof start === "string" && typeof end === "string") {
      const ini = Date.parse(start);
      const fin = Date.parse(end);
      if (Number.isFinite(ini) && Number.isFinite(fin) && fin > ini) {
        ocupado.push({ start: new Date(ini).toISOString(), end: new Date(fin).toISOString() });
      }
    }
  }
  return ocupado;
}

/**
 * Encuentra la lista de eventos venga como venga.
 *
 * Según se monte el workflow, n8n puede devolver el array de citas directamente, o
 * un único objeto con la lista dentro (`{busy:[…]}`), o ese objeto envuelto en un
 * array de un elemento. Se acepta todo para no obligar a montarlo de una forma exacta.
 */
function listaDeEventos(data: unknown): unknown[] {
  if (!data) return [];

  if (Array.isArray(data)) {
    // ¿Es un array que solo envuelve un objeto contenedor, en vez de las citas?
    if (data.length === 1 && data[0] && typeof data[0] === "object" && !("start" in (data[0] as object))) {
      const dentro = listaDeEventos(data[0]);
      if (dentro.length) return dentro;
    }
    return data;
  }

  if (typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  for (const clave of ["busy", "items", "events", "data"]) {
    if (Array.isArray(obj[clave])) return obj[clave] as unknown[];
  }
  return [];
}

export function json(bodyObj: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(bodyObj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
}
