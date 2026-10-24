"use client";

import Link from "next/link";
import { ArrowRight, Bot, Globe, Code2, Cpu, FileClock, HardDrive, Layers, MemoryStick, Monitor, Radar, ShieldCheck, Sparkles, Trash, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { cn, formatBytes, formatDuration, timeAgo } from "@/lib/format";
import type { CategoryId, HistoryEntry } from "@/lib/types";
import { CleanDialog } from "@/components/CleanDialog";
import { useApp } from "@/components/providers/AppProvider";
import { Button, Progress, Skeleton } from "@/components/ui";

const CAT_ICON: Record<CategoryId, React.ComponentType<{ className?: string }>> = {
  system: Monitor,
  browser: Globe,
  developer: Code2,
  ai: Bot,
  apps: Layers,
  logs: FileClock,
  trash: Trash,
};
const CAT_COLOR: Record<CategoryId, string> = {
  system: "from-sky-500 to-cyan-300",
  browser: "from-violet-500 to-fuchsia-300",
  developer: "from-brand-500 to-emerald-300",
  ai: "from-amber-500 to-yellow-300",
  apps: "from-pink-500 to-rose-300",
  logs: "from-slate-400 to-slate-200",
  trash: "from-rose-500 to-orange-300",
};

function DiskRing({ used, total }: { used: number; total: number }) {
  const pct = total ? used / total : 0;
  const r = 70;
  const c = 2 * Math.PI * r;
  const color = pct > 0.9 ? "#fb7185" : pct > 0.75 ? "#fbbf24" : "#34d399";
  return (
    <div className="relative h-44 w-44 shrink-0">
      <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
        <circle cx="90" cy="90" r={r} stroke="rgba(255,255,255,.06)" strokeWidth="14" fill="none" />
        <circle cx="90" cy="90" r={r} stroke={color} strokeWidth="14" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold text-white">{Math.round(pct * 100)}%</div>
        <div className="text-xs text-slate-400">disk used</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { system, targets, categories, results, scan, scanProgress, lastScanAt, loading } = useApp();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    api<{ history: HistoryEntry[] }>("/api/history").then((d) => setHistory(d.history)).catch(() => undefined);
  }, [lastScanAt]);

  const scanned = Object.keys(results).length > 0;
  const existing = targets.filter((t) => t.exists);
  const reclaimable = existing.reduce((a, t) => a + (results[t.id]?.size ?? 0), 0);
  const safeIds = existing.filter((t) => t.risk === "safe" && !t.defaultOff && (results[t.id]?.size ?? 0) > 0 && !(results[t.id]?.runningProcesses.length)).map((t) => t.id);
  const safeTotal = safeIds.reduce((a, id) => a + (results[id]?.size ?? 0), 0);
  const allTimeFreed = history.reduce((a, h) => a + (h.mode === "delete" ? h.totalFreed : 0), 0);

  const byCategory = useMemo(() => {
    return categories
      .map((c) => ({ ...c, size: existing.filter((t) => t.category === c.id).reduce((a, t) => a + (results[t.id]?.size ?? 0), 0), count: existing.filter((t) => t.category === c.id).length }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.size - a.size);
  }, [categories, existing, results]);
  const maxCat = Math.max(1, ...byCategory.map((c) => c.size));

  const memPct = system ? ((system.totalMem - system.freeMem) / system.totalMem) * 100 : 0;
  const scanningNow = !!scanProgress;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Hero */}
      <section className="card relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="card-pad relative flex flex-col items-center gap-8 lg:flex-row">
          {system?.disk ? <DiskRing used={system.disk.used} total={system.disk.total} /> : <Skeleton className="h-44 w-44 rounded-full" />}
          <div className="min-w-0 flex-1 text-center lg:text-left">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-semibold text-brand-200 ring-1 ring-brand-500/20">
              <ShieldCheck className="h-3.5 w-3.5" /> Only regenerable caches — never your files
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {scanned ? (
                <>
                  <span className="bg-gradient-to-r from-brand-300 to-emerald-200 bg-clip-text text-transparent">{formatBytes(reclaimable)}</span> can be cleaned
                </>
              ) : (
                <>Make your {system?.platform === "win32" ? "PC" : "Mac"} faster</>
              )}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              {scanned
                ? `${formatBytes(safeTotal)} of that is 100% safe to remove right now. ${lastScanAt ? `Last scan ${timeAgo(lastScanAt)}.` : ""}`
                : "Scan browser, developer, AI-tool and system caches. Nothing is removed until you review and confirm."}
            </p>
            {scanningNow && (
              <div className="mt-4 max-w-md">
                <div className="mb-1.5 flex justify-between text-xs text-slate-400">
                  <span>Scanning caches…</span>
                  <span className="font-mono">
                    {scanProgress.done}/{scanProgress.total}
                  </span>
                </div>
                <Progress value={(scanProgress.done / scanProgress.total) * 100} />
              </div>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Button size="lg" onClick={() => scan()} loading={scanningNow || loading} icon={<Radar className="h-5 w-5" />}>
                {scanned ? "Scan again" : "Smart Scan"}
              </Button>
              {scanned && safeIds.length > 0 && (
                <Button size="lg" variant="secondary" onClick={() => setQuickOpen(true)} icon={<Zap className="h-5 w-5 text-brand-300" />}>
                  Quick clean safe items · {formatBytes(safeTotal)}
                </Button>
              )}
              {scanned && (
                <Link href="/cleaner">
                  <Button size="lg" variant="ghost">
                    Review all <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<Sparkles className="h-5 w-5" />} label="Reclaimable" value={scanned ? formatBytes(reclaimable) : "—"} hint={scanned ? `${existing.filter((t) => (results[t.id]?.size ?? 0) > 0).length} locations` : "Run a scan"} tone="brand" />
        <Stat icon={<HardDrive className="h-5 w-5" />} label="Free disk space" value={system?.disk ? formatBytes(system.disk.free) : "—"} hint={system?.disk ? `of ${formatBytes(system.disk.total)}` : ""} tone="sky" />
        <Stat icon={<MemoryStick className="h-5 w-5" />} label="Memory in use" value={system ? `${Math.round(memPct)}%` : "—"} hint={system ? `${formatBytes(system.totalMem - system.freeMem)} / ${formatBytes(system.totalMem)}` : ""} tone="violet" bar={memPct} />
        <Stat icon={<Trash className="h-5 w-5" />} label="Freed all time" value={formatBytes(allTimeFreed)} hint={`${history.length} cleanup${history.length === 1 ? "" : "s"}`} tone="amber" />
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        {/* Category breakdown */}
        <div className="card card-pad lg:col-span-3">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold text-white">Where your space goes</h2>
            <Link href="/cleaner" className="text-xs font-medium text-brand-300 hover:text-brand-200">
              Open cleaner →
            </Link>
          </div>
          <div className="space-y-4">
            {byCategory.length === 0 &&
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            {byCategory.map((c) => {
              const Icon = CAT_ICON[c.id];
              return (
                <Link key={c.id} href={`/cleaner?category=${c.id}`} className="group block">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-200 group-hover:text-white">
                      <Icon className="h-4 w-4 text-slate-400" />
                      {c.label}
                      <span className="text-xs text-slate-500">· {c.count}</span>
                    </span>
                    <span className="font-mono text-xs text-slate-300">{scanned ? formatBytes(c.size) : "—"}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
                    <div className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", CAT_COLOR[c.id])} style={{ width: scanned ? `${Math.max(2, (c.size / maxCat) * 100)}%` : "0%" }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* System */}
        <div className="card card-pad lg:col-span-2">
          <h2 className="mb-4 font-semibold text-white">This computer</h2>
          {system ? (
            <dl className="space-y-3 text-sm">
              <Info k="System" v={`${system.platformLabel} · ${system.arch}`} />
              <Info k="Computer" v={system.hostname} />
              <Info k="User" v={system.username} />
              <Info k="Processor" v={`${system.cpuModel} (${system.cpuCores} cores)`} />
              <Info k="Uptime" v={formatDuration(system.uptimeSec)} />
              <Info k="Privileges" v={system.isAdmin ? "Administrator" : "Standard user"} />
            </dl>
          ) : (
            <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-5" />)}</div>
          )}
          {system && system.uptimeSec > 7 * 86400 && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs text-amber-100/90">
              <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              Your computer has been running for {formatDuration(system.uptimeSec)}. A restart clears memory and system caches the OS manages itself.
            </div>
          )}
        </div>
      </section>

      {/* Recent */}
      <section className="card card-pad">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-white">Recent cleanups</h2>
          <Link href="/history" className="text-xs font-medium text-brand-300 hover:text-brand-200">
            View history →
          </Link>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">No cleanups yet. Run a Smart Scan to get started.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {history.slice(0, 4).map((h) => (
              <div key={h.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="text-slate-200">{h.targets.slice(0, 3).map((t) => t.name).join(", ")}{h.targets.length > 3 ? ` +${h.targets.length - 3}` : ""}</div>
                  <div className="text-xs text-slate-500">
                    {timeAgo(h.date)} · {h.mode === "quarantine" ? "Quarantined" : "Deleted"} · {h.source === "projects" ? "Dev projects" : "Cache cleaner"}
                  </div>
                </div>
                <div className="font-mono text-sm text-brand-300">{formatBytes(h.totalFreed)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <CleanDialog open={quickOpen} onClose={() => setQuickOpen(false)} targetIds={safeIds} />
    </div>
  );
}

function Stat({ icon, label, value, hint, tone, bar }: { icon: React.ReactNode; label: string; value: string; hint?: string; tone: "brand" | "sky" | "violet" | "amber"; bar?: number }) {
  const tones = {
    brand: "bg-brand-500/10 text-brand-300 ring-brand-500/20",
    sky: "bg-sky-500/10 text-sky-300 ring-sky-500/20",
    violet: "bg-violet-500/10 text-violet-300 ring-violet-500/20",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/20",
  };
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-3">
        <div className={cn("grid h-10 w-10 place-items-center rounded-xl ring-1", tones[tone])}>{icon}</div>
        <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</div>
      </div>
      <div className="mt-4 text-2xl font-bold text-white">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
      {bar !== undefined && <Progress value={bar} tone={bar > 85 ? "rose" : bar > 70 ? "amber" : "sky"} className="mt-3 h-1.5" />}
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{k}</dt>
      <dd className="truncate text-right text-slate-200" title={v}>
        {v}
      </dd>
    </div>
  );
}
