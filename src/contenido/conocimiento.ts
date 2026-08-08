/**
 * Lo que el asistente sabe de Escalat.
 *
 * Se compone a partir de `i18n/ui.ts`, que ya tiene escritos los servicios, el método,
 * el caso real y los valores. Derivarlo en vez de copiarlo evita lo de siempre: que
 * alguien cambie un servicio en la web y el bot siga contando el anterior durante meses.
 *
 * Hay dos piezas, y la separación no es cosmética:
 *
 *   publico(lang) → lo que el asistente PUEDE contar. Se publica en /conocimiento.txt
 *                   para que el canal de voz cuente exactamente lo mismo que la web.
 *   guia()        → cómo debe comportarse. Nunca se publica: dice cómo cualificar y
 *                   cuándo emitir cada marcador.
 *
 * `guia()` viaja del servidor a n8n y no pasa por el navegador en ningún momento:
 * /api/chat solo devuelve al cliente {reply, lead, form}.
 */

import { ui, type Lang } from "../i18n/ui";

/**
 * Lo poco que no está en la web y hace falta para conversar bien.
 *
 * ⚠️ Esto es lo único de este archivo escrito a mano: repásalo. Las respuestas de
 * precio y plazo están deliberadamente sin cifras (no se inventan nunca).
 *
 * Ojo a la diferencia entre `matices` y `limites`, que no es de matiz:
 *   limites → el asistente lo descarta. Cierra la puerta.
 *   matices → sí se hace, pero con condiciones que él no puede evaluar. Ahí no puede
 *             prometer ni descartar: pregunta lo que falta y lo confirma una persona.
 * Meter algo en la lista equivocada tiene consecuencias: en `limites` pierdes trabajos
 * que sí querías, y en `matices` prometes cosas que a lo mejor no puedes cumplir.
 */
const EXTRA = {
  es: {
    faq: [
      ["¿Cuánto cuesta?",
       "Depende de lo que haga falta montar: no hay tarifa de catálogo. Se estudia el " +
       "caso y se hace una propuesta cerrada, sin sorpresas."],
      ["¿Cuánto se tarda en tenerlo funcionando?",
       "Depende del alcance. Se empieza por lo que más aprieta y se va sumando."],
      ["¿Tengo que cambiar las herramientas que ya uso?",
       "No. Lo normal es conectarnos a lo que ya tienes (tu calendario, tu WhatsApp, " +
       "tus hojas de cálculo) en vez de obligarte a mudarte a otro sitio."],
      ["¿Necesito saber de informática?",
       "No. Lo montamos y lo dejamos funcionando. Tú ves los resultados."],
      ["¿Y si luego quiero cambiar algo?",
       "Se ajusta. Seguimos contigo después de la puesta en marcha; no es entregar y " +
       "desaparecer."],
      ["¿Esto sustituye a una persona de mi equipo?",
       "La idea no es sustituir a nadie, es quitar de en medio lo repetitivo para que " +
       "el tiempo de las personas vaya a lo que de verdad aporta."],
      ["¿Mis datos y los de mis clientes están seguros?",
       "Sí. Se monta sobre infraestructura propia y solo se conecta a lo que haga falta " +
       "para que funcione."],
    ] as Array<[string, string]>,
    limites: [
      "No vendemos ni revendemos licencias de software de terceros.",
      "No hacemos campañas de marketing, publicidad ni gestión de redes sociales.",
      "No somos gestoría: no llevamos contabilidad, nóminas ni impuestos.",
    ],
    matices: [
      ["Mantenimiento de equipos, redes y soporte informático",
       "Se hace, pero depende de dónde esté el negocio: hay parte que es presencial. " +
       "Se mira caso por caso."],
      ["Páginas web",
       "Sí se hacen. Lo natural en Escalat es que la web lleve automatización detrás " +
       "(que recoja clientes, agende o responda sola), pero una web sin más también se " +
       "puede plantear."],
    ] as Array<[string, string]>,
  },
  en: {
    faq: [
      ["How much does it cost?",
       "It depends on what needs building: there's no price list. We study the case and " +
       "make a fixed proposal, no surprises."],
      ["How long until it's running?",
       "It depends on the scope. We start with whatever hurts most and add from there."],
      ["Do I have to change the tools I already use?",
       "No. We normally connect to what you already have (your calendar, your WhatsApp, " +
       "your spreadsheets) rather than making you move somewhere else."],
      ["Do I need to be technical?",
       "No. We build it and leave it running. You see the results."],
      ["What if I want to change something later?",
       "We adjust it. We stay with you after launch; it's not deliver-and-disappear."],
      ["Does this replace someone on my team?",
       "The point isn't to replace anyone, it's to take the repetitive work out of the " +
       "way so people's time goes to what actually matters."],
      ["Is my data and my clients' data safe?",
       "Yes. It runs on our own infrastructure and only connects to what it needs to " +
       "work."],
    ] as Array<[string, string]>,
    limites: [
      "We don't sell or resell third-party software licences.",
      "We don't run marketing campaigns, advertising or social media management.",
      "We're not an accountancy firm: no bookkeeping, payroll or tax filing.",
    ],
    matices: [
      ["Hardware maintenance, networks and IT support",
       "We do this, but it depends on where the business is: part of it is on site. " +
       "It's looked at case by case."],
      ["Websites",
       "We do build them. At Escalat a website normally comes with automation behind it " +
       "(capturing clients, booking, answering on its own), but a plain website is also " +
       "on the table."],
    ] as Array<[string, string]>,
  },
} as const;

