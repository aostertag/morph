/** Descarga un texto como archivo, sin salir de la página. */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // El navegador ya tiene el archivo en cuanto se dispara el clic; se libera un poco después.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
