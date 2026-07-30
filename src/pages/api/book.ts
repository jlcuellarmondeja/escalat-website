import type { APIRoute } from "astro";
import { readEnv } from "../../lib/env";
import { clientIp, consume } from "../../lib/rate-limit";
import { postN8n } from "../../lib/n8n";
import { siguelibre, ventanaConsulta } from "../../lib/agenda";
import { pedirOcupado, json } from "./slots";

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Reserva una entrevista.
 *
 * El paso importante es el de en medio: entre que al visitante se le pintaron los
 * huecos y pulsa confirmar pasan segundos o minutos, y en ese rato otra persona ha
 * podido coger el mismo. Por eso se vuelve a consultar el calendario justo antes de
 * crear el evento, en vez de fiarse de lo que traiga el navegador.
 *
 * Sigue habiendo una ventana de carrera entre la revalidación y la creación: Google
 * Calendar no ofrece reserva atómica. Es de milisegundos y para el volumen de una
 * pyme es asumible; si algún día hay solapes de verdad, tocaría un motor de reservas.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientIp(request, clientAddress);
  const veredicto = consume([
    { key: `book:${ip}`, rule: { limit: 5, windowMs: 10 * 60 * 1000 } },
    { key: "book:global", rule: { limit: 60, windowMs: 10 * 60 * 1000 } },
  ]);
  if (!veredicto.ok) {
    return json({ error: "rate_limited" }, 429, { "Retry-After": String(veredicto.retryAfter) });
  }

  const busyUrl = readEnv("N8N_BUSY_WEBHOOK_URL");
  const bookUrl = readEnv("N8N_BOOK_WEBHOOK_URL");
  if (!busyUrl || !bookUrl) {
    console.error("[book] Falta N8N_BUSY_WEBHOOK_URL o N8N_BOOK_WEBHOOK_URL.");
    return json({ error: "agenda_unavailable" }, 503);
  }

  let body: Record<string, unknown>;
  try {
    const texto = await request.text();
    if (texto.length > 8 * 1024) return json({ error: "too_large" }, 413);
    body = JSON.parse(texto);
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const start = typeof body.start === "string" ? body.start : "";
  const nombre = String(body.nombre ?? "").trim().slice(0, 120);
  const email = String(body.email ?? "").trim().slice(0, 160);
  const telefono = String(body.telefono ?? "").trim().slice(0, 40);
  const nota = String(body.nota ?? "").trim().slice(0, 500);

  if (!nombre || !EMAIL_RE.test(email) || !Number.isFinite(Date.parse(start))) {
    return json({ error: "bad_request" }, 400);
  }

  const ahora = new Date();

  try {
    // Revalidación: ¿sigue libre lo que eligió?
    const ocupado = await pedirOcupado(busyUrl, ventanaConsulta(ahora));
    if (!siguelibre(start, ocupado, ahora)) {
      return json({ error: "slot_taken" }, 409);
    }

    const creado = (await postN8n(bookUrl, {
      action: "book",
      start,
      nombre,
      email,
      telefono,
      nota,
    })) as Record<string, unknown> | null;

    // Si el workflow dice explícitamente que no, se respeta.
    if (creado && creado.ok === false) {
      return json({ error: "slot_taken" }, 409);
    }

    return json({ ok: true, start });
  } catch (err) {
    console.error("[book] Error reservando:", err);
    return json({ error: "book_error" }, 502);
  }
};
