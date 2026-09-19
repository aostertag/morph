import type { LocalDay, Weekday } from './day';

export const HABIT_COLORS = [
  'rojo',
  'naranja',
  'ocre',
  'oliva',
  'verde',
  'turquesa',
  'azul',
  'violeta',
  'magenta',
  'grafito',
] as const;
export type HabitColor = (typeof HABIT_COLORS)[number];

/**
 * - `boolean`: se hizo o no (valor 1).
 * - `quantity`: meta numérica con unidad; se guarda el valor real.
 * - `time`: minutos dedicados.
 * - `avoid`: algo que se quiere dejar; un registro es una recaída.
 */
export type HabitKind = 'boolean' | 'quantity' | 'time' | 'avoid';

export type Frequency =
  | { readonly type: 'daily' }
  | { readonly type: 'weekdays'; readonly days: readonly Weekday[] }
  | { readonly type: 'perWeek'; readonly times: number }
  | { readonly type: 'perMonth'; readonly times: number };

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'any';

export interface Reminder {
  /** 'HH:mm' en hora local. */
  readonly time: string;
  readonly enabled: boolean;
}

export interface Habit {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly color: HabitColor;
  /** Nombre de un icono de Lucide. */
  readonly icon: string | null;
  readonly categoryId: string | null;
  readonly kind: HabitKind;
  /** Meta por día en `quantity` (unidades) y `time` (minutos). `null` en el resto. */
  readonly target: number | null;
  readonly unit: string | null;
  readonly frequency: Frequency;
  readonly timeOfDay: TimeOfDay;
  readonly reminder: Reminder | null;
  /** Primer día en que el hábito cuenta. */
  readonly createdOn: LocalDay;
  /** Último día en que el hábito cuenta; `null` si está activo. */
  readonly archivedOn: LocalDay | null;
  readonly order: number;
}

export interface Entry {
  readonly id: string;
  readonly habitId: string;
  readonly date: LocalDay;
  /** 1 en sí/no, unidades en cuantitativos, minutos en tiempo, recaídas en "a evitar". */
  readonly value: number;
  readonly note: string | null;
  /** Instante real (ms) del último cambio del registro. */
  readonly loggedAt: number;
}

export type Scale = 1 | 2 | 3 | 4 | 5;

export interface DayLog {
  readonly date: LocalDay;
  readonly mood: Scale | null;
  readonly energy: Scale | null;
  readonly note: string | null;
  readonly updatedAt: number;
}

export type PauseReason = 'vacaciones' | 'enfermedad' | 'otro';

export interface Pause {
  readonly id: string;
  /** `null` = pausa global (todos los hábitos). */
  readonly habitId: string | null;
  readonly start: LocalDay;
  readonly end: LocalDay;
  readonly reason: PauseReason;
  readonly note: string | null;
}

export interface Category {
  readonly id: string;
  readonly name: string;
  readonly order: number;
}

export interface WeeklyReview {
  /** Primer día de la semana revisada. */
  readonly weekStart: LocalDay;
  readonly reflection: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export type ThemePreference = 'light' | 'dark' | 'system';

export interface Settings {
  readonly theme: ThemePreference;
  readonly weekStartsOn: Weekday;
  /** Cuántos días hacia atrás se puede registrar. */
  readonly retroLimitDays: number;
  readonly onboardingDone: boolean;
  /** Inicio de la última semana cuya revisión ya se ofreció. */
  readonly lastReviewOffered: LocalDay | null;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  weekStartsOn: 1,
  retroLimitDays: 7,
  onboardingDone: false,
  lastReviewOffered: null,
};
