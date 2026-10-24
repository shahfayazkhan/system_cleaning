"use client";

import { AlertOctagon, AlertTriangle, Archive, CheckCircle2, FolderGit2, FolderSearch, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { cn, formatBytes, formatNumber } from "@/lib/format";
import { CONFIRM_PHRASE, type CleanMode, type ProjectCacheItem } from "@/lib/types";
import { useApp } from "@/components/providers/AppProvider";
import { Button, Checkbox, EmptyState, Modal, PageHeader, RiskBadge, Segmented, Skeleton } from "@/components/ui";

interface CleanResult {
  totalFreed: number;
  dryRun: boolean;
  mode: CleanMode;
  results: { path: string; freed: number; status: string; message?: string }[];
}

export default function ProjectsPage() {
  const { system, defaultMode, toast, refreshSystem } = useApp();
  const sep = system?.platform === "win32" ? "\\" : "/";
  const [root, setRoot] = useState("");
  const [scannedRoot, setScannedRoot] = useState("");
  const [items, setItems] = useState<ProjectCacheItem[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CleanMode>(defaultMode);
  const [ack, setAck] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CleanResult | null>(null);

  const placeholder = system ? `${system.homeDir}${sep}Projects` : "~/Projects";

  async function doScan() {
    setLoading(true);
    setItems(null);
    try {
      const data = await api<{ root: string; items: ProjectCacheItem[]; truncated: boolean }>("/api/projects", { body: { action: "scan", root: root || placeholder } });
      setScannedRoot(data.root);
      setItems(data.items);
      setTruncated(data.truncated);
      setSelected(new Set(data.items.filter((i) => i.risk === "safe").map((i) => i.path)));
    } catch (e) {
      toast({ kind: "error", title: "Scan failed", body: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  const kinds = useMemo(() => {
    const m = new Map<string, { label: string; size: number; count: number }>();
    for (const i of items ?? []) {
      const cur = m.get(i.kind) ?? { label: i.label, size: 0, count: 0 };
      cur.size += i.size;
      cur.count++;
      m.set(i.kind, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].size - a[1].size);
  }, [items]);

  const visible = (items ?? []).filter((i) => kindFilter === "all" || i.kind === kindFilter);
  const sel = (items ?? []).filter((i) => selected.has(i.path));
  const selSize = sel.reduce((a, i) => a + i.size, 0);
  const hasModerate = sel.some((i) => i.risk === "moderate");
  const hasCritical = sel.some((i) => i.risk === "critical");
  const ready = sel.length > 0 && (!hasModerate || ack) && (!hasCritical || phrase.trim().toUpperCase() === CONFIRM_PHRASE);

  async function run(dryRun: boolean) {
    setRunning(true);
    try {
      const res = await api<CleanResult>("/api/projects", {
        body: { action: "clean", root: scannedRoot, paths: sel.map((i) => i.path), mode, dryRun, acknowledged: ack, confirmation: phrase },
      });
      setResult(res);
      if (!dryRun) {
        const done = new Set(res.results.filter((r) => r.status === "done").map((r) => r.path));
        setItems((list) => (list ?? []).filter((i) => !done.has(i.path)));
        setSelected(new Set());
        refreshSystem();
        toast({ kind: "success", title: `${formatBytes(res.totalFreed)} ${mode === "quarantine" ? "moved to quarantine" : "freed"}` });
      }
    } catch (e) {
      toast({ kind: "error", title: "Cleaning failed", body: (e as Error).message });
    } finally {
      setRunning(false);
    }
  }

  function openDialog() {
    setAck(false);
    setPhrase("");
    setResult(null);
    setMode(defaultMode);
    setOpen(true);
  }

  const rel = (p: string) => (scannedRoot && p.startsWith(scannedRoot) ? p.slice(scannedRoot.length + 1) : p);

  return (
    <div className="animate-fade-in pb-28">
      <PageHeader icon={<FolderGit2 className="h-5 w-5" />} title="Developer Projects" description="Find build outputs and caches inside your code folders — node_modules, .next, build/, target/, __pycache__, Pods and more." />

      <div className="card card-pad mb-5">
        <label className="label mb-2 block">Folder to scan</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <FolderSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input className="input pl-9 font-mono" placeholder={placeholder} value={root} onChange={(e) => setRoot(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doScan()} />
          </div>
          <Button onClick={doScan} loading={loading} icon={<Search className="h-4 w-4" />}>
            Scan folder
          </Button>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
          A folder is only listed when the matching project file sits next to it (e.g. <code className="kbd">build/</code> only with <code className="kbd">build.gradle</code> or <code className="kbd">pubspec.yaml</code>). Source code, .git and .env files are never touched.
        </p>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <div className="card">
          <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="All clean" body="No build artefacts or caches were found in that folder." />
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            <KindChip active={kindFilter === "all"} onClick={() => setKindFilter("all")} label="All" size={items.reduce((a, i) => a + i.size, 0)} count={items.length} />
            {kinds.map(([k, v]) => (
              <KindChip key={k} active={kindFilter === k} onClick={() => setKindFilter(k)} label={v.label.split(" (")[0]} size={v.size} count={v.count} />
            ))}
          </div>
          {truncated && <p className="mb-3 text-xs text-amber-300">Showing the first {formatNumber(items.length)} results — choose a narrower folder for the rest.</p>}

          <div className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3 text-xs text-slate-400">
              <Checkbox
                checked={visible.length > 0 && visible.every((i) => selected.has(i.path))}
                indeterminate={visible.some((i) => selected.has(i.path)) && !visible.every((i) => selected.has(i.path))}
                onChange={(v) => {
                  const n = new Set(selected);
                  visible.forEach((i) => (v ? n.add(i.path) : n.delete(i.path)));
                  setSelected(n);
                }}
              />
              <span className="flex-1">Folder</span>
              <span className="hidden w-48 sm:block">Type</span>
              <span className="w-24 text-right">Size</span>
            </div>
            <div className="max-h-[60vh] divide-y divide-white/5 overflow-y-auto">
              {visible.map((i) => (
                <div
                  key={i.path}
                  className={cn("flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02]", selected.has(i.path) && "bg-brand-500/[0.04]")}
                  onClick={() => setSelected((s) => { const n = new Set(s); if (n.has(i.path)) n.delete(i.path); else n.add(i.path); return n; })}
                >
                  <Checkbox checked={selected.has(i.path)} onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(i.path)) n.delete(i.path); else n.add(i.path); return n; })} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs text-slate-200" title={i.path}>
                      {rel(i.path)}
                    </div>
                    <div className="text-[11px] text-slate-500">{formatNumber(i.fileCount)} files</div>
                  </div>
                  <div className="hidden w-48 items-center gap-2 sm:flex">
                    <RiskBadge risk={i.risk} />
                    <span className="truncate text-xs text-slate-400">{i.label}</span>
                  </div>
                  <div className="w-24 text-right font-mono text-sm text-white">{formatBytes(i.size)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-30 lg:left-64">
            <div className="mx-auto max-w-6xl px-4 pb-4 sm:px-8 lg:px-10">
              <div className="card flex flex-col items-center gap-3 border-brand-500/20 p-4 sm:flex-row">
                <div className="flex-1 text-sm">
                  <span className="font-semibold text-white">
                    {sel.length} folder{sel.length === 1 ? "" : "s"} · {formatBytes(selSize)}
                  </span>
                  {hasCritical && <span className="ml-2 text-xs text-rose-300">includes node_modules / virtualenvs</span>}
                </div>
                <Button size="lg" disabled={!sel.length} onClick={openDialog} icon={<Trash2 className="h-4 w-4" />} className="w-full sm:w-auto">
                  Review & Clean
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      <Modal
        open={open}
        onClose={() => !running && setOpen(false)}
        wide
        icon={result ? <CheckCircle2 className="h-5 w-5 text-brand-300" /> : <ShieldCheck className="h-5 w-5 text-brand-300" />}
        title={result ? (result.dryRun ? "Simulation complete" : "Cleanup complete") : "Confirm project cleanup"}
        subtitle={result ? undefined : `${sel.length} folders · ${formatBytes(selSize)}`}
        footer={
          result && !result.dryRun ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={running}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => run(true)} disabled={!ready} loading={running}>
                Dry run
              </Button>
              <Button variant={hasCritical ? "danger" : "primary"} onClick={() => run(false)} disabled={!ready} loading={running} icon={mode === "quarantine" ? <Archive className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}>
                {mode === "quarantine" ? "Move to quarantine" : "Delete folders"}
              </Button>
            </>
          )
        }
      >
        {result ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-brand-500/15 to-transparent p-6 text-center ring-1 ring-brand-500/20">
              <div className="text-xs uppercase tracking-wider text-brand-200/70">{result.dryRun ? "Would free" : result.mode === "quarantine" ? "Moved to quarantine" : "Space freed"}</div>
              <div className="mt-1 text-4xl font-bold text-white">{formatBytes(result.totalFreed)}</div>
            </div>
            {result.results.some((r) => r.status !== "done") && (
              <div className="space-y-1 text-xs">
                {result.results
                  .filter((r) => r.status !== "done")
                  .map((r) => (
                    <div key={r.path} className="text-amber-200">
                      {rel(r.path)} — {r.message}
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-ink-850 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-300">{mode === "delete" ? "Permanently delete selected folders." : "Move to quarantine (restorable)."}</div>
              <Segmented value={mode} onChange={setMode} options={[{ value: "delete", label: "Delete" }, { value: "quarantine", label: "Quarantine" }]} />
            </div>
            {hasModerate && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <AlertTriangle className="h-4 w-4 text-amber-300" /> Build outputs will be rebuilt
                </div>
                <p className="mt-1 text-xs text-slate-400">build/, target/, Pods/, bin/ etc. are recreated by your next build, which will take longer.</p>
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-amber-100">
                  <Checkbox checked={ack} onChange={setAck} /> I understand
                </label>
              </div>
            )}
            {hasCritical && (
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <AlertOctagon className="h-4 w-4 text-rose-300" /> Dependencies will be removed
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  node_modules / .venv must be reinstalled (<code className="kbd">npm install</code>, <code className="kbd">pip install -r requirements.txt</code>) before those projects run again. Type {CONFIRM_PHRASE} to continue.
                </p>
                <input className="input mt-3 h-9 max-w-[220px] border-rose-500/30 font-mono uppercase tracking-widest" placeholder={`Type ${CONFIRM_PHRASE}`} value={phrase} onChange={(e) => setPhrase(e.target.value)} />
              </div>
            )}
            {result === null && !hasModerate && !hasCritical && <p className="text-sm text-slate-400">These are pure caches — safe to remove.</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

function KindChip({ active, onClick, label, size, count }: { active: boolean; onClick: () => void; label: string; size: number; count: number }) {
  return (
    <button onClick={onClick} className={cn("shrink-0 rounded-xl px-3 py-2 text-left ring-1 transition", active ? "bg-brand-500/15 ring-brand-500/30" : "bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]")}>
      <div className="text-xs font-semibold text-slate-100">
        {label} <span className="text-slate-500">· {count}</span>
      </div>
      <div className="font-mono text-[11px] text-slate-400">{formatBytes(size)}</div>
    </button>
  );
}
