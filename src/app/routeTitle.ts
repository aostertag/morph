export const APP_NAME = 'Hábitos';

/** Título de la pestaña y de la página según la ruta. */
export function routeTitle(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  let section: string | null;
  if (path === '/') section = 'Hoy';
  else if (path === '/estadisticas') section = 'Estadísticas';
  else if (path === '/habitos') section = 'Hábitos';
  else if (path === '/habitos/nuevo') section = 'Nuevo hábito';
  else if (/^\/habitos\/[^/]+\/editar$/.test(path)) section = 'Editar hábito';
  else if (/^\/habitos\/[^/]+$/.test(path)) section = 'Detalle del hábito';
  else if (path === '/revision') section = 'Revisión semanal';
  else if (path === '/ajustes') section = 'Ajustes';
  else section = 'Página no encontrada';
  return section === APP_NAME ? APP_NAME : `${section} · ${APP_NAME}`;
}
