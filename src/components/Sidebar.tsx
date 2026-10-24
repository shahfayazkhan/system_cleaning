"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, FolderGit2, Gauge, History, Menu, Settings, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { useState } from "react";
import { cn, formatBytes } from "@/lib/format";
import { useApp } from "./providers/AppProvider";

const NAV = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/cleaner", label: "Cache Cleaner", icon: Trash2 },
  { href: "/projects", label: "Dev Projects", icon: FolderGit2 },
  { href: "/quarantine", label: "Quarantine", icon: Archive },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

function OsLogo({ platform }: { platform?: string }) {
  if (platform === "win32")
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M3 5.5l7.5-1v7H3zm0 13l7.5 1v-7H3zm8.5 1.1L21 21v-8.5h-9.5zm0-15.2V11.5H21V3z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 4.9c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3-1.5z" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { system } = useApp();
  const [open, setOpen] = useState(false);
  const diskPct = system?.disk ? (system.disk.used / system.disk.total) * 100 : 0;

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-emerald-700 text-ink-950 shadow-glow">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[15px] font-bold tracking-tight text-white">CleanCache</div>
          <div className="text-[11px] text-slate-500">Safe system optimizer</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-brand-500/10 text-white ring-1 ring-brand-500/20" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", active ? "text-brand-300" : "text-slate-500 group-hover:text-slate-300")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 p-4">
        {system?.disk && (
          <div className="rounded-xl border border-white/5 bg-ink-850 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Disk</span>
              <span className="font-mono">{formatBytes(system.disk.free)} free</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div className={cn("h-full rounded-full", diskPct > 90 ? "bg-rose-400" : diskPct > 75 ? "bg-amber-400" : "bg-brand-400")} style={{ width: `${diskPct}%` }} />
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-xl border border-brand-500/15 bg-brand-500/[0.06] p-3 text-[11px] leading-snug text-brand-100/80">
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand-300" />
          Runs 100% locally. Personal files are never touched.
        </div>
        <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <OsLogo platform={system?.platform} />
            {system?.platformLabel ?? "…"}
          </span>
          <span className="font-mono">v1.0.0</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed left-3 top-3 z-40 rounded-xl border border-white/10 bg-ink-900 p-2 text-slate-300 lg:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-white/5 bg-ink-900/60 backdrop-blur lg:block">{content}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-white/5 bg-ink-900">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-white/5" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
