/**
 * Llamadas a los webhooks de n8n desde el servidor.
 *
 * Siempre desde el servidor: así ni las URL ni las credenciales llegan al navegador,
 * y no hace falta abrir CORS en n8n.
 */

import { readEnv } from "./env";

/** Autenticación del webhook, según cómo esté configurado el nodo en n8n. */
export function n8nAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  const user = readEnv("N8N_CHAT_BASIC_USER");
  const pass = readEnv("N8N_CHAT_BASIC_PASSWORD");
  if (user && pass) {
    headers.Authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
  }

  const name = readEnv("N8N_CHAT_AUTH_HEADER");
  const value = readEnv("N8N_CHAT_AUTH_VALUE");
  if (name && value) headers[name] = value;

  return headers;
}

/**
 * POST a un webhook de n8n, con tiempo máximo de espera.
 *
 * Devuelve el JSON ya desenvuelto: n8n suele responder con el array de items del
 * último nodo, y casi siempre lo que interesa es el primero.
 */
export async function postN8n(url: string, payload: unknown): Promise<unknown> {
  const timeout = Number(readEnv("N8N_CHAT_TIMEOUT_MS")) || 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...n8nAuthHeaders() },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`n8n respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const texto = (await res.text()).trim();
    if (!texto) return null;

    const data = JSON.parse(texto);
    const primero = Array.isArray(data) ? data[0] : data;
    // n8n envuelve cada item en {json: {...}} según por dónde salga del workflow.
    if (primero && typeof primero === "object" && "json" in primero) {
      return (primero as { json: unknown }).json;
    }
    return primero;
  } finally {
    clearTimeout(timer);
  }
}
