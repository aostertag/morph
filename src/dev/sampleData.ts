import { addDays, diffDays, eachDay, type LocalDay, toLocalDate, weekdayOf } from '@/domain/day';
import { dailyGoal } from '@/domain/evaluate';
import { isScheduledOn } from '@/domain/frequency';
import { isPausedOn, pausesFor } from '@/domain/pauses';
import type {
  Category,
  DayLog,
  Entry,
  Habit,
  HabitKind,
  Pause,
  Scale,
  TimeOfDay,
} from '@/domain/types';

/*
 * Generador de datos de ejemplo (solo en desarrollo) para probar las estadísticas.
 *
 * Es determinista: la misma semilla y el mismo `today` dan exactamente los mismos
 * datos. Simula seis meses con un estado de ánimo de fondo que varía poco a poco,
 * patrones de fin de semana, dos baches, unas vacaciones y unos días de lesión.
 * Hay hábitos que mejoran y otros que decaen, y el ánimo y la energía dependen de
 * lo que se hace, así que aparecen correlaciones plausibles (y, como en la vida
 * real, con ruido).
 */

export interface SampleData {
  readonly categories: readonly Category[];
  readonly habits: readonly Habit[];
  readonly entries: readonly Entry[];
  readonly dayLogs: readonly DayLog[];
  readonly pauses: readonly Pause[];
}

export interface SampleOptions {
  readonly today: LocalDay;
  readonly seed?: number;
  /** Días de historia, hoy incluido. */
  readonly days?: number;
}

export const SAMPLE_DAYS = 182;
const DEFAULT_SEED = 20_260_919;

/** PRNG pequeño y rápido (mulberry32). */
function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const normal = (): number => {
    // Box-Muller.
    const u = 1 - next();
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const pick = <T>(items: readonly T[]): T => {
    const item = items[Math.floor(next() * items.length)];
    if (item === undefined) throw new Error('Lista vacía');
    return item;
  };
  return { next, normal, pick };
}

type Random = ReturnType<typeof createRandom>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function toScale(value: number): Scale {
  return clamp(Math.round(value), 1, 5) as Scale;
}

/** Contexto de un día que comparten todos los hábitos. */
interface DayState {
  readonly day: LocalDay;
  /** Posición en la historia: 0 el primer día, 1 hoy. */
  readonly progress: number;
  readonly weekend: boolean;
  /** Ánimo de fondo, más o menos entre -1,5 y 1,5. */
  readonly drive: number;
  readonly slump: boolean;
}

interface Profile {
  readonly key: string;
  readonly habit: Omit<Habit, 'id' | 'createdOn' | 'archivedOn' | 'order'>;
  /** Días desde el inicio de la historia en que se creó. */
  readonly startsAfter: number;
  /** Días antes de hoy en que se archivó; `null` si sigue activo. */
  readonly archivedDaysAgo: number | null;
  /** Probabilidad (en escala logística) de cumplir un día, según el contexto. */
  readonly propensity: (s: DayState) => number;
  readonly notes: readonly string[];
}

const HOUR: Readonly<Record<TimeOfDay, number>> = {
  morning: 8,
  afternoon: 18,
  evening: 22,
  any: 13,
};

const base = { description: '', icon: null, categoryId: null, reminder: null } as const;

function kindFields(kind: HabitKind, target: number | null = null, unit: string | null = null) {
  return { kind, target, unit };
}

