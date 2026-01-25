import { create } from "zustand";

export type ToastType = "info" | "success" | "error" | "warning";
export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  createdAt: number;
};

type ToastState = {
  items: ToastItem[];
  push: (message: string, type?: ToastType) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useToast = create<ToastState>((set) => ({
  items: [],
  push: (message, type = "info") =>
    set((s) => ({
      items: [
        ...s.items,
        {
          id: (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`) as string,
          type,
          message,
          createdAt: Date.now(),
        },
      ],
    })),
  remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
  clear: () => set({ items: [] }),
}));

const toastFn = (message: string, type: ToastType = "info") => {
  useToast.getState().push(message, type);
};

export const toast = Object.assign(toastFn, {
  info: (m: string) => toastFn(m, "info"),
  success: (m: string) => toastFn(m, "success"),
  error: (m: string) => toastFn(m, "error"),
  warning: (m: string) => toastFn(m, "warning"),
});

export default toast;
