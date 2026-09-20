import { type ReactNode, useRef, useState } from 'react';
import type { Backup, BackupSummary } from '@/domain/backup';
import { toLocalDay } from '@/domain/day';
import { useToday } from '@/hooks/useToday';
import { formatDate, formatNumber } from '@/lib/format';
import { notifyError } from '@/lib/toast';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import {
  applyBackup,
  currentCounts,
  deleteEverything,
  exportBackup,
  exportCsv,
  readBackupFile,
} from './dataActions';

interface Problems {
  readonly fileName: string;
  readonly errors: readonly string[];
  readonly more: number;
}

interface Pending {
  readonly fileName: string;
  readonly backup: Backup;
  readonly summary: BackupSummary;
  readonly current: BackupSummary;
}

function plural(count: number, one: string, many: string): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

function describeContents(summary: BackupSummary): string {
  return [
    plural(summary.habits, 'hábito', 'hábitos'),
    plural(summary.entries, 'registro', 'registros'),
    plural(summary.pauses, 'pausa', 'pausas'),
    plural(summary.reviews, 'revisión', 'revisiones'),
  ].join(', ');
}

function Row({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border py-4">
      <div className="min-w-0 max-w-prose flex-1 basis-64">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-text-muted">{text}</p>
      </div>
      {children}
    </li>
  );
}

/** Exportar, importar y borrar. Importar valida el archivo entero antes de tocar nada. */
export function DataSection() {
  const today = useToday();
  const fileInput = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<Problems | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [deleting, setDeleting] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setProblems(null);
    try {
      const result = await readBackupFile(file);
      if (!result.ok) {
        setProblems({ fileName: file.name, errors: result.errors, more: result.more });
        return;
      }
      setPending({
        fileName: file.name,
        backup: result.backup,
        summary: result.summary,
        current: await currentCounts(),
      });
    } catch (error) {
      notifyError(error);
    }
  };

  const exportedOn = pending ? new Date(pending.backup.exportedAt) : null;

  return (
    <section aria-labelledby="datos" className="mt-12">
      <h2 id="datos" className="label-caps border-b border-border pb-2">
        Datos
      </h2>
      <ul>
        <Row
          title="Copia de seguridad"
          text="Descarga todos tus datos y ajustes en un archivo JSON. Se queda en tu dispositivo."
        >
          <Button onClick={() => void exportBackup()}>Exportar copia</Button>
        </Row>
        <Row
          title="Restaurar una copia"
          text="Sustituye todos tus datos por los de un archivo de copia. Antes de tocar nada se comprueba el archivo entero; si tiene algún problema, no se cambia nada."
        >
          <Button onClick={() => fileInput.current?.click()}>Importar copia…</Button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            aria-label="Archivo de copia de seguridad"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Se vacía para poder elegir de nuevo el mismo archivo tras corregirlo.
              event.target.value = '';
              void onFile(file);
            }}
          />
        </Row>
        <Row
          title="Registros en CSV"
          text="Una fila por hábito y día, para abrirla en una hoja de cálculo. No sirve para restaurar."
        >
          <Button onClick={() => void exportCsv()}>Exportar CSV</Button>
        </Row>
        <Row
          title="Borrar todos los datos"
          text="Elimina hábitos, registros, pausas, revisiones y ajustes de este dispositivo."
        >
          <Button variant="danger-ghost" onClick={() => setDeleting(true)}>
            Borrar todo…
          </Button>
        </Row>
      </ul>

      {problems && (
        <div role="alert" className="mt-4 border-l-3 border-danger py-1 pl-4">
          <p className="font-medium">
            No se ha importado nada: «{problems.fileName}» tiene problemas.
          </p>
          <p className="text-sm text-text-muted">
            Tus datos siguen exactamente como estaban. Corrige el archivo o exporta uno nuevo.
          </p>
          <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm">
            {problems.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          {problems.more > 0 && (
            <p className="mt-2 text-sm text-text-muted">
              Y {formatNumber(problems.more)}{' '}
              {problems.more === 1 ? 'problema más' : 'problemas más'}.
            </p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="¿Sustituir tus datos por esta copia?"
        description={
          pending ? (
            <>
              «{pending.fileName}»
              {exportedOn && !Number.isNaN(exportedOn.getTime())
                ? `, exportada el ${formatDate(toLocalDay(exportedOn), today)}`
                : ''}
              , contiene {describeContents(pending.summary)}. Sustituirá lo que tienes ahora:{' '}
              {describeContents(pending.current)}. Puedes deshacerlo justo después.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Sustituir datos"
        destructive
        onConfirm={() => {
          if (pending) void applyBackup(pending.backup);
        }}
      >
        <Button onClick={() => void exportBackup()}>Guardar una copia de lo actual antes</Button>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="¿Borrar todos los datos?"
        description="Se eliminarán todos tus hábitos, registros, pausas, revisiones y ajustes. Puedes deshacerlo justo después, pero si cierras la página no habrá vuelta atrás: guarda antes una copia."
        confirmLabel="Borrar todo"
        confirmPhrase="BORRAR"
        destructive
        onConfirm={() => void deleteEverything()}
      >
        <Button onClick={() => void exportBackup()}>Guardar una copia antes</Button>
      </ConfirmDialog>
    </section>
  );
}
