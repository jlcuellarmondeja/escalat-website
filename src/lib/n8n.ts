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
 * Quita la capa `{json: …}` con la que n8n envuelve cada item, **conservando la
 * forma**: si vienen diez items, salen diez.
 *
 * Importa más de lo que parece. El nodo "Get Many Events" de Google Calendar emite
 * un item por cita, así que quedarse solo con el primero equivale a no ver el resto
 * de citas del día, y a ofrecer horas que ya están dadas.
 */
function desenvolver(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(desenvolver);
  if (data && typeof data === "object" && "json" in data) {
    return (data as { json: unknown }).json;
  }
  return data;
}

/**
 * POST a un webhook de n8n, con tiempo máximo de espera.
 *
 * Devuelve el JSON tal cual lo mandó el workflow, sin la envoltura de n8n.
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

    return desenvolver(JSON.parse(texto));
  } finally {
    clearTimeout(timer);
  }
}
