/**
 * Envía un mensaje al Telegram de Escalar.
 * Reutiliza el mismo patrón que CitasMonitor (Bot API sendMessage).
 * Requiere las variables de entorno TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID.
 */
import { readEnv } from "./env";

export async function notifyTelegram(text: string): Promise<boolean> {
  const token = readEnv("TELEGRAM_BOT_TOKEN");
  const chatId = readEnv("TELEGRAM_CHAT_ID");

  if (!token || !chatId) {
    console.warn("[telegram] Falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID; no se envía aviso.");
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error("[telegram] Error al enviar:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[telegram] Excepción al enviar:", err);
    return false;
  }
}

/** Escapa caracteres reservados de HTML para el parse_mode HTML de Telegram. */
export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
