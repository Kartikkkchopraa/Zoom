import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "success" | "error";
}

interface ToastState {
  toasts: Toast[];
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Show a transient message (e.g. "Invitation copied"). Callable from anywhere. */
export function toast(message: string, tone: Toast["tone"] = "info", durationMs = 3000) {
  const id = nextId++;
  useToasts.setState((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
  setTimeout(() => useToasts.getState().dismiss(id), durationMs);
}