const TITULOS = {
  es: {
    frase: "EN UNA FRASE", quienes: "A QUIÉN AYUDAMOS", problema: "EL PROBLEMA QUE RESOLVEMOS",
    senales: "Señales de que alguien nos necesita", servicios: "SERVICIOS",
    metodo: "CÓMO TRABAJAMOS", prueba: "UN TRABAJO REAL", valores: "CÓMO SOMOS",
    faq: "PREGUNTAS FRECUENTES", matices: "DEPENDE DEL CASO", limites: "LO QUE NO HACEMOS",
  },
  en: {
    frase: "IN ONE SENTENCE", quienes: "WHO WE HELP", problema: "THE PROBLEM WE SOLVE",
    senales: "Signs someone needs us", servicios: "SERVICES",
    metodo: "HOW WE WORK", prueba: "REAL WORK", valores: "WHO WE ARE",
    faq: "FREQUENTLY ASKED", matices: "DEPENDS ON THE CASE", limites: "WHAT WE DON'T DO",
  },
} as const;

/** Se compone una vez por idioma: son constantes, no cambia entre peticiones. */
const cache = new Map<Lang, string>();

/**
 * El documento que el asistente puede contar. Texto plano a propósito: lo consumen
 * un modelo de lenguaje y un agente de voz, no un navegador.
 */
export function publico(lang: Lang = "es"): string {
  const guardado = cache.get(lang);
  if (guardado) return guardado;

  const t = ui[lang];
  const x = EXTRA[lang];
  const h = TITULOS[lang];
  const b: string[] = [];

  b.push("# ESCALAT");
  b.push(`\n## ${h.frase}\n${t.footer.tagline}`);
  b.push(`\n## ${h.quienes}\n${t.sobre.intro}`);

  b.push(`\n## ${h.problema}\n${t.problema.intro}`);
  b.push(`\n${h.senales}:`);
  for (const p of t.problema.pains) b.push(`- ${p}`);

  b.push(`\n## ${h.servicios}`);
  for (const s of t.servicios.items) b.push(`\n### ${s.title}\n${s.desc}`);

  b.push(`\n## ${h.metodo}`);
  t.como.steps.forEach((s, i) => b.push(`${i + 1}. ${s.title}: ${s.desc}`));

  b.push(`\n## ${h.prueba}\n${t.caso.title}. ${t.caso.desc}`);
  for (const p of t.caso.points) b.push(`- ${p}`);

  b.push(`\n## ${h.valores}`);
  for (const v of t.sobre.valores) b.push(`- ${v.title}: ${v.desc}`);

  b.push(`\n## ${h.faq}`);
  for (const [q, a] of x.faq) b.push(`\nP: ${q}\nR: ${a}`);

  b.push(`\n## ${h.matices}`);
  for (const [tema, detalle] of x.matices) b.push(`\n### ${tema}\n${detalle}`);

  b.push(`\n## ${h.limites}`);
  for (const l of x.limites) b.push(`- ${l}`);

  const texto = b.join("\n");
  cache.set(lang, texto);
  return texto;
}

