import {
  archiveHabit,
  deleteHabit,
  reorderHabits,
  restoreHabit,
  restoreHabitRecord,
  unarchiveHabit,
  undoUnarchive,
} from '@/db/repos/habits';
import type { LocalDay } from '@/domain/day';
import type { Habit } from '@/domain/types';
import { notify, notifyError } from '@/lib/toast';

async function run(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    notifyError(error);
  }
}

export function archive(habit: Habit, today: LocalDay): Promise<void> {
  return run(async () => {
    const previous = await archiveHabit(habit.id, today);
    notify(`${habit.name}: archivado. Su historial se conserva.`, {
      undo: () => restoreHabitRecord(previous),
    });
  });
}

export function unarchive(habit: Habit, today: LocalDay): Promise<void> {
  return run(async () => {
    const result = await unarchiveHabit(habit.id, today);
    notify(`${habit.name}: restaurado`, { undo: () => undoUnarchive(result) });
  });
}

export function remove(habit: Habit): Promise<void> {
  return run(async () => {
    const deleted = await deleteHabit(habit.id);
    if (!deleted) return;
    notify(`${habit.name}: eliminado`, { undo: () => restoreHabit(deleted) });
  });
}

export function reorder(ids: readonly string[]): Promise<void> {
  return run(() => reorderHabits(ids));
}
