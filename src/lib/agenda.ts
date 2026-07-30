/**
 * Motor de huecos de la agenda.
 *
 * Aquí viven las reglas del negocio (horario, duración, márgenes, antelación) y el
 * cálculo de qué huecos quedan libres. n8n solo responde a una pregunta tonta —"¿qué
 * hay ocupado entre estas dos fechas?"— y todo el razonamiento pasa por aquí, que es
 * donde se puede leer, versionar y probar.
 *
 * Todo lo que cruza la frontera (n8n, la API, el navegador) va en ISO-8601 UTC.
 * El horario de abajo está en hora local de España, que es como lo piensa una persona.
 */

export interface Intervalo {
  /** Inicio en ISO-8601 UTC. */
  start: string;
  /** Fin en ISO-8601 UTC. */
  end: string;
}

/** Tramos por día de la semana, en hora local. 0 = domingo. Sin entrada = cerrado. */
type Horario = Record<number, Array<[string, string]>>;

export const AGENDA = {
  zona: "Europe/Madrid",
  /** Duración de la entrevista, en minutos. */
  duracionMin: 30,
  /** Colchón después de cada cita ocupada, para no encadenarlas sin respiro. */
  margenMin: 15,
  /** No ofrecer nada antes de estas horas desde ahora. */
  antelacionMinHoras: 24,
  /** Hasta cuántos días vista se ofrecen huecos. */
  horizonteDias: 14,
  /** Máximo de días con hueco que se enseñan de una vez. */
  maxDias: 5,
  horario: {
    1: [["10:00", "14:00"], ["16:00", "19:00"]],
    2: [["10:00", "14:00"], ["16:00", "19:00"]],
    3: [["10:00", "14:00"], ["16:00", "19:00"]],
    4: [["10:00", "14:00"], ["16:00", "19:00"]],
    5: [["10:00", "14:00"]],
  } as Horario,
};

/**
 * Desfase de la zona respecto a UTC, en milisegundos, para un instante dado.
 *
 * Se saca formateando el instante en la zona y comparándolo con el mismo reloj leído
 * como UTC. Es la forma de tener en cuenta el cambio de hora sin arrastrar una
 * librería de fechas entera.
 */
function desfase(instante: Date, zona: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instante);

  const p: Record<string, number> = {};
  for (const parte of partes) if (parte.type !== "literal") p[parte.type] = Number(parte.value);

  const comoUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour! % 24, p.minute!, p.second!);
  return comoUtc - instante.getTime();
}

/**
 * Convierte una hora de pared local ("el martes a las 10:00 en Madrid") al instante
 * UTC que le corresponde.
 *
 * Dos pasadas: la primera estima el desfase, la segunda lo corrige. Hace falta porque
 * el desfase depende del propio instante que estamos buscando, y en los domingos de
 * cambio de hora la primera estimación se queda corta.
 */
export function localAUtc(
  anyo: number, mes: number, dia: number, hora: number, minuto: number, zona = AGENDA.zona
): Date {
  const ingenuo = Date.UTC(anyo, mes - 1, dia, hora, minuto);
  const primera = ingenuo - desfase(new Date(ingenuo), zona);
  return new Date(ingenuo - desfase(new Date(primera), zona));
}

/** Año, mes y día que se ven en la zona para un instante dado. */
function fechaLocal(instante: Date, zona: string): { anyo: number; mes: number; dia: number; diaSemana: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(instante);

  const p: Record<string, string> = {};
  for (const parte of partes) if (parte.type !== "literal") p[parte.type] = parte.value;

  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    anyo: Number(p.year), mes: Number(p.month), dia: Number(p.day),
    diaSemana: dias.indexOf(p.weekday!),
  };
}

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

/** ¿Se pisan dos intervalos? Tocarse por el extremo no cuenta. */
function solapa(aIni: number, aFin: number, bIni: number, bFin: number): boolean {
  return aIni < bFin && bIni < aFin;
}

/**
 * Calcula los huecos libres a partir de lo que está ocupado.
 *
 * Un hueco entra si cabe entero dentro de un tramo de horario, respeta la antelación
 * mínima y no se pisa con nada ocupado (aplicándole a lo ocupado el margen de cortesía
 * por delante y por detrás).
 */
export function huecosLibres(
  ocupado: Intervalo[],
  ahora: Date = new Date(),
  agenda = AGENDA
): Intervalo[] {
  const duracion = agenda.duracionMin * 60_000;
  const margen = agenda.margenMin * 60_000;
  const desde = ahora.getTime() + agenda.antelacionMinHoras * 3_600_000;

  // Lo ocupado, ya en milisegundos y ensanchado con el margen.
  const bloques = ocupado
    .map((o) => ({ ini: Date.parse(o.start) - margen, fin: Date.parse(o.end) + margen }))
    .filter((b) => Number.isFinite(b.ini) && Number.isFinite(b.fin));

  const libres: Intervalo[] = [];
  const diasConHueco = new Set<string>();

  for (let d = 0; d <= agenda.horizonteDias; d++) {
    const { anyo, mes, dia, diaSemana } = fechaLocal(new Date(ahora.getTime() + d * 86_400_000), agenda.zona);
    const tramos = agenda.horario[diaSemana];
    if (!tramos) continue; // día cerrado

    for (const [abre, cierra] of tramos) {
      const iniTramo = localAUtc(anyo, mes, dia, 0, aMinutos(abre), agenda.zona).getTime();
      const finTramo = localAUtc(anyo, mes, dia, 0, aMinutos(cierra), agenda.zona).getTime();

      for (let t = iniTramo; t + duracion <= finTramo; t += duracion) {
        if (t < desde) continue;
        if (bloques.some((b) => solapa(t, t + duracion, b.ini, b.fin))) continue;

        libres.push({ start: new Date(t).toISOString(), end: new Date(t + duracion).toISOString() });
        diasConHueco.add(`${anyo}-${mes}-${dia}`);
      }
    }

    if (diasConHueco.size >= agenda.maxDias) break;
  }

  return libres;
}

/** ¿Sigue libre este inicio concreto? Se revalida justo antes de reservar. */
export function siguelibre(
  inicioIso: string,
  ocupado: Intervalo[],
  ahora: Date = new Date(),
  agenda = AGENDA
): boolean {
  return huecosLibres(ocupado, ahora, agenda).some((h) => h.start === inicioIso);
}

/** Ventana que se le pide a Google Calendar: desde ahora hasta el horizonte. */
export function ventanaConsulta(ahora: Date = new Date(), agenda = AGENDA): Intervalo {
  return {
    start: ahora.toISOString(),
    end: new Date(ahora.getTime() + (agenda.horizonteDias + 1) * 86_400_000).toISOString(),
  };
}
