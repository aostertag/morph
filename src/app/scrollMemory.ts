const STORAGE_KEY = 'tracker:scroll';
const MAX_ENTRIES = 50;

type Memory = Record<string, [string, number]>;

function load(): Memory {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Memory) : {};
  } catch {
    return {};
  }
}

/**
 * Posición guardada de una entrada del historial (`location.key`), o `null` si no hay o si
 * era de otra ruta: las cargas completas reutilizan la clave `default`.
 */
export function readScroll(key: string, pathname: string): number | null {
  const saved = load()[key];
  if (!Array.isArray(saved) || saved[0] !== pathname) return null;
  const y = saved[1];
  return typeof y === 'number' && Number.isFinite(y) ? y : null;
}

/** Guarda la posición de una entrada del historial; solo se conservan las últimas. */
export function writeScroll(key: string, pathname: string, y: number): void {
  try {
    const memory = load();
    delete memory[key];
    memory[key] = [pathname, Math.max(0, Math.round(y))];
    const keys = Object.keys(memory);
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete memory[old];
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // sin almacenamiento: se pierde la recuperación al volver, nada más
  }
}
