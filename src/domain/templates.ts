import type { LocalDay } from './day';
import type { HabitInput } from './habit';

export interface HabitTemplate {
  readonly id: string;
  /** Resumen de una línea para la lista de plantillas. */
  readonly summary: string;
  readonly input: Omit<HabitInput, 'createdOn' | 'categoryId'>;
}

const base = {
  description: '',
  reminder: null,
} as const;

export const HABIT_TEMPLATES: readonly HabitTemplate[] = [
  {
    id: 'agua',
    summary: '8 vasos al día',
    input: {
      ...base,
      name: 'Beber agua',
      kind: 'quantity',
      target: 8,
      unit: 'vasos',
      color: 'azul',
      icon: 'glass-water',
      frequency: { type: 'daily' },
      timeOfDay: 'any',
    },
  },
  {
    id: 'lectura',
    summary: '20 minutos al día',
    input: {
      ...base,
      name: 'Leer',
      kind: 'time',
      target: 20,
      unit: 'min',
      color: 'violeta',
      icon: 'book-open',
      frequency: { type: 'daily' },
      timeOfDay: 'evening',
    },
  },
  {
    id: 'ejercicio',
    summary: '3 veces por semana',
    input: {
      ...base,
      name: 'Ejercicio',
      kind: 'boolean',
      target: null,
      unit: null,
      color: 'rojo',
      icon: 'dumbbell',
      frequency: { type: 'perWeek', times: 3 },
      timeOfDay: 'any',
    },
  },
  {
    id: 'meditacion',
    summary: '10 minutos por la mañana',
    input: {
      ...base,
      name: 'Meditar',
      kind: 'time',
      target: 10,
      unit: 'min',
      color: 'turquesa',
      icon: 'flower',
      frequency: { type: 'daily' },
      timeOfDay: 'morning',
    },
  },
  {
    id: 'dormir',
    summary: 'Acostarse antes de las 23:00',
    input: {
      ...base,
      name: 'Dormir temprano',
      kind: 'boolean',
      target: null,
      unit: null,
      color: 'grafito',
      icon: 'moon',
      frequency: { type: 'daily' },
      timeOfDay: 'evening',
    },
  },
  {
    id: 'pasos',
    summary: '8.000 pasos al día',
    input: {
      ...base,
      name: 'Caminar',
      kind: 'quantity',
      target: 8000,
      unit: 'pasos',
      color: 'verde',
      icon: 'footprints',
      frequency: { type: 'daily' },
      timeOfDay: 'any',
    },
  },
  {
    id: 'diario',
    summary: 'Escribir unas líneas cada noche',
    input: {
      ...base,
      name: 'Escribir el diario',
      kind: 'boolean',
      target: null,
      unit: null,
      color: 'ocre',
      icon: 'notebook-pen',
      frequency: { type: 'daily' },
      timeOfDay: 'evening',
    },
  },
  {
    id: 'estiramientos',
    summary: 'Lunes, miércoles y viernes',
    input: {
      ...base,
      name: 'Estirar',
      kind: 'time',
      target: 10,
      unit: 'min',
      color: 'oliva',
      icon: 'person-standing',
      frequency: { type: 'weekdays', days: [1, 3, 5] },
      timeOfDay: 'morning',
    },
  },
  {
    id: 'sin-pantallas',
    summary: 'Sin móvil en la última hora del día',
    input: {
      ...base,
      name: 'Pantallas antes de dormir',
      kind: 'avoid',
      target: null,
      unit: null,
      color: 'magenta',
      icon: 'smartphone',
      frequency: { type: 'daily' },
      timeOfDay: 'evening',
    },
  },
  {
    id: 'sin-tabaco',
    summary: 'Contar días sin fumar',
    input: {
      ...base,
      name: 'Tabaco',
      kind: 'avoid',
      target: null,
      unit: null,
      color: 'naranja',
      icon: 'cigarette',
      frequency: { type: 'daily' },
      timeOfDay: 'any',
    },
  },
];

export function templateToInput(template: HabitTemplate, createdOn: LocalDay): HabitInput {
  return { ...template.input, createdOn, categoryId: null };
}
