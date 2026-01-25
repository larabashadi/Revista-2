import { create } from "zustand";

type ToastType = "success" | "error" | "info";

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

type ToastState = {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, ms?: number) => void;
  removeToast: (id: string) => void;
  clear: () => void;
};

/**
 * Store de toasts MUY simple.
 * - No rompe el build si algunas pantallas lo importan
 * - Si no tienes un componente que renderice `toasts`, al menos queda en estado/console
 */
export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  showToast: (message, type = "info", ms = 3500) => {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { id, type, message };

    set({ toasts: [...get().toasts, toast] });

    // fallback útil en prod si no hay UI de toasts montada
    if (type === "error") console.error(message);
    else console.log(message);

    window.setTimeout(() => {
      get().removeToast(id);
    }, ms);
  },
  removeToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  clear: () => set({ toasts: [] }),
}));
