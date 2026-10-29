import { create } from "zustand";

interface UiState {
  paletteOpen: boolean;
  sidebarCollapsed: boolean;
  /** Set by "Upload document" actions; consumed by the Documents page to open the picker. */
  pendingUpload: boolean;
  setPalette: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  requestUpload: () => void;
  consumeUpload: () => boolean;
}

export const useUi = create<UiState>((set, get) => ({
  paletteOpen: false,
  sidebarCollapsed: false,
  pendingUpload: false,
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  requestUpload: () => set({ pendingUpload: true }),
  consumeUpload: () => {
    const pending = get().pendingUpload;
    if (pending) set({ pendingUpload: false });
    return pending;
  },
}));
