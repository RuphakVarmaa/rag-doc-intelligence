"use client";

import { useToast } from "@/hooks/use-toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm animate-slide-up
            ${toast.variant === "destructive"
              ? "bg-destructive text-destructive-foreground"
              : "bg-foreground text-background"
            }`}
        >
          {toast.title && <div className="font-medium">{toast.title}</div>}
          {toast.description && <div className="opacity-80">{toast.description}</div>}
        </div>
      ))}
    </div>
  );
}
