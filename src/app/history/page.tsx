"use client";

import { Archive, ChevronDown, History, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn, formatBytes, formatDate, formatNumber } from "@/lib/format";
import type { HistoryEntry } from "@/lib/types";
import { useApp } from "@/components/providers/AppProvider";
import { Button, EmptyState, Modal, PageHeader, Pill, Skeleton } from "@/components/ui";

export default function HistoryPage() {
  const { toast } = useApp();
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    api<{ history: HistoryEntry[] }>("/api/history")
      .then((d) => setHistory(d.history))
      .catch(() => setHistory([]));
  }, []);

  const total = (history ?? []).reduce((a, h) => a + h.totalFreed, 0);

  // last 14 days chart
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (13 - i));
    return d;
  });
  const perDay = days.map((d) => {
    const next = d.getTime() + 86_400_000;
    return (history ?? []).filter((h) => {
      const t = new Date(h.date).getTime();
      return t >= d.getTime() && t < next;
    }).reduce((a, h) => a + h.totalFreed, 0);
  });
  const maxDay = Math.max(1, ...perDay);

  async function clear() {
    await api("/api/history", { method: "DELETE" });
    setHistory([]);
    setConfirmClear(false);
    toast({ kind: "info", title: "History cleared" });
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<History className="h-5 w-5" />}
        title="History"
        description="Every cleanup you've run, what was removed and how much space it freed."
        actions={
          history && history.length > 0 ? (
            <Button variant="outline" onClick={() => setConfirmClear(true)} icon={<Trash2 className="h-4 w-4" />}>
              Clear history
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card card-pad">
          <div className="label">Total cleaned</div>
          <div className="mt-2 text-3xl font-bold text-white">{formatBytes(total)}</div>
          <div className="text-xs text-slate-500">{history?.length ?? 0} cleanups</div>
        </div>
        <div className="card card-pad md:col-span-2">
          <div className="label mb-3">Last 14 days</div>
          <div className="flex h-24 items-end gap-1.5">
            {perDay.map((v, i) => (
              <div key={i} className="group relative flex-1">
                <div className={cn("w-full rounded-t-md transition-all", v ? "bg-gradient-to-t from-brand-600 to-brand-300" : "bg-white/5")} style={{ height: `${v ? Math.max(8, (v / maxDay) * 96) : 4}px` }} />
                <div className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                  {days[i].toLocaleDateString(undefined, { month: "short", day: "numeric" })}: {formatBytes(v)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!history && <Skeleton className="h-40 w-full rounded-2xl" />}
      {history && history.length === 0 && (
        <div className="card">
          <EmptyState icon={<History className="h-6 w-6" />} title="No cleanups yet" body="Your cleanup history will appear here." />
        </div>
      )}
      <div className="space-y-2.5">
        {history?.map((h) => (
          <div key={h.id} className="card overflow-hidden">
            <button className="flex w-full items-center gap-4 p-4 text-left" onClick={() => setExpanded(expanded === h.id ? null : h.id)}>
              <div className={cn("grid h-10 w-10 place-items-center rounded-xl", h.mode === "quarantine" ? "bg-amber-500/10 text-amber-300" : "bg-brand-500/10 text-brand-300")}>
                {h.mode === "quarantine" ? <Archive className="h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white">{formatDate(h.date)}</div>
                <div className="truncate text-xs text-slate-400">
                  {h.targets.length} item(s) · {h.source === "projects" ? "Dev projects" : "Cache cleaner"} · {h.mode === "quarantine" ? "Quarantined" : "Deleted"}
                </div>
              </div>
              <span className="font-mono text-sm font-semibold text-brand-300">{formatBytes(h.totalFreed)}</span>
              <ChevronDown className={cn("h-4 w-4 text-slate-500 transition", expanded === h.id && "rotate-180")} />
            </button>
            {expanded === h.id && (
              <div className="divide-y divide-white/5 border-t border-white/5 bg-ink-850/50">
                {h.targets.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                    <span className="truncate font-mono text-slate-300">{t.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {h.source !== "projects" && <span className="text-slate-500">{formatNumber(t.files)} files</span>}
                      {t.status !== "done" && <Pill>{t.status}</Pill>}
                      <span className="font-mono text-slate-200">{formatBytes(t.freed)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear history?"
        subtitle="This only removes the log — no files are affected."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={clear}>
              Clear
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">Your cleanup statistics will start again from zero.</p>
      </Modal>
    </div>
  );
}
