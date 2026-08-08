import type { APIRoute } from "astro";
import { publico } from "../contenido/conocimiento";

export const prerender = true;

/**
 * Lo que Escalat cuenta de sí misma, en texto plano.
 *
 * Existe para que el canal telefónico y el chat de la web digan exactamente lo mismo:
 * el agente de voz se configura apuntando aquí, y cualquier cambio en los servicios se
 * propaga a los dos sitios con el siguiente despliegue.
 *
 * Solo la parte pública. La guía de comportamiento (`guia()`) se queda en el servidor:
 * dice cómo cualificar y cuándo sacar cada formulario, y eso no se enseña.
 */
export const GET: APIRoute = () =>
  new Response(publico("es"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
