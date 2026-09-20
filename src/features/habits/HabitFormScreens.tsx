import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { firstEntryDate } from '@/db/repos/entries';
import {
  createHabit,
  deleteHabit,
  getHabit,
  restoreHabitRecord,
  updateHabit,
} from '@/db/repos/habits';
import type { LocalDay } from '@/domain/day';
import type { HabitInput } from '@/domain/habit';
import { HABIT_TEMPLATES, templateToInput } from '@/domain/templates';
import { HABIT_COLORS, type Habit } from '@/domain/types';
import { useCategories, useHabits, useSettings } from '@/hooks/useData';
import { useToday } from '@/hooks/useToday';
import { notify, notifyError } from '@/lib/toast';
import { ButtonLink } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { HabitForm } from './HabitForm';
import { TemplateRow } from './TemplateRow';

/** Primer color de la paleta que ningún hábito activo usa todavía. */
function freeColor(habits: readonly Habit[]) {
  const used = new Set(habits.filter((h) => h.archivedOn === null).map((h) => h.color));
  return HABIT_COLORS.find((c) => !used.has(c)) ?? HABIT_COLORS[0];
}

function blankInput(today: LocalDay, habits: readonly Habit[]): HabitInput {
  return {
    name: '',
    description: '',
    color: freeColor(habits),
    icon: null,
    categoryId: null,
    kind: 'boolean',
    target: null,
    unit: null,
    frequency: { type: 'daily' },
    timeOfDay: 'any',
    reminder: null,
    createdOn: today,
  };
}

/** A dónde volver al terminar: Hoy si se llegó desde allí, la lista si no. */
function useReturnPath(): string {
  const [params] = useSearchParams();
  return params.get('volver') === 'hoy' ? '/' : '/habitos';
}

function TemplatePicker({ returnParam }: { returnParam: string }) {
  const suffix = returnParam ? `&${returnParam}` : '';
  return (
    <div className="max-w-list">
      <ScreenHeader title="Nuevo hábito" />
      <ul className="border-t border-border">
        <li className="border-b border-border">
          <Link
            to={`/habitos/nuevo?plantilla=blanco${suffix}`}
            className="flex min-h-14 items-center gap-3 py-2 hover:bg-sunken"
          >
            <span className="flex-1">
              <span className="block font-medium">Empezar en blanco</span>
              <span className="block text-sm text-text-muted">Define tú cada detalle.</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" className="text-text-faint" />
          </Link>
        </li>
      </ul>
      <h2 className="label-caps mt-10 mb-2">Plantillas</h2>
      <ul className="border-t border-border">
        {HABIT_TEMPLATES.map((template) => (
          <TemplateRow
            key={template.id}
            template={template}
            to={`/habitos/nuevo?plantilla=${template.id}${suffix}`}
          />
        ))}
      </ul>
    </div>
  );
}

export function NewHabitScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const today = useToday();
  const habits = useHabits();
  const settings = useSettings();
  const categories = useCategories();
  const returnTo = useReturnPath();

  const templateId = params.get('plantilla');
  if (!templateId) return <TemplatePicker returnParam={returnTo === '/' ? 'volver=hoy' : ''} />;
  if (!habits || !settings || !categories) return null;

  const template = HABIT_TEMPLATES.find((t) => t.id === templateId);
  const initial = template ? templateToInput(template, today) : blankInput(today, habits);

  const submit = async (input: HabitInput) => {
    try {
      const habit = await createHabit(input);
      notify(`Hábito creado: ${habit.name}`, {
        undo: async () => {
          await deleteHabit(habit.id);
        },
      });
      navigate(returnTo);
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <>
      <ScreenHeader title="Nuevo hábito" eyebrow={template ? 'Desde plantilla' : undefined} />
      <HabitForm
        key={templateId}
        mode="create"
        initial={initial}
        today={today}
        weekStartsOn={settings.weekStartsOn}
        retroLimitDays={settings.retroLimitDays}
        categories={categories}
        onSubmit={submit}
        onCancel={() => navigate(-1)}
      />
    </>
  );
}

export function EditHabitScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const today = useToday();
  const settings = useSettings();
  const categories = useCategories();
  const habit = useLiveQuery(async () => (await getHabit(id)) ?? null, [id]);
  const firstEntry = useLiveQuery(() => firstEntryDate(id), [id]);

  if (habit === undefined || firstEntry === undefined || !settings || !categories) return null;
  if (habit === null) {
    return (
      <EmptyState
        standalone
        title="Este hábito no existe."
        text="Puede que se haya eliminado."
        actions={<ButtonLink to="/habitos">Ver hábitos</ButtonLink>}
      />
    );
  }

  const { id: _id, order: _order, archivedOn: _archived, ...initial } = habit;

  const submit = async (input: HabitInput) => {
    try {
      await updateHabit(habit.id, input);
      notify('Cambios guardados', { undo: () => restoreHabitRecord(habit) });
      navigate('/habitos');
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <>
      <ScreenHeader title={habit.name} eyebrow="Editar hábito" />
      <HabitForm
        key={habit.id}
        mode="edit"
        initial={initial}
        today={today}
        weekStartsOn={settings.weekStartsOn}
        retroLimitDays={settings.retroLimitDays}
        firstEntry={firstEntry}
        categories={categories}
        onSubmit={submit}
        onCancel={() => navigate(-1)}
      />
    </>
  );
}
