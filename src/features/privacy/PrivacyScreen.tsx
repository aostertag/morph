import { ScreenHeader } from '@/ui/ScreenHeader';

export function PrivacyScreen() {
  return (
    <div className="max-w-list">
      {/* Identidad de la página: el título ya nombra la pantalla, así que el icono es mudo (alt vacío). */}
      <img src="/pwa-192.png" alt="" width={64} height={64} className="block size-16 rounded-md" />
      <ScreenHeader title="Privacidad" />
      <div className="flex max-w-prose flex-col gap-4 text-md">
        <p>
          Morph no recoge ningún dato tuyo. No hay cuentas ni un servidor donde se guarde tu
          información: todo lo que registras (hábitos, rachas, notas, ánimo, energía) vive
          únicamente en el almacenamiento local de este navegador, en este dispositivo. Nada se
          envía a ningún sitio.
        </p>
        <p>
          <strong className="font-medium">Pero también puedes perderlos sin querer.</strong> Si
          borras los datos del sitio desde el navegador, desinstalas la app o la usas en una ventana
          privada o de incógnito, esos datos desaparecen: nadie más tiene una copia, así que
          conviene exportar la tuya de vez en cuando. Para evitar sorpresas, instala Morph (el
          navegador ofrece «Añadir a la pantalla de inicio» o «Instalar aplicación») y guarda una
          copia de seguridad desde Ajustes.
        </p>
        <p>
          <strong className="font-medium">Sin seguimiento.</strong> La app no usa analítica, no
          muestra publicidad y no comparte datos con terceros. No hace ninguna petición a un
          servidor propio.
        </p>
        <p>
          <strong className="font-medium">
            Cada dispositivo y cada navegador guardan lo suyo, por separado.
          </strong>{' '}
          Si usas Morph en el móvil y en el ordenador, o en Chrome y en Firefox, son dos almacenes
          distintos: no hay forma de que uno vea los datos del otro salvo que tú los muevas a mano.
        </p>
        <p>
          <strong className="font-medium">
            Puedes exportar, importar o borrar tus datos cuando quieras
          </strong>
          , desde Ajustes.
        </p>
        <p>
          <strong className="font-medium">El alojamiento es Cloudflare Pages.</strong> Como
          cualquier servidor web, registra datos técnicos de quien visita la página para poder
          servirla y protegerla de abusos. Eso lo gestiona Cloudflare, ocurre fuera de Morph y no
          tiene relación con tus hábitos, que nunca salen de tu navegador.
        </p>
      </div>
    </div>
  );
}
