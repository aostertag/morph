import { useState } from 'react';
import { replaceAllData } from '@/db/repos/dataset';
import { toLocalDay } from '@/domain/day';
import { useHabits } from '@/hooks/useData';
import { notify, notifyError } from '@/lib/toast';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';

async function generate(): Promise<void> {
  try {
    const { generateSampleData } = await import('./sampleData');
    await replaceAllData({ ...generateSampleData({ today: toLocalDay(Date.now()) }), reviews: [] });
    notify('Datos de ejemplo generados: seis meses de historia.');
  } catch (error) {
    notifyError(error);
  }
}

/** Solo en desarrollo: sustituye todos los datos por seis meses de ejemplo. */
export default function SampleDataButton() {
  const habits = useHabits();
  const [confirming, setConfirming] = useState(false);
  const hasData = (habits?.length ?? 0) > 0;

  return (
    <>
      <Button
        onClick={() => {
          if (hasData) setConfirming(true);
          else void generate();
        }}
      >
        Generar datos de ejemplo
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="¿Sustituir todos los datos?"
        description="Se borrarán los hábitos, registros, pausas, categorías y revisiones actuales, y se generarán seis meses de datos de ejemplo. Los ajustes se conservan. No se puede deshacer."
        confirmLabel="Sustituir datos"
        destructive
        onConfirm={() => void generate()}
      />
    </>
  );
}