const PROFILES: readonly Profile[] = [
  {
    key: 'agua',
    habit: {
      ...base,
      name: 'Beber agua',
      ...kindFields('quantity', 8, 'vasos'),
      color: 'turquesa',
      icon: 'glass-water',
      categoryId: 'demo-c-salud',
      frequency: { type: 'daily' },
      timeOfDay: 'any',
    },
    startsAfter: 0,
    archivedDaysAgo: null,
    propensity: (s) => 0.9 + 0.8 * s.drive - (s.weekend ? 0.6 : 0) - (s.slump ? 1 : 0),
    notes: ['Mucho calor.', 'Olvidé la botella en casa.'],
  },
  {
    key: 'pasos',
    habit: {
      ...base,
      name: 'Caminar',
      ...kindFields('quantity', 8000, 'pasos'),
      color: 'verde',
      icon: 'footprints',
      categoryId: 'demo-c-salud',
      frequency: { type: 'daily' },
      timeOfDay: 'afternoon',
    },
    startsAfter: 0,
    archivedDaysAgo: null,
    propensity: (s) => 0.3 + 0.9 * s.drive + (s.weekend ? 0.7 : 0) - (s.slump ? 1.2 : 0),
    notes: ['Paseo largo por el parque.', 'Fui andando al trabajo.'],
  },
  {
    key: 'ejercicio',
    habit: {
      ...base,
      name: 'Ejercicio',
      ...kindFields('boolean'),
      color: 'rojo',
      icon: 'dumbbell',
      categoryId: 'demo-c-salud',
      frequency: { type: 'perWeek', times: 3 },
      timeOfDay: 'afternoon',
    },
    startsAfter: 0,
    archivedDaysAgo: null,
    propensity: (s) => -0.4 + 1 * s.drive + (s.weekend ? 0.5 : 0) - (s.slump ? 1.5 : 0),
    notes: [
      'Pierna y espalda.',
      'Rodaje suave, 5 km.',
      'Clase de natación.',
      'Poco tiempo, 20 minutos.',
    ],
  },
  {
    key: 'meditar',
    habit: {
      ...base,
      name: 'Meditar',
      ...kindFields('time', 10, 'min'),
      color: 'violeta',
      icon: 'flower',
      categoryId: 'demo-c-mente',
      frequency: { type: 'daily' },
      timeOfDay: 'morning',
    },
    startsAfter: 0,
    archivedDaysAgo: null,
    // Mejora con el tiempo: empieza costando y acaba siendo rutina.
    propensity: (s) => -1 + 3 * s.progress + 0.6 * s.drive - (s.slump ? 0.8 : 0),
    notes: ['Me costó concentrarme.', 'Sesión guiada de respiración.'],
  },
  {
    key: 'leer',
    habit: {
      ...base,
      name: 'Leer',
      ...kindFields('time', 20, 'min'),
      color: 'azul',
      icon: 'book-open',
      categoryId: 'demo-c-mente',
      frequency: { type: 'daily' },
      timeOfDay: 'evening',
    },
    startsAfter: 0,
    archivedDaysAgo: null,
    // Constante durante meses y decae en las últimas semanas.
    propensity: (s) =>
      1.4 - (s.progress > 0.8 ? 12 * (s.progress - 0.8) : 0) + 0.5 * s.drive - (s.slump ? 0.8 : 0),
    notes: ['Terminé el libro.', 'Empecé una novela nueva.', 'Solo unas páginas.'],
  },
  {
    key: 'dormir',
    habit: {
      ...base,
      name: 'Dormir antes de las 23:30',
      ...kindFields('boolean'),
      color: 'grafito',
      icon: 'moon',
      categoryId: 'demo-c-salud',
      // Las noches antes de un día laborable: de domingo a jueves.
      frequency: { type: 'weekdays', days: [0, 1, 2, 3, 4] },
      timeOfDay: 'evening',
    },
    startsAfter: 0,
    archivedDaysAgo: null,
    propensity: (s) => 0.5 + 0.7 * s.drive - (s.slump ? 1 : 0),
    notes: [],
  },
  {
    key: 'ingles',
    habit: {
      ...base,
      name: 'Inglés',
      description: 'Curso online y un podcast.',
      ...kindFields('boolean'),
      color: 'ocre',
      icon: 'languages',
      categoryId: 'demo-c-mente',
      frequency: { type: 'weekdays', days: [1, 3, 5] },
      timeOfDay: 'morning',
    },
    // Creado a mitad del período.
    startsAfter: 80,
    archivedDaysAgo: null,
    propensity: (s) => 0.8 + 0.6 * s.drive - (s.slump ? 1 : 0),
    notes: ['Lección 12.', 'Episodio sobre viajes.'],
  },
  {
    key: 'familia',
    habit: {
      ...base,
      name: 'Llamar a la familia',
      ...kindFields('boolean'),
      color: 'magenta',
      icon: 'heart',
      categoryId: 'demo-c-relaciones',
      frequency: { type: 'perMonth', times: 4 },
      timeOfDay: 'any',
    },
    startsAfter: 0,
    archivedDaysAgo: null,
    propensity: (s) => -1.9 + (s.weekend ? 0.9 : 0) + 0.3 * s.drive,
    notes: ['Cumpleaños de la abuela.', 'Hablamos del verano.'],
  },
  {
    key: 'redes',
    habit: {
      ...base,
      name: 'Redes sociales antes de dormir',
      description: 'Dejar el móvil fuera del dormitorio.',
      ...kindFields('avoid'),
      color: 'naranja',
      icon: 'smartphone',
      categoryId: 'demo-c-mente',
      frequency: { type: 'daily' },
      timeOfDay: 'evening',
    },
    startsAfter: 0,
    archivedDaysAgo: null,
    // Aquí "propensión" es la probabilidad de recaer.
    propensity: (s) => -2.3 - 0.9 * s.drive + (s.weekend ? 0.5 : 0) + (s.slump ? 1.3 : 0),
    notes: ['Después de cenar.', 'No podía dormir.'],
  },
  {
    key: 'correr',
    habit: {
      ...base,
      name: 'Correr',
      ...kindFields('boolean'),
      color: 'oliva',
      icon: 'person-standing',
      categoryId: 'demo-c-salud',
      frequency: { type: 'perWeek', times: 2 },
      timeOfDay: 'morning',
    },
    startsAfter: 0,
    // Se dejó al cabo de unos meses: queda archivado con su historial.
    archivedDaysAgo: 75,
    propensity: (s) => -0.9 + 0.8 * s.drive + (s.weekend ? 0.8 : 0),
    notes: ['Rodaje de 6 km.'],
  },
];

