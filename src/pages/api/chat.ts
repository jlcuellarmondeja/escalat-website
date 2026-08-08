import type { APIRoute } from "astro";
import Anthropic from "@anthropic-ai/sdk";
import { readEnv } from "../../lib/env";
import { clientIp, consume } from "../../lib/rate-limit";
import { n8nAuthHeaders } from "../../lib/n8n";
import { publico, guia } from "../../contenido/conocimiento";
import { getLang, type Lang } from "../../i18n/ui";

export const prerender = false;

const MODEL = readEnv("CHAT_MODEL") || "claude-haiku-4-5";

/** Ventana de control del abuso. Cada respuesta cuesta tokens, así que se mide. */
const WINDOW_MS = num("CHAT_RATE_WINDOW_MS", 10 * 60 * 1000);
/** Por visitante: generoso para una conversación normal, corto para un script. */
const LIMIT_IP = num("CHAT_RATE_LIMIT_IP", 20);
/** Techo de toda la web: red de seguridad si el abuso viene repartido entre muchas IP. */
const LIMIT_GLOBAL = num("CHAT_RATE_LIMIT_GLOBAL", 300);
/** Tamaño máximo del cuerpo aceptado, para no tragar cargas absurdas. */
const MAX_BODY_BYTES = num("CHAT_MAX_BODY_BYTES", 64 * 1024);

function num(name: string, fallback: number): number {
  const value = Number(readEnv(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

interface InMsg { role: string; content: string }

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientIp(request, clientAddress);
  const veredicto = consume([
    { key: `chat:${ip}`, rule: { limit: LIMIT_IP, windowMs: WINDOW_MS } },
    { key: "chat:global", rule: { limit: LIMIT_GLOBAL, windowMs: WINDOW_MS } },
  ]);
  if (!veredicto.ok) {
    return json({ error: "rate_limited" }, 429, {
      "Retry-After": String(veredicto.retryAfter),
    });
  }

  // Cortamos por tamaño antes de leer el cuerpo entero en memoria.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return json({ error: "too_large" }, 413);
  }

  let body: { messages?: InMsg[]; sessionId?: string; lang?: string };
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const history = Array.isArray(body.messages) ? body.messages : [];
  const messages = history
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 2000) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return json({ error: "bad_request" }, 400);
  }

  const lang = getLang(body.lang);

  // Si hay webhook de n8n configurado, el cerebro del chat es el workflow de n8n.
  const n8nUrl = readEnv("N8N_CHAT_WEBHOOK_URL");
  if (n8nUrl) {
    return askN8n(n8nUrl, {
      sessionId: sanitizeSessionId(body.sessionId),
      chatInput: messages[messages.length - 1].content,
      // Lo que el asistente sabe y cómo debe comportarse, desde el repo. El System
      // Message de n8n solo los referencia, así que el comportamiento se cambia aquí
      // y se despliega con la web, no a mano en el panel.
      conocimiento: publico(lang),
      guia: guia(),
    });
  }

  return askClaude(messages, lang);
};

/**
 * Llama al nodo "Chat Trigger" de n8n desde el servidor (así el visitante nunca ve
 * la URL del webhook y no hacen falta permisos CORS en n8n).
 */
