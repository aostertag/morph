import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Habit } from '@/domain/types';
import { useHabits, useSettings } from '@/hooks/useData';
import { useToday } from '@/hooks/useToday';
import { formatDate } from '@/lib/format';
import { ActionsMenu } from '@/ui/ActionsMenu';
import { Button, ButtonLink } from '@/ui/Button';
import { EmptyState, ScreenHeader } from '@/ui/EmptyState';
import { ColorBar, HabitIconSlot } from '@/ui/HabitMarks';
import { DeleteDialog } from './DeleteDialog';
import { describeHabit } from './describe';
import { archive, reorder, unarchive } from './habitActions';
import { SortableHabitList } from './SortableHabitList';

export function HabitsScreen() {
  const habits = useHabits();
  const settings = useSettings();
  const today = useToday();
  const navigate = useNavigate();
  const [toDelete, setToDelete] = useState<Habit | null>(null);

  if (!habits || !settings) return null;

  const active = habits.filter((h) => h.archivedOn === null);
  const archived = habits.filter((h) => h.archivedOn !== null);
  const move = (index: number, delta: number) => {
    const ids = active.map((h) => h.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target] as string, ids[index] as string];
    void reorder(ids);
  };

  return (
    <div className="max-w-list">
      <ScreenHeader
        title="Hábitos"
        actions={
          <ButtonLink to="/habitos/nuevo" variant="primary">
            <Plus size={18} aria-hidden="true" />
            Nuevo hábito
          </ButtonLink>
        }
      />

      {active.length === 0 ? (
        <EmptyState
          title={archived.length > 0 ? 'No hay hábitos activos.' : 'Todavía no hay hábitos.'}
          text="Crea uno desde cero o parte de una plantilla: agua, lectura, ejercicio, meditación…"
        />
      ) : (
        <SortableHabitList
          habits={active}
          onReorder={(ids) => void reorder(ids)}
          renderRow={(habit, index) => (
            <>
              <HabitIconSlot name={habit.icon} />
              <div className="flex min-w-0 flex-1 flex-col justify-center py-2 pl-3">
                <Link
                  to={`/habitos/${habit.id}`}
                  className="truncate underline-offset-4 hover:underline"
                >
                  {habit.name}
                </Link>
                <p className="truncate text-sm text-text-muted">
                  {describeHabit(habit, settings.weekStartsOn)}
                </p>
              </div>
              <div className="flex items-center">
                <ActionsMenu
                  label={`Acciones de ${habit.name}`}
                  actions={[
                    { label: 'Editar', onSelect: () => navigate(`/habitos/${habit.id}/editar`) },
                    { label: 'Subir', onSelect: () => move(index, -1), disabled: index === 0 },
                    {
                      label: 'Bajar',
                      onSelect: () => move(index, 1),
                      disabled: index === active.length - 1,
                    },
                    { label: 'Archivar', onSelect: () => void archive(habit, today) },
                    { label: 'Eliminar…', onSelect: () => setToDelete(habit), destructive: true },
                  ]}
                />
              </div>
            </>
          )}
        />
      )}

      {archived.length > 0 && (
        <section aria-labelledby="archivados" className="mt-12">
          <h2 id="archivados" className="label-caps mb-2">
            Archivados · {archived.length}
          </h2>
          <ul className="border-t border-border">
            {archived.map((habit) => (
              <li
                key={habit.id}
                className="flex min-h-14 items-stretch gap-3 border-b border-border"
              >
                <ColorBar color={habit.color} className="opacity-50" />
                <div className="flex min-w-0 flex-1 flex-col justify-center py-2">
                  <Link
                    to={`/habitos/${habit.id}`}
                    className="truncate text-text-muted underline-offset-4 hover:underline"
                  >
                    {habit.name}
                  </Link>
                  <p className="truncate text-sm text-text-muted">
                    Hasta el {habit.archivedOn ? formatDate(habit.archivedOn, today) : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" onClick={() => void unarchive(habit, today)}>
                    Restaurar
                  </Button>
                  <Button variant="danger-ghost" onClick={() => setToDelete(habit)}>
                    Eliminar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DeleteDialog habit={toDelete} onClose={() => setToDelete(null)} />
    </div>
  );
}
