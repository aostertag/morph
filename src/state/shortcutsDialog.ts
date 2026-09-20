import { create } from 'zustand';

/** Estado del diálogo de atajos, que se abre con `?` o desde Ajustes. */
interface ShortcutsDialogState {
  readonly open: boolean;
  setOpen: (open: boolean) => void;
}

export const useShortcutsDialog = create<ShortcutsDialogState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
