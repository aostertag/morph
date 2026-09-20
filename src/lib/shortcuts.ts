/*
 * Atajos de teclado (escritorio). Aquí vive lo puro: qué tecla es qué atajo y cuándo
 * no debe actuar (escribiendo en un campo, con un diálogo abierto, con modificadores).
 * Se escribe sobre tipos estructurales mínimos para poder probarlo sin navegador.
 */

export type Shortcut =
  | { readonly type: 'habit'; readonly index: number }
  | { readonly type: 'prevDay' }
  | { readonly type: 'nextDay' }
  | { readonly type: 'newHabit' }
  | { readonly type: 'help' };

interface KeyEventLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly repeat: boolean;
}

/** Atajo que corresponde a una tecla, o `null`. Con Ctrl, Alt o Meta nunca hay atajo. */
export function parseShortcut(event: KeyEventLike): Shortcut | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return null;
  const { key } = event;
  if (/^[1-9]$/.test(key)) return { type: 'habit', index: Number(key) - 1 };
  switch (key) {
    case 'ArrowLeft':
      return { type: 'prevDay' };
    case 'ArrowRight':
      return { type: 'nextDay' };
    case 'n':
    case 'N':
      return { type: 'newHabit' };
    case '?':
      return { type: 'help' };
    default:
      return null;
  }
}

export interface ShortcutTarget {
  readonly tagName?: string;
  readonly isContentEditable?: boolean;
  readonly type?: string;
  getAttribute?(name: string): string | null;
}

/** Tipos de `input` en los que se escribe (a diferencia de casillas, radios o botones). */
const TEXT_INPUT_TYPES = new Set([
  '',
  'text',
  'search',
  'number',
  'email',
  'url',
  'tel',
  'password',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
]);

/** Roles cuyos controles usan las flechas para moverse. */
const ARROW_ROLES = new Set([
  'radio',
  'slider',
  'spinbutton',
  'tab',
  'menuitem',
  'option',
  'gridcell',
  'combobox',
  'listbox',
  'textbox',
]);

/**
 * Si el foco está en algo que ya usa esa tecla. Escribiendo en un campo no actúa
 * ningún atajo; las flechas además respetan radios, listas, la rejilla del heatmap…
 */
export function targetBlocksShortcut(target: ShortcutTarget | null, shortcut: Shortcut): boolean {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  if (target.isContentEditable || tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input' && TEXT_INPUT_TYPES.has((target.type ?? '').toLowerCase())) return true;

  if (shortcut.type === 'prevDay' || shortcut.type === 'nextDay') {
    // Radios y rangos se mueven con las flechas; una casilla no.
    if (tag === 'input' && ['radio', 'range'].includes((target.type ?? '').toLowerCase()))
      return true;
    const role = target.getAttribute?.('role');
    if (role && ARROW_ROLES.has(role)) return true;
    // La rejilla del heatmap y las listas ordenables se mueven con las flechas.
    if (tag === 'td' || tag === 'th') return true;
  }
  return false;
}

/** Hay un diálogo o un menú abierto: los atajos de la pantalla quedan en suspenso. */
export function overlayOpen(root: Pick<ParentNode, 'querySelector'>): boolean {
  return root.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]') !== null;
}
