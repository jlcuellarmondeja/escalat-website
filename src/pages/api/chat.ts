import type { APIRoute } from "astro";
import Anthropic from "@anthropic-ai/sdk";
import { readEnv } from "../../lib/env";
import { clientIp, consume } from "../../lib/rate-limit";
import { n8nAuthHeaders } from "../../lib/n8n";

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

const SYSTEM_PROMPT = `Eres el asistente virtual de Escalat, una pequeña empresa de soluciones
informáticas con inteligencia artificial para pymes y autónomos. Escalat automatiza la atención al
cliente (chatbots y operadoras), la agenda y las citas, la gestión de clientes y proveedores, y
cualquier tarea repetitiva, con el objetivo de que una sola persona pueda gestionar todo su negocio.

Tu tono es cercano, profesional y honesto, con frases claras y breves. Responde SIEMPRE en el mismo
idioma en que te escriba el visitante (si te escribe en inglés, responde en inglés; si en español,
en español). No inventes precios ni plazos concretos: si te preguntan, di que se estudian según el
caso y ofrece preparar una propuesta. No prometas cosas que no puedas saber.

Tu objetivo es ayudar al visitante y, cuando encaje de forma natural (sin agobiar), reunir sus datos
para pasar la conversación a WhatsApp: su nombre, qué necesita y una forma de contacto (email o
teléfono). Pide los datos de uno en uno, con naturalidad.

Cuando ya tengas al menos el nombre, la necesidad y un contacto (email o teléfono), incluye al FINAL
de tu mensaje una línea con este formato exacto, en una línea aparte:
LEAD::{"nombre":"...","necesidad":"...","contacto":"..."}
Esa línea es solo para uso interno. En el resto de tu mensaje, invita al visitante a continuar por
WhatsApp para terminar de concretar (aparecerá un botón). No menciones nunca la línea LEAD ni el
formato JSON al visitante.`;

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

  let body: { messages?: InMsg[]; sessionId?: string };
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

  // Si hay webhook de n8n configurado, el cerebro del chat es el workflow de n8n.
  const n8nUrl = readEnv("N8N_CHAT_WEBHOOK_URL");
  if (n8nUrl) {
    return askN8n(n8nUrl, {
      sessionId: sanitizeSessionId(body.sessionId),
      chatInput: messages[messages.length - 1].content,
    });
  }

  return askClaude(messages);
};

/**
 * Llama al nodo "Chat Trigger" de n8n desde el servidor (así el visitante nunca ve
 * la URL del webhook y no hacen falta permisos CORS en n8n).
 */
async function askN8n(
  url: string,
  payload: { sessionId: string; chatInput: string }
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
    return json({ reply, lead, form });
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

async function askClaude(messages: { role: "user" | "assistant"; content: string }[]): Promise<Response> {
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
      system: SYSTEM_PROMPT,
      messages,
    });

    const raw = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const { reply, lead, form } = extractLead(raw);
    return json({ reply, lead, form });
  } catch (err) {
    console.error("[chat] Error llamando a Claude:", err);
    return json({ error: "chat_error" }, 502);
  }
}

/** Formularios que la web sabe pintar. El agente solo puede pedir uno de estos. */
const FORMULARIOS = new Set(["contacto", "cita"]);

/**
 * Separa del texto visible las señales que el agente manda a la web:
 *
 *   LEAD::{"nombre":...}  → ya tenemos los datos, muestra el botón de WhatsApp
 *   FORM::contacto        → pide los datos con un formulario en vez de a preguntas
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
