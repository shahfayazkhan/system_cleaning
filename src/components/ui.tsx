"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/format";
import type { RiskLevel } from "@/lib/types";

/* ───────── Button ───────── */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
const variants: Record<Variant, string> = {
  primary: "bg-brand-500 text-ink-950 hover:bg-brand-400 shadow-glow",
  secondary: "bg-ink-700 text-slate-100 hover:bg-ink-600 border border-white/5",
  ghost: "text-slate-300 hover:bg-white/5 hover:text-white",
  danger: "bg-rose-500 text-white hover:bg-rose-400 shadow-[0_8px_30px_-10px_rgba(244,63,94,.6)]",
  outline: "border border-white/10 text-slate-200 hover:bg-white/5",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        variants[variant],
        className
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* ───────── Badge ───────── */
export function RiskBadge({ risk, className }: { risk: RiskLevel; className?: string }) {
  const map = {
    safe: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
    moderate: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
    critical: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
  } as const;
  const label = { safe: "Safe", moderate: "Confirm", critical: "Critical" }[risk];
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", map[risk], className)}>{label}</span>;
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-300 ring-1 ring-white/10", className)}>{children}</span>;
}

/* ───────── Checkbox ───────── */
export function Checkbox({ checked, onChange, disabled, indeterminate, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; indeterminate?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition",
        checked || indeterminate ? "border-brand-400 bg-brand-500 text-ink-950" : "border-white/20 bg-ink-850 hover:border-white/40",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      {indeterminate ? (
        <span className="h-0.5 w-2.5 rounded bg-ink-950" />
      ) : checked ? (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.6}>
          <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  );
}

/* ───────── Switch ───────── */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-brand-500" : "bg-ink-600")}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

/* ───────── Segmented ───────── */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-ink-850 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition", value === o.value ? "bg-ink-600 text-white shadow" : "text-slate-400 hover:text-slate-200")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────── Progress ───────── */
export function Progress({ value, className, tone = "brand" }: { value: number; className?: string; tone?: "brand" | "amber" | "rose" | "sky" }) {
  const tones = { brand: "from-brand-500 to-emerald-300", amber: "from-amber-500 to-yellow-300", rose: "from-rose-500 to-orange-300", sky: "from-sky-500 to-cyan-300" };
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-white/5", className)}>
      <div className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500", tones[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-white/5", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

/* ───────── Modal ───────── */
export function Modal({ open, onClose, title, subtitle, icon, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("card relative flex max-h-[90vh] w-full animate-fade-in flex-col overflow-hidden", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="flex items-start gap-4 border-b border-white/5 p-5">
          {icon && <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5">{icon}</div>}
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/5 bg-ink-850/60 p-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/* ───────── Page header ───────── */
export function PageHeader({ title, description, actions, icon }: { title: string; description?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-3">
        {icon && <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-500/20">{icon}</div>}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-slate-400">{icon}</div>
      <h3 className="font-semibold text-white">{title}</h3>
      {body && <p className="mt-1 max-w-md text-sm text-slate-400">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
