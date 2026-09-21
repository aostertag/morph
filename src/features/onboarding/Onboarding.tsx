import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { updateSettings } from '@/db/repos/settings';
import { HABIT_TEMPLATES } from '@/domain/templates';
import { BlankRow, TemplateRow } from '@/features/habits/TemplateRow';
import { notifyError } from '@/lib/toast';
import { Button } from '@/ui/Button';

/*
 * Introducción de tres pasos, la primera vez y solo si aún no hay hábitos. Es
 * saltable en cualquier momento y no vuelve a salir una vez terminada o saltada.
 */

const STEPS = [
  {
    title: 'Registra lo que haces, día a día.',
    body: (
      <>
        <p>
          Marca cada hábito al hacerlo. La pantalla Hoy te enseña solo lo que toca, y las
          estadísticas te cuentan cómo va todo con muestras y sin adornos.
        </p>
        <p className="mt-3 text-text-muted">
          Todo se guarda en este dispositivo. No hay cuenta ni hace falta conexión.
        </p>
      </>
    ),
  },
  {
    title: 'Una racha no se rompe por un mal día.',
    body: (
      <ul className="flex flex-col gap-3">
        <li>
          <span className="font-medium">Frecuencias flexibles.</span> En un hábito de «3 veces por
          semana», no hacerlo un martes no rompe nada.
        </li>
        <li>
          <span className="font-medium">Comodines.</span> Ganas uno cada 7 unidades de racha (hasta
          2) y se usa solo para cubrir una unidad fallada.
        </li>
        <li>
          <span className="font-medium">Pausas.</span> Vacaciones o enfermedad: esos días no cuentan
          ni a favor ni en contra.
        </li>
      </ul>
    ),
  },
] as const;

const LAST = STEPS.length;
const SUGGESTED = HABIT_TEMPLATES.slice(0, 4);

export function Onboarding() {
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  // Al cambiar de paso el foco pasa al título (que es el mismo nodo), para que se
  // anuncie el contenido nuevo.
  const goTo = (next: number) => {
    setStep(next);
    heading.current?.focus();
  };

  const finish = async () => {
    try {
      await updateSettings({ onboardingDone: true });
    } catch (error) {
      notifyError(error);
    }
  };

  const current = STEPS[step];
  const isLast = step === LAST;

  return (
    <section aria-labelledby="onboarding-titulo" className="mx-auto max-w-xl pt-6 lg:pt-16">
      <div className="flex items-center justify-between gap-4">
        <p className="label-caps" aria-live="polite">
          Paso {step + 1} de {LAST + 1}
        </p>
        <Button variant="ghost" onClick={() => void finish()}>
          Saltar introducción
        </Button>
      </div>

      <h1
        id="onboarding-titulo"
        ref={heading}
        tabIndex={-1}
        className="mt-6 text-3xl font-semibold outline-none"
      >
        {current ? current.title : 'Empieza con un hábito.'}
      </h1>

      <div className="mt-6 max-w-prose text-md">
        {current ? (
          current.body
        ) : (
          <>
            <p>Elige una plantilla o crea el tuyo. Podrás cambiarlo cuando quieras.</p>
            <ul className="mt-5 border-t border-border">
              {SUGGESTED.map((template) => (
                <TemplateRow
                  key={template.id}
                  template={template}
                  to={`/habitos/nuevo?plantilla=${template.id}&volver=hoy`}
                  onClick={() => void finish()}
                />
              ))}
              <BlankRow
                to="/habitos/nuevo?plantilla=blanco&volver=hoy"
                onClick={() => void finish()}
              />
            </ul>
            <p className="mt-5 text-text-muted">
              ¿Vienes de otro dispositivo? Restaura tu copia desde{' '}
              <Link
                to="/ajustes"
                onClick={() => void finish()}
                className="text-accent underline underline-offset-4"
              >
                Ajustes
              </Link>
              .
            </p>
          </>
        )}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        {step > 0 ? <Button onClick={() => goTo(step - 1)}>Atrás</Button> : <span />}
        {isLast ? null : (
          <Button variant="primary" onClick={() => goTo(step + 1)}>
            Siguiente
          </Button>
        )}
      </div>
    </section>
  );
}
