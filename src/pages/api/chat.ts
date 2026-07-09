import type { APIRoute } from "astro";
import Anthropic from "@anthropic-ai/sdk";
import { readEnv } from "../../lib/env";

export const prerender = false;

const MODEL = readEnv("CHAT_MODEL") || "claude-haiku-4-5";

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

export const POST: APIRoute = async ({ request }) => {
  const apiKey = readEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("[chat] Falta ANTHROPIC_API_KEY.");
    return json({ error: "chat_unavailable" }, 503);
  }

  let body: { messages?: InMsg[] };
  try {
    body = await request.json();
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

    const { reply, lead } = extractLead(raw);
    return json({ reply, lead });
  } catch (err) {
    console.error("[chat] Error llamando a Claude:", err);
    return json({ error: "chat_error" }, 502);
  }
};

/** Separa la línea LEAD::{...} del texto visible y la parsea si existe. */
function extractLead(text: string): { reply: string; lead: Record<string, string> | null } {
  const match = text.match(/LEAD::\s*(\{.*\})\s*$/s);
  if (!match) return { reply: text, lead: null };
  const reply = text.slice(0, match.index).trim();
  try {
    return { reply, lead: JSON.parse(match[1]) };
  } catch {
    return { reply, lead: null };
  }
}

function json(bodyObj: unknown, status = 200): Response {
  return new Response(JSON.stringify(bodyObj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
