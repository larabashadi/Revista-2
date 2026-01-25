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

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  showToast: (message, type = "info", ms = 3500) => {
    const id = Math.random().toString(36).slice(2);
    const toast: Toast = { id, type, message };

    set({ toasts: [...get().toasts, toast] });

    // fallback: al menos lo verás en consola si no hay componente visual de toasts
    if (type === "error") console.error(message);
    else console.log(message);

    window.setTimeout(() => get().removeToast(id), ms);
  },
  removeToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  clear: () => set({ toasts: [] }),
}));
