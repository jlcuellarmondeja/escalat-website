/**
 * Textos de la web en español (por defecto) e inglés (borrador).
 * Cada componente lee `useT(Astro.currentLocale)` para obtener el idioma activo.
 * El español vive en la raíz (/) y el inglés bajo /en/.
 */

export const languages = { es: "Español", en: "English" } as const;
export type Lang = keyof typeof languages;
export const defaultLang: Lang = "es";

/** Normaliza el locale de Astro a uno de nuestros idiomas. */
export function getLang(locale?: string): Lang {
  return locale === "en" ? "en" : "es";
}

/** Devuelve el diccionario del idioma activo. */
export function useT(locale?: string) {
  return ui[getLang(locale)];
}

/** Prefija una ruta con el idioma (el español no lleva prefijo). */
export function localePath(path: string, locale?: string): string {
  const lang = getLang(locale);
  if (lang === "es") return path;
  if (path === "/") return "/en/";
  return "/en" + path;
}

/** Rutas de las páginas legales por idioma (slugs traducidos). */
export const legalPaths = {
  es: { notice: "/aviso-legal", privacy: "/privacidad" },
  en: { notice: "/en/legal-notice", privacy: "/en/privacy" },
} as const;

export const ui = {
  es: {
    nav: { services: "Servicios", how: "Cómo funciona", about: "Sobre Escalat", cta: "Solicita una demo" },
    hero: {
      eyebrow: "Soluciones con inteligencia artificial para pymes y autónomos",
      titleLine1: "Menos gestión.",
      titleAccent: "Más negocio.",
      subtitle:
        "Automatizamos la atención al cliente, la agenda y las tareas que te roban el día. Tú te dedicas a tu negocio; de lo repetitivo nos encargamos nosotros.",
      ctaChat: "Habla con nuestro asistente",
      ctaCall: "Solicita que te llamemos",
      trust: ["Hecho a medida", "Puesta en marcha rápida", "Soporte cercano"],
    },
    problema: {
      eyebrow: "El problema",
      title: "Llevar un negocio tú solo agota.",
      intro:
        "Cuando eres tú quien atiende, factura, agenda y encima produce, el día no da de sí. No necesitas trabajar más horas: necesitas que la tecnología cargue con lo repetitivo.",
      pains: [
        "Llamadas y mensajes que no llegas a contestar a tiempo.",
        "Citas apuntadas en mil sitios y algún hueco que se pierde.",
        "Tareas repetitivas que se comen tus mejores horas.",
        "Clientes y proveedores en la cabeza, no en un sistema.",
      ],
      promiseStrong: "Ahí entra Escalat:",
      promiseRest: " te montamos el sistema para que eso deje de depender de ti.",
    },
    servicios: {
      eyebrow: "Servicios",
      title: "Lo que podemos quitarte de encima",
      intro:
        "Cada pieza funciona por separado o todas juntas. Empezamos por lo que más te aprieta hoy y vamos sumando a medida que tu negocio crece.",
      items: [
        { title: "Atención que nunca duerme", desc: "Un chatbot responde a cada cliente al instante, de día y de noche. Ninguna consulta se queda sin contestar." },
        { title: "Operadora que atiende por ti", desc: "Una operadora virtual recoge llamadas, resuelve dudas frecuentes y te pasa solo lo que de verdad importa." },
        { title: "Tu agenda, en piloto automático", desc: "Reservas, confirmaciones y recordatorios solos. Se acabaron los huecos vacíos y las citas olvidadas." },
        { title: "Todo tu negocio, en un sitio", desc: "Clientes, conversaciones y tareas ordenados y a mano. Tú decides; el sistema se acuerda por ti." },
        { title: "Proveedores bajo control", desc: "Pedidos, contactos y vencimientos en un único lugar, con avisos antes de que algo se te pase." },
        { title: "Automatizaciones a medida", desc: "¿Hay algo que repites cada semana a mano? Lo estudiamos y lo dejamos funcionando solo." },
      ],
    },
    como: {
      eyebrow: "Cómo funciona",
      title: "De agobio a piloto automático, en cuatro pasos",
      steps: [
        { title: "Diagnóstico", desc: "Hablamos de tu negocio y detectamos qué te roba más tiempo y dónde se te escapan clientes." },
        { title: "Diseñamos la solución", desc: "Te proponemos qué automatizar y cómo, con un plan claro, sin tecnicismos y a tu ritmo." },
        { title: "Lo ponemos en marcha", desc: "Montamos, conectamos y probamos todo. Tú solo tienes que ver cómo empieza a funcionar." },
        { title: "Tú gestionas menos", desc: "Recuperas horas y dejas de perder oportunidades. Seguimos contigo para mejorar y crecer." },
      ],
    },
    caso: {
      eyebrow: "Esto ya funciona",
      title: "Un vigilante que no pega ojo",
      desc: "Construimos una automatización que vigila una web las 24 horas y avisa al instante, por Telegram, en cuanto aparece una cita disponible. Nadie tiene que estar recargando la página: el sistema mira por ti y te avisa justo cuando importa.",
      points: [
        "Comprueba disponibilidad de forma continua, sin descanso.",
        "Notificación inmediata en el móvil cuando hay hueco.",
        "Estable, discreto y funcionando en segundo plano.",
      ],
      footPre: "Es un ejemplo pequeño con una idea grande detrás: ",
      footAccent: "que la tecnología trabaje mientras tú vives",
      footPost: ". Lo mismo hacemos con tu atención al cliente, tu agenda o tus tareas del día a día.",
      demo: { name: "Monitor de citas", status: "bot", alertTitle: "✅ ¡Cita disponible!", alertBody: "Se ha detectado un hueco libre. Entra a reservar cuanto antes.", time1: "09:41", recheck: "Comprobando de nuevo en 5 min…", time2: "09:46" },
    },
    sobre: {
      eyebrow: "Sobre Escalat",
      title: "Creemos que una sola persona puede con todo un negocio",
      intro:
        "Escalat nace de una idea sencilla: la tecnología debería estar de tu lado, no complicarte la vida. Diseñamos herramientas con inteligencia artificial que se encargan de lo repetitivo para que tú te dediques a lo que solo tú sabes hacer.",
      textPre: "Empezamos ayudando a pequeños negocios y autónomos, y crecemos contigo: hoy un chatbot o una agenda automática; mañana, todo tu negocio funcionando casi solo. Ese es el objetivo, y por eso nos llamamos ",
      textAccent: "Escalat",
      textPost: ".",
      valores: [
        { title: "Cercanía", desc: "Hablamos claro, sin tecnicismos. Tratas siempre con la persona que hace las cosas." },
        { title: "A medida", desc: "Nada de plantillas genéricas. Cada solución se ajusta a cómo funciona tu negocio." },
        { title: "Honestidad", desc: "Si algo no te hace falta, te lo decimos. Preferimos que confíes a venderte de más." },
      ],
    },
    contacto: {
      eyebrow: "Hablemos",
      title: "Cuéntanos qué te quita el sueño",
      intro:
        "La forma más rápida: habla con nuestro asistente aquí mismo. Te resuelve dudas y, si quieres, deja tus datos para que te preparemos una propuesta. ¿Prefieres el teléfono? Pide que te llamemos.",
      ctaChat: "Habla con el asistente",
      waDirect: "WhatsApp directo",
      formTitle: "Solicita que te llamemos",
      formSub: "Déjanos tus datos y te llamamos nosotros. Sin compromiso.",
      labelName: "Nombre",
      phName: "Tu nombre",
      labelPhone: "Teléfono",
      phPhone: "600 000 000",
      labelWhen: "¿Cuándo te viene mejor?",
      whenMorning: "Por la mañana",
      whenAfternoon: "Por la tarde",
      whenAny: "Me da igual",
      labelMsg: "¿Qué necesitas?",
      optional: "(opcional)",
      phMsg: "Cuéntanos brevemente tu caso",
      // Texto exacto que se guarda como prueba del consentimiento para llamar.
      consentPre: "Acepto que Escalat me llame a este número y he leído la ",
      consentLink: "política de privacidad",
      consentPost: ".",
      submit: "Que me llamen",
      sending: "Enviando…",
      statusOk: "Apuntado. Te llamamos al número que nos has dejado.",
      // Si la petición falla, no se pierde: se le ofrece WhatsApp como salida.
      statusErr: "No he podido enviarlo. Prueba por WhatsApp:",
      statusErrCta: "abrir WhatsApp",
      waIntro: "¡Hola Escalat! Soy",
      waCallText: "Me gustaría que me llamarais.",
      waPhone: "Teléfono",
      waWhen: "Cuándo",
      waNeed: "Necesito",
    },
    footer: {
      tagline: "Soluciones informáticas con IA para que una sola persona pueda con todo su negocio.",
      services: "Servicios",
      how: "Cómo funciona",
      about: "Sobre Escalat",
      contact: "Contacto",
      legalTitle: "Legal",
      legalNotice: "Aviso legal",
      privacy: "Privacidad",
      talkTitle: "Hablemos",
      callback: "Solicita que te llamemos",
      rights: "Todos los derechos reservados.",
    },
    chat: {
      launcher: "¿Hablamos?",
      name: "Asistente de Escalat",
      online: "en línea",
      greeting: "¡Hola! Soy el asistente de Escalat. Cuéntame qué te gustaría dejar de hacer a mano en tu negocio y te digo cómo podríamos automatizarlo.",
      placeholder: "Escribe tu mensaje…",
      legalPre: "Al escribir aceptas nuestra ",
      legalLink: "política de privacidad",
      error: 'Ahora mismo no puedo responder. Escríbenos a <a href="mailto:contacto@escalat.es">contacto@escalat.es</a> y te atendemos enseguida.',
      rateLimit: 'Has escrito muchos mensajes seguidos. Espera un momento y sigue, o escríbenos a <a href="mailto:contacto@escalat.es">contacto@escalat.es</a>.',
      form: {
        title: "Déjanos tus datos",
        intro: "Rellena y envía; seguimos por aquí.",
        name: "Nombre",
        namePh: "Tu nombre",
        email: "Email",
        emailPh: "tu@correo.com",
        phone: "Teléfono",
        phonePh: "600 000 000",
        optional: "(opcional)",
        consentPre: "He leído y acepto la ",
        consentLink: "política de privacidad",
        submit: "Enviar mis datos",
        sending: "Enviando…",
        errName: "Escribe tu nombre.",
        errEmail: "Revisa el email: no parece válido.",
        errPhone: "Revisa el teléfono: no parece válido.",
        errConsent: "Necesitamos que aceptes la política de privacidad.",
        summary: "Estos son mis datos:",
      },
      llamada: {
        title: "¿Prefieres que te llamemos?",
        intro: "Déjanos tu teléfono y te llamamos nosotros. Sin compromiso.",
        when: "¿Cuándo te viene mejor?",
        whenMorning: "Por la mañana",
        whenAfternoon: "Por la tarde",
        whenAny: "Me da igual",
        // Texto exacto que se guarda como prueba del consentimiento para llamar.
        consentPre: "Acepto que Escalat me llame a este número y he leído la ",
        consentLink: "política de privacidad",
        submit: "Que me llamen",
        sending: "Enviando…",
        errPhone: "Revisa el teléfono: no parece válido.",
        failed: "No he podido enviarlo. Inténtalo de nuevo.",
        summary: "Prefiero que me llaméis.",
        done: "Apuntado. Te llamamos al",
      },
      cita: {
        title: "Elige día y hora",
        loading: "Buscando huecos libres…",
        empty: "Ahora mismo no me quedan huecos. Escríbenos y lo cuadramos a mano.",
        error: "No he podido consultar la agenda. Vuelve a intentarlo en un momento.",
        pickTime: "Elige una hora:",
        confirm: "Confirmar cita",
        booking: "Reservando…",
        taken: "Vaya, acaban de coger ese hueco. Elige otro, por favor.",
        failed: "No he podido reservar. Inténtalo de nuevo.",
        doneMsg: "He reservado la entrevista para el",
        minutes: "min",
      },
    },
    skip: "Saltar al contenido",
  },

  en: {
    nav: { services: "Services", how: "How it works", about: "About Escalat", cta: "Request a demo" },
    hero: {
      eyebrow: "AI-powered solutions for small businesses and freelancers",
      titleLine1: "Less admin.",
      titleAccent: "More business.",
      subtitle:
        "We automate customer support, scheduling and the tasks that eat your day. You focus on your business; we take care of the repetitive stuff.",
      ctaChat: "Talk to our assistant",
      ctaCall: "Request a callback",
      trust: ["Tailor-made", "Quick to launch", "Close support"],
    },
    problema: {
      eyebrow: "The problem",
      title: "Running a business on your own is exhausting.",
      intro:
        "When you're the one answering, invoicing, scheduling and still doing the actual work, there aren't enough hours in the day. You don't need to work more — you need technology to handle the repetitive part.",
      pains: [
        "Calls and messages you can't get to in time.",
        "Appointments scattered everywhere, and the odd slot slips through.",
        "Repetitive tasks eating up your best hours.",
        "Clients and suppliers in your head, not in a system.",
      ],
      promiseStrong: "That's where Escalat comes in:",
      promiseRest: " we build the system so it no longer depends on you.",
    },
    servicios: {
      eyebrow: "Services",
      title: "What we can take off your plate",
      intro:
        "Each piece works on its own or all together. We start with whatever hurts most today and add more as your business grows.",
      items: [
        { title: "Support that never sleeps", desc: "A chatbot replies to every client instantly, day and night. No enquiry goes unanswered." },
        { title: "A virtual operator", desc: "A virtual operator takes calls, answers common questions and passes on only what truly matters." },
        { title: "Your calendar on autopilot", desc: "Bookings, confirmations and reminders handled on their own. No more empty slots or missed appointments." },
        { title: "Your whole business, in one place", desc: "Clients, conversations and tasks tidy and at hand. You decide; the system remembers for you." },
        { title: "Suppliers under control", desc: "Orders, contacts and due dates in a single place, with alerts before anything slips by." },
        { title: "Custom automations", desc: "Is there something you repeat by hand every week? We study it and leave it running on its own." },
      ],
    },
    como: {
      eyebrow: "How it works",
      title: "From overwhelmed to autopilot, in four steps",
      steps: [
        { title: "Diagnosis", desc: "We talk about your business and pinpoint what steals your time and where you lose clients." },
        { title: "We design the solution", desc: "We propose what to automate and how, with a clear plan, no jargon and at your pace." },
        { title: "We set it up", desc: "We build, connect and test everything. All you have to do is watch it start working." },
        { title: "You manage less", desc: "You get hours back and stop missing opportunities. We stay with you to improve and grow." },
      ],
    },
    caso: {
      eyebrow: "This already works",
      title: "A watchman that never blinks",
      desc: "We built an automation that watches a website 24/7 and alerts you instantly, via Telegram, the moment an appointment opens up. No one has to keep refreshing the page: the system watches for you and pings you right when it matters.",
      points: [
        "Checks availability continuously, without a break.",
        "Instant notification on your phone when a slot opens.",
        "Stable, discreet and running in the background.",
      ],
      footPre: "It's a small example with a big idea behind it: ",
      footAccent: "let technology work while you live",
      footPost: ". We do the same with your customer support, your calendar or your day-to-day tasks.",
      demo: { name: "Appointment monitor", status: "bot", alertTitle: "✅ Appointment available!", alertBody: "A free slot was detected. Book it as soon as you can.", time1: "09:41", recheck: "Checking again in 5 min…", time2: "09:46" },
    },
    sobre: {
      eyebrow: "About Escalat",
      title: "We believe one person can run a whole business",
      intro:
        "Escalat is born from a simple idea: technology should be on your side, not make your life harder. We design AI tools that handle the repetitive so you can focus on what only you know how to do.",
      textPre: "We start by helping small businesses and freelancers, and we grow with you: today a chatbot or an automated calendar; tomorrow, your whole business running almost by itself. That's the goal — and that's why we're called ",
      textAccent: "Escalat",
      textPost: ".",
      valores: [
        { title: "Closeness", desc: "We speak plainly, no jargon. You always deal with the person who does the work." },
        { title: "Tailor-made", desc: "No generic templates. Every solution fits how your business actually works." },
        { title: "Honesty", desc: "If you don't need something, we'll tell you. We'd rather earn your trust than oversell." },
      ],
    },
    contacto: {
      eyebrow: "Let's talk",
      title: "Tell us what keeps you up at night",
      intro:
        "The fastest way: talk to our assistant right here. It answers your questions and, if you like, takes your details so we can prepare a proposal. Prefer the phone? Ask for a callback.",
      ctaChat: "Talk to the assistant",
      waDirect: "WhatsApp us",
      formTitle: "Request a callback",
      formSub: "Leave us your details and we'll call you. No commitment.",
      labelName: "Name",
      phName: "Your name",
      labelPhone: "Phone",
      phPhone: "600 000 000",
      labelWhen: "When suits you best?",
      whenMorning: "In the morning",
      whenAfternoon: "In the afternoon",
      whenAny: "Either works",
      labelMsg: "What do you need?",
      optional: "(optional)",
      phMsg: "Briefly tell us about your case",
      consentPre: "I agree to Escalat calling me on this number and I have read the ",
      consentLink: "privacy policy",
      consentPost: ".",
      submit: "Call me",
      sending: "Sending…",
      statusOk: "Noted. We'll call you on the number you left us.",
      statusErr: "I couldn't send it. Try WhatsApp instead:",
      statusErrCta: "open WhatsApp",
      waIntro: "Hi Escalat! I'm",
      waCallText: "I'd like you to call me.",
      waPhone: "Phone",
      waWhen: "When",
      waNeed: "I need",
    },
    footer: {
      tagline: "AI-powered IT solutions so one person can run their whole business.",
      services: "Services",
      how: "How it works",
      about: "About Escalat",
      contact: "Contact",
      legalTitle: "Legal",
      legalNotice: "Legal notice",
      privacy: "Privacy",
      talkTitle: "Let's talk",
      callback: "Request a callback",
      rights: "All rights reserved.",
    },
    chat: {
      launcher: "Chat with us",
      name: "Escalat assistant",
      online: "online",
      greeting: "Hi! I'm the Escalat assistant. Tell me what you'd like to stop doing by hand in your business and I'll tell you how we could automate it.",
      placeholder: "Type your message…",
      legalPre: "By writing you accept our ",
      legalLink: "privacy policy",
      error: 'I can\'t reply right now. Write to us at <a href="mailto:contacto@escalat.es">contacto@escalat.es</a> and we\'ll help you shortly.',
      rateLimit: 'You\'ve sent a lot of messages in a row. Give it a moment and carry on, or write to us at <a href="mailto:contacto@escalat.es">contacto@escalat.es</a>.',
      form: {
        title: "Leave us your details",
        intro: "Fill it in and send; we'll carry on here.",
        name: "Name",
        namePh: "Your name",
        email: "Email",
        emailPh: "you@email.com",
        phone: "Phone",
        phonePh: "+34 600 000 000",
        optional: "(optional)",
        consentPre: "I have read and accept the ",
        consentLink: "privacy policy",
        submit: "Send my details",
        sending: "Sending…",
        errName: "Please enter your name.",
        errEmail: "That email doesn't look valid.",
        errPhone: "That phone number doesn't look valid.",
        errConsent: "We need you to accept the privacy policy.",
        summary: "Here are my details:",
      },
      llamada: {
        title: "Would you rather we called you?",
        intro: "Leave us your number and we'll call you. No commitment.",
        when: "When suits you best?",
        whenMorning: "In the morning",
        whenAfternoon: "In the afternoon",
        whenAny: "Either works",
        consentPre: "I agree to Escalat calling me on this number and I have read the ",
        consentLink: "privacy policy",
        submit: "Call me",
        sending: "Sending…",
        errPhone: "That phone number doesn't look valid.",
        failed: "I couldn't send it. Please try again.",
        summary: "I'd rather you called me.",
        done: "Noted. We'll call you on",
      },
      cita: {
        title: "Pick a day and time",
        loading: "Looking for free slots…",
        empty: "No slots left right now. Write to us and we'll sort it out.",
        error: "I couldn't check the calendar. Please try again in a moment.",
        pickTime: "Pick a time:",
        confirm: "Confirm appointment",
        booking: "Booking…",
        taken: "That slot was just taken. Please pick another one.",
        failed: "I couldn't book it. Please try again.",
        doneMsg: "I've booked the interview for",
        minutes: "min",
      },
    },
    skip: "Skip to content",
  },
} as const;
