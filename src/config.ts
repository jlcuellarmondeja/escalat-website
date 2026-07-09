/**
 * Configuración de contacto de Escalat.
 *
 * WHATSAPP_NUMBER: tu número en formato internacional, SOLO dígitos
 * (código de país + número, sin "+", sin espacios). Ejemplo España: 34612345678.
 * ⚠️ Cámbialo por tu número real de WhatsApp.
 */
export const WHATSAPP_NUMBER = "34666361395";

export const CONTACT_EMAIL = "contacto@escalat.es";

/** Construye un enlace "click-to-chat" de WhatsApp con un mensaje ya redactado. */
export function waLink(text: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