/**
 * Las reglas de conversación. Uso interno: no se publica jamás.
 *
 * Está en castellano aunque el visitante escriba en otro idioma. Son instrucciones
 * para el modelo, no texto que vaya a leer nadie, y la regla del idioma es explícita.
 *
 * Vive aquí y no en el System Message de n8n a propósito: así el comportamiento del
 * asistente se versiona, se revisa en un diff y se despliega con la web, en vez de
 * depender de que alguien recuerde qué tocó en un cuadro de texto del panel.
 */
export function guia(): string {
  return `# CÓMO CONVERSAS

Eres el asistente de Escalat. Tu trabajo NO es conseguir una cita. Es entender el
negocio de quien te escribe y decirle con honestidad si podemos ayudarle y cómo.

## Idioma
Responde SIEMPRE en el idioma en que te escriban. Si te escriben en inglés, en inglés.

## Tono
Cercano y claro, sin tecnicismos y sin lenguaje de vendedor. Frases cortas. Nada de
"potenciar sinergias" ni "soluciones 360". Habla como habla un autónomo.
Respuestas breves: dos o tres frases y una pregunta. Esto es un chat, no un folleto.

## El orden importa
1. ENTENDER. Pregunta por su negocio y por qué le come el tiempo. Una pregunta cada
   vez. No pidas ningún dato personal todavía. No propongas nada todavía.
2. EXPLICAR. Cuando sepas a qué se dedica y qué le duele, dile QUÉ harías en SU caso
   concreto, apoyándote en los servicios de arriba. Nada de listas genéricas: si tiene
   una tienda, habla de su tienda. Si viene a cuento, usa el trabajo real como prueba.
3. ENTREGAR. Solo cuando ya le has aportado algo, ofrécele mandarle por escrito un
   resumen de lo que montarías en su caso. Ahí, y solo ahí, pides el contacto.
4. OFRECER. Y solo si de verdad encaja, plantea un siguiente paso.

No saltes pasos. Si alguien llega y dice "quiero una cita", ahí sí puedes ir directo:
lo está pidiendo él.

## Lo que NUNCA haces
- Proponer una cita o una llamada antes del paso 3. Es lo que más molesta.
- Inventar precios, plazos, descuentos, número de clientes o casos de éxito.
  Si no lo sabes, dilo y ofrece que lo mire una persona.
- Insistir. Si alguien dice que no o que se lo piensa, acéptalo a la primera y
  déjale la puerta abierta. "Aquí sigo si te surge algo" y punto.
- Prometer nada que esté en la lista de LO QUE NO HACEMOS.
- Entrar en detalle legal, contractual o de protección de datos. Ahí di que lo ve
  mejor una persona y ofrece el paso 3.

## Ni sí ni no: lo que depende
Hay cosas en DEPENDE DEL CASO que no son un no, pero tampoco un sí. Con esas no
cierres en ninguna de las dos direcciones: haz la pregunta que falta y di con
naturalidad que eso lo confirma una persona. Es mejor un "lo miramos" honesto que un
sí que luego haya que retirar.

En concreto, si preguntan por mantenimiento o soporte informático, hay parte
presencial: pregunta en qué localidad está el negocio y no te comprometas con la
respuesta. Sea cual sea la localidad, quien confirma es una persona.

## Decir que no está bien
Si lo que necesita no es lo nuestro, díselo con claridad y, si puedes, oriéntale hacia
dónde mirar. Un valor de Escalat es preferir que confíen a vender de más. Una
conversación que acaba en "esto no es para ti" es un buen resultado, no un fracaso.

## Marcadores
Cuando quieras que la web muestre algo, escribe el marcador SOLO, en su propia línea,
al final del mensaje. El visitante nunca los ve. No los menciones ni los expliques.

FORM::contacto  Pide nombre y email con un formulario. Úsalo en el paso 3, cuando
                tengas algo concreto que mandarle. No lo uses para "tenerle fichado".
FORM::llamada   Pide teléfono y cuándo le viene bien, para llamarle. Úsalo si prefiere
                hablar antes que escribir, o si su caso es enrevesado para un chat.
FORM::cita      Muestra el calendario para reservar 30 minutos. Úsalo SOLO si pide él
                un encuentro, o si ya has ofrecido y ha dicho que sí.

Un solo marcador por mensaje. Nunca pidas por escrito datos que ya pide el formulario:
saca el formulario y ya está.

Cuando tengas nombre, necesidad y una forma de contacto, cierra el mensaje con:
LEAD::{"nombre":"...","necesidad":"...","contacto":"..."}
`;
}
