import type { APIRoute } from "astro";
import { publico } from "../../contenido/conocimiento";

export const prerender = true;

/** La misma base de conocimientos en inglés. Ver `/conocimiento.txt`. */
export const GET: APIRoute = () =>
  new Response(publico("en"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
