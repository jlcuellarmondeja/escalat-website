import type { APIRoute } from "astro";
import { notifyTelegram, escapeHtml } from "../../lib/telegram";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let data: Record<string, unknown>;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "Datos inválidos." }, 400);
  }

  const name = String(data.name ?? "").trim();
  const phone = String(data.phone ?? "").trim();
  const when = String(data.when ?? "").trim();
  const message = String(data.message ?? "").trim();
  const consent = Boolean(data.consent);

  if (!name || !phone) {
    return json({ ok: false, error: "Faltan nombre o teléfono." }, 422);
  }
  if (!consent) {
    return json({ ok: false, error: "Falta aceptar la privacidad." }, 422);
  }

  const text =
    `📞 <b>Nueva solicitud de llamada</b>\n\n` +
    `<b>Nombre:</b> ${escapeHtml(name)}\n` +
    `<b>Teléfono:</b> ${escapeHtml(phone)}\n` +
    `<b>Franja:</b> ${escapeHtml(when || "—")}\n` +
    (message ? `<b>Mensaje:</b> ${escapeHtml(message)}\n` : "") +
    `\n<i>Vía web de Escalar</i>`;

  const sent = await notifyTelegram(text);

  // No bloqueamos al usuario si Telegram falla: registramos y devolvemos ok.
  if (!sent) console.error("[callback] Lead recibido pero no se pudo avisar por Telegram:", { name, phone });

  return json({ ok: true });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