const CATEGORIES: readonly Category[] = [
  { id: 'demo-c-salud', name: 'Salud', order: 0 },
  { id: 'demo-c-mente', name: 'Mente', order: 1 },
  { id: 'demo-c-relaciones', name: 'Relaciones', order: 2 },
];

const DAY_NOTES = [
  'Día largo en el trabajo.',
  'Buen día, sin prisas.',
  'Dormí mal.',
  'Comida con amigos.',
  'Mucho trabajo pendiente.',
  'Tarde tranquila en casa.',
  'Algo resfriado.',
];

/** Instante verosímil del registro: la hora del momento del día más unos minutos. */
function loggedAt(day: LocalDay, timeOfDay: TimeOfDay, random: Random): number {
  const date = toLocalDate(day);
  date.setHours(HOUR[timeOfDay], Math.floor(random.next() * 60));
  return date.getTime();
}

/** Valor del día según lo bien que salió: 1 = meta cumplida, entre 0 y 1 = a medias. */
function valueFor(habit: Profile['habit'], random: Random, success: boolean): number {
  const goal = dailyGoal(habit);
  if (habit.kind === 'boolean') return success ? 1 : 0;
  if (habit.kind === 'avoid') return success ? 0 : random.next() < 0.2 ? 2 : 1;
  const ratio = success ? 1 + random.next() * 0.4 : 0.2 + random.next() * 0.7;
  const raw = goal * ratio;
  if (habit.kind === 'time') return Math.max(5, Math.round(raw / 5) * 5);
  if (goal >= 1000) return Math.round(raw / 100) * 100;
  return Math.max(1, Math.round(raw));
}

