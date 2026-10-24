"use client";

import { AlertTriangle, ChevronDown, FolderOpen, Lock, Radar, RefreshCw, Search, ShieldAlert, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn, formatBytes, formatNumber } from "@/lib/format";
import type { CacheTarget, CategoryId, RiskLevel } from "@/lib/types";
import { CleanDialog } from "@/components/CleanDialog";
import { useApp } from "@/components/providers/AppProvider";
import { Button, Checkbox, EmptyState, PageHeader, Pill, Progress, RiskBadge, Skeleton } from "@/components/ui";

const SKIP_LABEL: Record<string, string> = {
  "protected-path": "Protected location",
  "protected-file-type": "Key / wallet / certificate",
  "user-file-type": "Personal file type",
  "user-excluded": "Excluded in Settings",
  "too-recent": "Recently modified",
  "pattern-mismatch": "Not a cache file",
  "excluded-name": "Sync / system state",
  "covered-by-other-target": "Listed separately",
  "in-use": "In use",
  "permission-denied": "No permission",
  "special-file": "Socket / device",
};

export default function CleanerPage() {
  const { targets, categories, results, scanning, scanProgress, scan, rescan, selected, setSelected, toggle, loading, system } = useApp();
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [risk, setRisk] = useState<RiskLevel | "all">("all");
  const [query, setQuery] = useState("");
  const [showMissing, setShowMissing] = useState(false);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("category");
    if (c) setCategory(c as CategoryId);
  }, []);

  // first visit → auto scan
  useEffect(() => {
    if (!loading && targets.length && Object.keys(results).length === 0 && !scanProgress) scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, targets.length]);

  const visible = useMemo(
    () =>
      targets
        .filter((t) => (showMissing ? true : t.exists))
        .filter((t) => category === "all" || t.category === category)
        .filter((t) => risk === "all" || t.risk === risk)
        .filter((t) => !query || `${t.name} ${t.description}`.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => (results[b.id]?.size ?? 0) - (results[a.id]?.size ?? 0)),
    [targets, category, risk, query, showMissing, results]
  );

  const selectable = visible.filter((t) => t.exists && (results[t.id]?.size ?? 0) > 0);
  const selectedList = targets.filter((t) => selected.has(t.id) && t.exists);
  const selectedSize = selectedList.reduce((a, t) => a + (results[t.id]?.size ?? 0), 0);
  const allVisibleSelected = selectable.length > 0 && selectable.every((t) => selected.has(t.id));
  const someVisibleSelected = selectable.some((t) => selected.has(t.id));
  const missingCount = targets.filter((t) => !t.exists).length;
  const criticalSelected = selectedList.filter((t) => t.risk === "critical").length;

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of targets) if (t.exists) m[t.category] = (m[t.category] ?? 0) + (results[t.id]?.size ?? 0);
    return m;
  }, [targets, results]);

  function toggleAllVisible(v: boolean) {
    const n = new Set(selected);
    for (const t of selectable) {
      if (v) n.add(t.id);
      else n.delete(t.id);
    }
    setSelected(n);
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<Trash2 className="h-5 w-5" />}
        title="Cache Cleaner"
        description="Pick what to clean. Safe items rebuild automatically; anything riskier asks you first."
        actions={
          <Button variant="secondary" onClick={() => scan()} loading={!!scanProgress} icon={<Radar className="h-4 w-4" />}>
            {scanProgress ? `Scanning ${scanProgress.done}/${scanProgress.total}` : "Rescan all"}
          </Button>
        }
      />

      {scanProgress && <Progress value={(scanProgress.done / scanProgress.total) * 100} className="mb-5 h-1" />}

      {/* Category chips */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <Chip active={category === "all"} onClick={() => setCategory("all")}>
          All
        </Chip>
        {categories
          .filter((c) => targets.some((t) => t.category === c.id))
          .map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
              {c.label}
              {catCounts[c.id] ? <span className="ml-1.5 font-mono text-[10px] opacity-70">{formatBytes(catCounts[c.id])}</span> : null}
            </Chip>
          ))}
      </div>

      {/* Toolbar */}
      <div className="card mb-4 flex flex-col gap-3 p-3 md:flex-row md:items-center">
        <div className="flex items-center gap-3 px-2">
          <Checkbox checked={allVisibleSelected} indeterminate={!allVisibleSelected && someVisibleSelected} onChange={toggleAllVisible} label="Select all" />
          <span className="text-xs text-slate-400">Select all</span>
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input h-9 pl-9" placeholder="Search caches (e.g. chrome, npm, cursor)…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-1">
          {(["all", "safe", "moderate", "critical"] as const).map((r) => (
            <button key={r} onClick={() => setRisk(r)} className={cn("rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition", risk === r ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200")}>
              {r === "moderate" ? "Confirm" : r}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2.5 pb-28">
        {loading &&
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[74px] w-full rounded-2xl" />)}
        {!loading && visible.length === 0 && (
          <div className="card">
            <EmptyState icon={<Sparkles className="h-6 w-6" />} title="Nothing here" body="No caches match your filters on this computer." />
          </div>
        )}
        {visible.map((t) => (
          <TargetRow
            key={t.id}
            t={t}
            selected={selected.has(t.id)}
            onToggle={() => toggle(t.id)}
            expanded={expanded === t.id}
            onExpand={() => setExpanded(expanded === t.id ? null : t.id)}
            scanning={scanning.has(t.id)}
            result={results[t.id]}
            onRescan={() => rescan([t.id])}
            isAdmin={!!system?.isAdmin}
          />
        ))}
        {missingCount > 0 && (
          <button onClick={() => setShowMissing((v) => !v)} className="w-full py-3 text-center text-xs text-slate-500 hover:text-slate-300">
            {showMissing ? "Hide" : "Show"} {missingCount} location{missingCount === 1 ? "" : "s"} not found on this computer
          </button>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 lg:left-64">
        <div className="mx-auto max-w-6xl px-4 pb-4 sm:px-8 lg:px-10">
          <div className="card flex flex-col items-center gap-3 border-brand-500/20 p-3 sm:flex-row sm:p-4">
            <div className="flex flex-1 items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">
                  {selectedList.length} selected · {formatBytes(selectedSize)}
                </div>
                <div className="text-xs text-slate-400">
                  {criticalSelected ? (
                    <span className="text-rose-300">{criticalSelected} critical item(s) will require typed confirmation</span>
                  ) : (
                    "You'll review everything before anything is removed."
                  )}
                </div>
              </div>
            </div>
            <Button size="lg" disabled={!selectedList.length || !!scanProgress} onClick={() => setOpen(true)} icon={<Trash2 className="h-4 w-4" />} className="w-full sm:w-auto">
              Review & Clean
            </Button>
          </div>
        </div>
      </div>

      <CleanDialog open={open} onClose={() => setOpen(false)} targetIds={selectedList.map((t) => t.id)} />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition", active ? "bg-brand-500/15 text-brand-100 ring-brand-500/30" : "bg-white/[0.03] text-slate-400 ring-white/10 hover:text-slate-200")}>
      {children}
    </button>
  );
}

function TargetRow({
  t,
  selected,
  onToggle,
  expanded,
  onExpand,
  scanning,
  result,
  onRescan,
  isAdmin,
}: {
  t: CacheTarget;
  selected: boolean;
  onToggle: () => void;
  expanded: boolean;
  onExpand: () => void;
  scanning: boolean;
  result?: import("@/lib/types").ScanResult;
  onRescan: () => void;
  isAdmin: boolean;
}) {
  const empty = result && result.size === 0;
  const running = result?.runningProcesses ?? [];
  const disabled = !t.exists || !result || empty;
  return (
    <div className={cn("card overflow-hidden transition", selected && !disabled && "border-brand-500/25 ring-1 ring-brand-500/10", !t.exists && "opacity-50")}>
      <div className="flex cursor-pointer items-center gap-4 p-4" onClick={onExpand}>
        <Checkbox checked={selected && !disabled} disabled={disabled} onChange={onToggle} label={`Select ${t.name}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-white">{t.name}</span>
            <RiskBadge risk={t.risk} />
            {t.requiresAdmin && !isAdmin && (
              <Pill>
                <Lock className="h-3 w-3" /> Admin
              </Pill>
            )}
            {running.length > 0 && (
              <Pill className="bg-amber-500/10 text-amber-200 ring-amber-500/25">
                <AlertTriangle className="h-3 w-3" /> {running.join(", ")} open
              </Pill>
            )}
            {!t.exists && <Pill>Not installed</Pill>}
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{t.description}</p>
        </div>
        <div className="w-28 shrink-0 text-right">
          {scanning ? (
            <Skeleton className="ml-auto h-5 w-20" />
          ) : result ? (
            <>
              <div className={cn("font-mono text-sm font-semibold", empty ? "text-slate-500" : "text-white")}>{empty ? "Clean" : formatBytes(result.size)}</div>
              <div className="text-[11px] text-slate-500">{formatNumber(result.fileCount)} files</div>
            </>
          ) : (
            <span className="text-xs text-slate-500">—</span>
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition", expanded && "rotate-180")} />
      </div>

      {expanded && (
        <div className="animate-fade-in border-t border-white/5 bg-ink-850/50 p-4 text-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              {t.regenerates && (
                <div className="flex items-start gap-2 text-xs text-slate-300">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                  <span>{t.regenerates}</span>
                </div>
              )}
              {t.warning && (
                <div className={cn("flex items-start gap-2 rounded-lg p-2.5 text-xs", t.risk === "critical" ? "bg-rose-500/10 text-rose-100" : "bg-amber-500/10 text-amber-100")}>
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{t.warning}</span>
                </div>
              )}
              <div>
                <div className="label mb-1.5">Locations</div>
                <ul className="space-y-1">
                  {t.resolvedPaths.length ? (
                    t.resolvedPaths.map((p) => (
                      <li key={p} className="flex items-center gap-1.5 break-all font-mono text-[11px] text-slate-400">
                        <FolderOpen className="h-3 w-3 shrink-0" />
                        {p}
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-slate-500">Not found on this computer.</li>
                  )}
                </ul>
              </div>
              {(t.minAgeHours ?? 0) > 0 && <div className="text-xs text-slate-500">Only files older than {t.minAgeHours! >= 48 ? `${Math.round(t.minAgeHours! / 24)} days` : `${t.minAgeHours} hours`} are removed.</div>}
            </div>
            <div className="space-y-3">
              {result && result.largest.length > 0 && (
                <div>
                  <div className="label mb-1.5">Largest items</div>
                  <ul className="space-y-1">
                    {result.largest.map((l) => (
                      <li key={l.path} className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate font-mono text-slate-400" title={l.path}>
                          {l.path.split(/[\\/]/).pop()}
                        </span>
                        <span className="shrink-0 font-mono text-slate-300">{formatBytes(l.size)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result && result.skippedCount > 0 && (
                <div>
                  <div className="label mb-1.5">Protected / skipped ({formatNumber(result.skippedCount)})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(result.skippedReasons).map(([k, v]) => (
                      <Pill key={k}>
                        {SKIP_LABEL[k] ?? k}: {formatNumber(v)}
                      </Pill>
                    ))}
                  </div>
                </div>
              )}
              {result?.truncated && <div className="text-xs text-amber-300">Very large folder — the count was capped. Clean, then rescan to continue.</div>}
              <Button size="sm" variant="outline" onClick={onRescan} loading={scanning} icon={<RefreshCw className="h-3.5 w-3.5" />}>
                Rescan this item
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