async function askN8n(
  url: string,
  payload: { sessionId: string; chatInput: string; conocimiento: string; guia: string }
): Promise<Response> {
  const timeout = Number(readEnv("N8N_CHAT_TIMEOUT_MS")) || 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...n8nAuthHeaders() },
      body: JSON.stringify({ action: "sendMessage", ...payload }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[chat] n8n respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return json({ error: "chat_error" }, 502);
    }

    const raw = extractN8nText(await res.text());
    if (!raw) {
      console.error("[chat] n8n respondió sin texto reconocible.");
      return json({ error: "chat_error" }, 502);
    }

    const { reply, lead, form } = extractLead(raw);
    return json({ reply, lead, form: formDisponible(form) });
  } catch (err) {
    console.error("[chat] Error llamando a n8n:", err);
    return json({ error: "chat_error" }, 502);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * n8n devuelve el JSON del último nodo del workflow. Según cómo esté montado puede
 * llegar como {output}, {text}, {message}, {reply}, un array de esos objetos, o texto plano.
 */
function extractN8nText(bodyText: string): string {
  const trimmed = bodyText.trim();
  if (!trimmed) return "";

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return trimmed; // el workflow respondió texto plano
  }

  const first = Array.isArray(data) ? data[0] : data;
  if (typeof first === "string") return first.trim();
  if (!first || typeof first !== "object") return "";

  const obj = first as Record<string, unknown>;
  const nested = obj.json && typeof obj.json === "object" ? (obj.json as Record<string, unknown>) : obj;
  for (const key of ["output", "text", "message", "reply", "answer", "response"]) {
    const value = nested[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/** El sessionId identifica la conversación para la memoria del workflow. */
function sanitizeSessionId(value: unknown): string {
  if (typeof value === "string") {
    const clean = value.replace(/[^\w-]/g, "").slice(0, 64);
    if (clean.length >= 8) return clean;
  }
  return crypto.randomUUID();
}

/** Plan B cuando no hay n8n. Usa el mismo conocimiento y las mismas reglas. */
async function askClaude(
  messages: { role: "user" | "assistant"; content: string }[],
  lang: Lang
): Promise<Response> {
  const apiKey = readEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("[chat] Falta N8N_CHAT_WEBHOOK_URL y ANTHROPIC_API_KEY.");
    return json({ error: "chat_unavailable" }, 503);
  }

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: `${publico(lang)}\n\n${guia()}`,
      messages,
    });

    const raw = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const { reply, lead, form } = extractLead(raw);
    return json({ reply, lead, form: formDisponible(form) });
  } catch (err) {
    console.error("[chat] Error llamando a Claude:", err);
    return json({ error: "chat_error" }, 502);
  }
}

/** Formularios que la web sabe pintar. El agente solo puede pedir uno de estos. */
const FORMULARIOS = new Set(["contacto", "cita", "llamada"]);

/** Webhook que necesita cada formulario para no acabar en un error a la cara. */
const REQUISITOS: Record<string, string> = {
  llamada: "N8N_CALL_WEBHOOK_URL",
  cita: "N8N_BUSY_WEBHOOK_URL",
};

/**
 * ¿Está montado lo que hace falta para pintar este formulario?
 *
 * El agente conoce los tres formularios porque se los cuenta la guía, pero un webhook
 * puede no estar configurado todavía. Antes que ofrecer un formulario que reventará al
 * enviarlo, se ignora la petición: el visitante se queda con el texto del mensaje, que
 * es una respuesta perfectamente válida, y no con un error.
 */
function formDisponible(form: string | null): string | null {
  if (!form) return null;
  const variable = REQUISITOS[form];
  if (variable && !readEnv(variable)) {
    console.warn(`[chat] El agente pidió FORM::${form} pero falta ${variable}. Se ignora.`);
    return null;
  }
  return form;
}

/**
 * Separa del texto visible las señales que el agente manda a la web:
 *
 *   LEAD::{"nombre":...}  → ya tenemos los datos, muestra el botón de WhatsApp
 *   FORM::contacto        → pide los datos con un formulario en vez de a preguntas
 *   FORM::llamada         → pide teléfono y momento para devolverle la llamada
 *   FORM::cita            → muestra el calendario de entrevistas
 *
 * El visitante nunca ve estas líneas. El nombre del formulario se valida contra una
 * lista cerrada: los campos y sus validaciones los define la web, no el modelo.
 */
function extractLead(text: string): {
  reply: string;
  lead: Record<string, string> | null;
  form: string | null;
} {
  let reply = text;
  let form: string | null = null;

  // Deliberadamente tolerante: el modelo no siempre deja el marcador solo en su línea.
  // Lo acepta suelto, entre corchetes, entre comillas invertidas y en cualquier caja.
  const formMatch = reply.match(/[`[(]?\s*FORM\s*::\s*([\w-]+)\s*[`\])]?/i);
  if (formMatch) {
    const nombre = formMatch[1]!.toLowerCase();
    if (FORMULARIOS.has(nombre)) form = nombre;
    reply = (reply.slice(0, formMatch.index) + reply.slice(formMatch.index! + formMatch[0].length))
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const leadMatch = reply.match(/LEAD::\s*(\{.*\})\s*$/s);
  if (!leadMatch) return { reply: reply.trim(), lead: null, form };

  const visible = reply.slice(0, leadMatch.index).trim();
  try {
    return { reply: visible, lead: JSON.parse(leadMatch[1]!), form };
  } catch {
    return { reply: visible, lead: null, form };
  }
}

function json(bodyObj: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(bodyObj), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Respuestas de chat: ni cachés intermedias ni buscadores.
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}
