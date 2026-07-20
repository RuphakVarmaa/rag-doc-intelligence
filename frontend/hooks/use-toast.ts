import { useState, useCallback } from "react";

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

let listeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

function dispatch(toast: Toast) {
  toasts = [...toasts, toast];
  listeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== toast.id);
    listeners.forEach((l) => l(toasts));
  }, 3000);
}

export function toast(opts: Omit<Toast, "id">) {
  dispatch({ ...opts, id: crypto.randomUUID() });
}

export function useToast() {
  const [state, setState] = useState<Toast[]>(toasts);
  const subscribe = useCallback(() => {
    listeners.push(setState);
    return () => { listeners = listeners.filter((l) => l !== setState); };
  }, []);

  useState(() => { const unsub = subscribe(); return unsub; });

  return { toasts: state, toast };
}
