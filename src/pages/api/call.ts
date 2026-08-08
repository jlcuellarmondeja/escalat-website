import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env";
import { clientIp, consume } from "../../lib/rate-limit";
import { postN8n } from "../../lib/n8n";
import { json } from "./slots";

export const prerender = false;

/** Momentos que ofrece el formulario. Cerrado: el resto se descarta. */
const CUANDOS = new Set(["manana", "tarde", "cualquiera"]);

/**
 * Solicitud de que le llamemos.
 *
 * El hero, el pie y la sección de contacto llevan tiempo prometiendo "solicita que te
 * llamemos", y hasta ahora eso abría WhatsApp para que la llamada la hiciera una
 * persona a mano. Esto recoge la petición de verdad.
 *
 * Se guarda con quién, cuándo lo pidió, desde qué IP y el texto exacto de
 * consentimiento que aceptó: una llamada comercial hay que poder justificarla, y el
 * día que la haga una IA en vez de una persona, más todavía. El mismo webhook servirá
 * entonces para lanzarla sin tocar la web.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientIp(request, clientAddress);
  const veredicto = consume([
    { key: `call:${ip}`, rule: { limit: 3, windowMs: 10 * 60 * 1000 } },
    { key: "call:global", rule: { limit: 40, windowMs: 10 * 60 * 1000 } },
  ]);
  if (!veredicto.ok) {
    return json({ error: "rate_limited" }, 429, { "Retry-After": String(veredicto.retryAfter) });
  }

  const url = readEnv("N8N_CALL_WEBHOOK_URL");
  if (!url) {
    console.error("[call] Falta N8N_CALL_WEBHOOK_URL.");
    return json({ error: "call_unavailable" }, 503);
  }

  let body: Record<string, unknown>;
  try {
    const texto = await request.text();
    if (texto.length > 8 * 1024) return json({ error: "too_large" }, 413);
    body = JSON.parse(texto);
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const nombre = String(body.nombre ?? "").trim().slice(0, 120);
  const telefono = String(body.telefono ?? "").trim().slice(0, 40);
  const cuandoBruto = String(body.cuando ?? "cualquiera");
  const cuando = CUANDOS.has(cuandoBruto) ? cuandoBruto : "cualquiera";
  const consentimiento = String(body.consentimiento ?? "").trim().slice(0, 400);
  const sessionId = String(body.sessionId ?? "").replace(/[^\w-]/g, "").slice(0, 64);

  // Se cuentan los dígitos y se ignora cómo los haya escrito: +34, espacios, guiones.
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length < 9 || digitos.length > 15) return json({ error: "bad_request" }, 400);
  if (!consentimiento) return json({ error: "bad_request" }, 400);

  try {
    await postN8n(url, {
      action: "call",
      nombre,
      telefono,
      cuando,
      // Prueba del consentimiento: qué aceptó, cuándo y desde dónde.
      consentimiento,
      solicitadoEn: new Date().toISOString(),
      ip,
      sessionId,
    });
    return json({ ok: true });
  } catch (err) {
    console.error("[call] Error registrando la solicitud:", err);
    return json({ error: "call_error" }, 502);
  }
};
