"use client";

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/format";
import { useApp } from "./providers/AppProvider";

export function Toaster() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertTriangle : Info;
        return (
          <div key={t.id} className="card pointer-events-auto flex animate-fade-in items-start gap-3 p-4">
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", t.kind === "success" ? "text-brand-300" : t.kind === "error" ? "text-rose-300" : "text-sky-300")} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">{t.title}</div>
              {t.body && <div className="mt-0.5 break-words text-xs text-slate-400">{t.body}</div>}
            </div>
            <button onClick={() => dismissToast(t.id)} className="text-slate-500 hover:text-white" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