export function generateSampleData(options: SampleOptions): SampleData {
  const { today } = options;
  const total = options.days ?? SAMPLE_DAYS;
  const random = createRandom(options.seed ?? DEFAULT_SEED);
  const start = addDays(today, -(total - 1));
  const at = (offset: number) => addDays(start, offset);

  // Dos baches, unas vacaciones (pausa global) y una lesión que solo afecta al ejercicio.
  const slumps = [
    [at(44), at(52)],
    [at(112), at(118)],
  ] as const;
  const pauses: Pause[] = [
    {
      id: 'demo-p-vacaciones',
      habitId: null,
      start: at(96),
      end: at(102),
      reason: 'vacaciones',
      note: 'Viaje a la costa.',
    },
    {
      id: 'demo-p-lesion',
      habitId: 'demo-h-ejercicio',
      start: at(150),
      end: at(155),
      reason: 'enfermedad',
      note: 'Esguince de tobillo.',
    },
  ];

  const habits: Habit[] = PROFILES.map((p, order) => ({
    ...p.habit,
    id: `demo-h-${p.key}`,
    createdOn: at(p.startsAfter),
    archivedOn: p.archivedDaysAgo === null ? null : addDays(today, -p.archivedDaysAgo),
    order,
  }));

  const entries: Entry[] = [];
  const dayLogs: DayLog[] = [];
  let drive = 0.3;
  // Durmió pronto la noche anterior: influye en la energía del día siguiente.
  let sleptEarly = false;

  for (const day of eachDay(start, today)) {
    const progress = diffDays(start, day) / (total - 1);
    const weekday = weekdayOf(day);
    const slump = slumps.some(([from, to]) => from <= day && day <= to);
    drive = clamp(0.85 * drive + 0.35 * random.normal() - (slump ? 0.25 : 0), -1.5, 1.5);
    const state: DayState = {
      day,
      progress,
      weekend: weekday === 0 || weekday === 6,
      drive,
      slump,
    };
    const isToday = day === today;
    // Hábitos cumplidos este día; en "a evitar", los que tuvieron recaída.
    const hits = new Set<string>();

    PROFILES.forEach((profile, index) => {
      const habit = habits[index];
      if (!habit) return;
      if (day < habit.createdOn || (habit.archivedOn !== null && day > habit.archivedOn)) return;
      if (!isScheduledOn(habit.frequency, day)) return;
      if (isPausedOn(day, pausesFor(habit.id, pauses))) return;
      // Hoy va a medias: solo lo de la mañana está hecho.
      if (isToday && habit.timeOfDay !== 'morning' && habit.kind !== 'quantity') return;

      const p = logistic(profile.propensity(state));
      const hit = random.next() < p;
      let value: number;
      if (habit.kind === 'avoid') value = hit && !isToday ? valueFor(habit, random, false) : 0;
      else if (isToday && habit.kind === 'quantity') value = valueFor(habit, random, false);
      else if (hit) value = valueFor(habit, random, true);
      // Un fallo a veces deja un registro a medias en cantidades y tiempo.
      else if (habit.kind !== 'boolean' && random.next() < 0.4)
        value = valueFor(habit, random, false);
      else value = 0;
      if (value <= 0) return;

      if (value >= dailyGoal(habit) || habit.kind === 'avoid') hits.add(profile.key);
      const note =
        profile.notes.length > 0 && random.next() < 0.07 ? random.pick(profile.notes) : null;
      entries.push({
        id: `demo-e-${profile.key}-${day}`,
        habitId: habit.id,
        date: day,
        value,
        note,
        loggedAt: loggedAt(day, habit.timeOfDay, random),
      });
    });

    // Ánimo y energía: se registran casi todos los días (hoy todavía no).
    const vacation = isPausedOn(
      day,
      pauses.filter((p) => p.habitId === null),
    );
    if (!isToday && random.next() < 0.86) {
      const mood =
        3.1 +
        0.5 * drive +
        (hits.has('ejercicio') ? 0.8 : 0) +
        (hits.has('meditar') ? 0.3 : 0) -
        (hits.has('redes') ? 0.7 : 0) +
        (vacation ? 0.5 : 0) -
        (slump ? 0.4 : 0) +
        0.55 * random.normal();
      const energy =
        2.9 +
        0.4 * drive +
        (sleptEarly ? 0.8 : 0) +
        (hits.has('pasos') ? 0.3 : 0) -
        (slump ? 0.4 : 0) +
        0.55 * random.normal();
      dayLogs.push({
        date: day,
        mood: toScale(mood),
        energy: toScale(energy),
        note: random.next() < 0.08 ? random.pick(DAY_NOTES) : null,
        updatedAt: loggedAt(day, 'evening', random),
      });
    }
    sleptEarly = hits.has('dormir');
  }

  return { categories: CATEGORIES, habits, entries, dayLogs, pauses };
}
