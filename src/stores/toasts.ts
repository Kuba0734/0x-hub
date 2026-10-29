import { create } from "zustand";

export type ToastTone = "default" | "error";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, opts?: { tone?: ToastTone; duration?: number }) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (message, opts) => {
    const id = nextId++;
    const toast: Toast = {
      id,
      message,
      tone: opts?.tone ?? "default",
      duration: opts?.duration ?? (opts?.tone === "error" ? 6000 : 3500),
    };
    // Keep at most 4 on screen.
    set((s) => ({ toasts: [...s.toasts, toast].slice(-4) }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  show: (message: string) => useToasts.getState().push(message),
  error: (message: string) => useToasts.getState().push(message, { tone: "error" }),
};
