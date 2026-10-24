"use client";

import { AlertOctagon, AlertTriangle, Archive, CheckCircle2, FlaskConical, Info, Loader2, ShieldCheck, Sparkles, Trash2, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { cn, formatBytes, formatNumber } from "@/lib/format";
import { CONFIRM_PHRASE, type CleanMode, type CleanResponse } from "@/lib/types";
import { Button, Checkbox, Modal, RiskBadge, Segmented, Switch } from "./ui";
import { useApp } from "./providers/AppProvider";

type Step = "review" | "running" | "done";

export function CleanDialog({ open, onClose, targetIds }: { open: boolean; onClose: () => void; targetIds: string[] }) {
  const { targets, results, defaultMode, rescan, refreshSystem, toast, system } = useApp();
  const [step, setStep] = useState<Step>("review");
  const [mode, setMode] = useState<CleanMode>(defaultMode);
  const [dryRun, setDryRun] = useState(false);
  const [acks, setAcks] = useState<Set<string>>(new Set());
  const [phrases, setPhrases] = useState<Record<string, string>>({});
  const [ignoreRunning, setIgnoreRunning] = useState<Set<string>>(new Set());
  const [response, setResponse] = useState<CleanResponse | null>(null);

  useEffect(() => {
    if (open) {
      setStep("review");
      setMode(defaultMode);
      setDryRun(false);
      setAcks(new Set());
      setPhrases({});
      setIgnoreRunning(new Set());
      setResponse(null);
    }
  }, [open, defaultMode]);

  const items = useMemo(() => targets.filter((t) => targetIds.includes(t.id)), [targets, targetIds]);
  const safe = items.filter((t) => t.risk === "safe");
  const moderate = items.filter((t) => t.risk === "moderate");
  const critical = items.filter((t) => t.risk === "critical");
  const running = items.filter((t) => (results[t.id]?.runningProcesses?.length ?? 0) > 0);
  const total = items.reduce((a, t) => a + (results[t.id]?.size ?? 0), 0);
  const needsAdmin = items.filter((t) => t.requiresAdmin && !system?.isAdmin);

  const ready =
    items.length > 0 &&
    moderate.every((t) => acks.has(t.id)) &&
    critical.every((t) => (phrases[t.id] ?? "").trim().toUpperCase() === CONFIRM_PHRASE) &&
    running.every((t) => ignoreRunning.has(t.id));

  async function run() {
    setStep("running");
    try {
      const res = await api<CleanResponse>("/api/clean", {
        body: {
          targetIds: items.map((t) => t.id),
          mode,
          dryRun,
          acknowledged: [...acks],
          confirmations: phrases,
          ignoreRunning: [...ignoreRunning],
        },
      });
      setResponse(res);
      setStep("done");
      if (!dryRun) {
        toast({
          kind: "success",
          title: mode === "quarantine" ? `${formatBytes(res.totalFreed)} moved to quarantine` : `${formatBytes(res.totalFreed)} freed`,
          body: mode === "quarantine" ? "Restore anytime from the Quarantine page." : "Your caches will rebuild as needed.",
        });
        rescan(items.map((t) => t.id));
        refreshSystem();
      }
    } catch (e) {
      toast({ kind: "error", title: "Cleaning failed", body: (e as Error).message });
      setStep("review");
    }
  }

  const footer =
    step === "review" ? (
      <>
        <div className="mr-auto flex items-center gap-3 text-xs text-slate-400">
          <Switch checked={dryRun} onChange={setDryRun} label="Dry run" />
          <span className="flex items-center gap-1">
            <FlaskConical className="h-3.5 w-3.5" /> Dry run (simulate only)
          </span>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={critical.length ? "danger" : "primary"} disabled={!ready} onClick={run} icon={mode === "quarantine" ? <Archive className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}>
          {dryRun ? "Simulate" : mode === "quarantine" ? "Move to quarantine" : "Clean now"} · {formatBytes(total)}
        </Button>
      </>
    ) : step === "done" ? (
      <Button onClick={onClose}>Done</Button>
    ) : null;

  return (
    <Modal
      open={open}
      onClose={step === "running" ? () => undefined : onClose}
      wide
      icon={step === "done" ? <CheckCircle2 className="h-5 w-5 text-brand-300" /> : <ShieldCheck className="h-5 w-5 text-brand-300" />}
      title={step === "done" ? (response?.dryRun ? "Simulation complete" : "Cleanup complete") : step === "running" ? "Cleaning…" : "Review & confirm"}
      subtitle={
        step === "review"
          ? `${items.length} item${items.length === 1 ? "" : "s"} selected · about ${formatBytes(total)} can be reclaimed`
          : step === "running"
            ? "Please keep this window open."
            : undefined
      }
      footer={footer}
    >
      {step === "review" && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-ink-850 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-white">How should files be removed?</div>
              <div className="mt-0.5 text-xs text-slate-400">
                {mode === "delete" ? "Permanently delete — space is freed immediately." : "Move to quarantine — restorable for a few days, space freed when purged."}
              </div>
            </div>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "delete", label: <><Trash2 className="h-3.5 w-3.5" /> Delete</> },
                { value: "quarantine", label: <><Archive className="h-3.5 w-3.5" /> Quarantine</> },
              ]}
            />
          </div>

          {needsAdmin.length > 0 && (
            <Notice tone="info" icon={<Info className="h-4 w-4" />}>
              {needsAdmin.map((t) => t.name).join(", ")} need Administrator rights. Without them, protected files are skipped safely.
            </Notice>
          )}

          {safe.length > 0 && (
            <Section title="Safe to clean" hint="Apps rebuild these automatically." tone="safe">
              {safe.map((t) => (
                <Row key={t.id} name={t.name} size={results[t.id]?.size} risk="safe" note={t.regenerates} />
              ))}
            </Section>
          )}

          {moderate.length > 0 && (
            <Section title="Needs your confirmation" hint="Rebuilding these costs time or bandwidth." tone="moderate">
              {moderate.map((t) => (
                <Row key={t.id} name={t.name} size={results[t.id]?.size} risk="moderate" note={t.warning}>
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-amber-100/90">
                    <Checkbox checked={acks.has(t.id)} onChange={(v) => setAcks((s) => toggleSet(s, t.id, v))} />I understand, clean {t.name}
                  </label>
                </Row>
              ))}
            </Section>
          )}

          {critical.length > 0 && (
            <Section title="Critical — read carefully" hint={`Type ${CONFIRM_PHRASE} for each item to confirm.`} tone="critical">
              {critical.map((t) => (
                <Row key={t.id} name={t.name} size={results[t.id]?.size} risk="critical" note={t.warning}>
                  <input
                    className="input mt-2 h-9 max-w-[220px] border-rose-500/30 font-mono uppercase tracking-widest"
                    placeholder={`Type ${CONFIRM_PHRASE}`}
                    value={phrases[t.id] ?? ""}
                    onChange={(e) => setPhrases((p) => ({ ...p, [t.id]: e.target.value }))}
                  />
                </Row>
              ))}
            </Section>
          )}

          {running.length > 0 && (
            <Section title="Apps currently open" hint="For best results close them first. In-use files are always skipped." tone="moderate">
              {running.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="text-sm text-slate-200">
                    {t.name} <span className="text-xs text-slate-500">({results[t.id]?.runningProcesses.join(", ")} running)</span>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                    <Checkbox checked={ignoreRunning.has(t.id)} onChange={(v) => setIgnoreRunning((s) => toggleSet(s, t.id, v))} />
                    Clean anyway
                  </label>
                </div>
              ))}
            </Section>
          )}

          <div className="flex items-start gap-2 text-xs text-slate-500">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
            Documents, photos, downloads, keychains, SSH keys, crypto wallets and installed apps are protected by a built-in guard and will never be removed.
          </div>
        </div>
      )}

      {step === "running" && (
        <div className="flex flex-col items-center py-12 text-center">
          <div className="relative mb-6 grid h-20 w-20 place-items-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-brand-500/20" />
            <div className="grid h-20 w-20 place-items-center rounded-full bg-brand-500/10 ring-1 ring-brand-500/30">
              <Sparkles className="h-8 w-8 text-brand-300" />
            </div>
          </div>
          <div className="text-white">{dryRun ? "Simulating cleanup…" : "Removing cache files safely…"}</div>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            {items.length} item{items.length === 1 ? "" : "s"}
          </div>
        </div>
      )}

      {step === "done" && response && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-brand-500/15 to-transparent p-6 text-center ring-1 ring-brand-500/20">
            <div className="text-xs uppercase tracking-wider text-brand-200/70">{response.dryRun ? "Would free" : response.mode === "quarantine" ? "Moved to quarantine" : "Space freed"}</div>
            <div className="mt-1 text-4xl font-bold text-white">{formatBytes(response.totalFreed)}</div>
          </div>
          <div className="divide-y divide-white/5 rounded-xl border border-white/5">
            {response.results.map((r) => (
              <div key={r.targetId} className="flex items-start gap-3 p-3">
                {r.status === "done" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                ) : r.status === "partial" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-100">{r.name}</span>
                    <span className="font-mono text-xs text-slate-300">{formatBytes(r.freed)}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatNumber(r.removedFiles)} files{r.skipped ? ` · ${formatNumber(r.skipped)} protected/skipped` : ""}
                    {r.message ? ` · ${r.message}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

function toggleSet(s: Set<string>, id: string, v: boolean) {
  const n = new Set(s);
  if (v) n.add(id);
  else n.delete(id);
  return n;
}

function Section({ title, hint, tone, children }: { title: string; hint?: string; tone: "safe" | "moderate" | "critical"; children: React.ReactNode }) {
  const icon = tone === "safe" ? <ShieldCheck className="h-4 w-4 text-emerald-300" /> : tone === "moderate" ? <AlertTriangle className="h-4 w-4 text-amber-300" /> : <AlertOctagon className="h-4 w-4 text-rose-300" />;
  return (
    <div className={cn("rounded-xl border p-4", tone === "safe" && "border-emerald-500/15 bg-emerald-500/[0.03]", tone === "moderate" && "border-amber-500/20 bg-amber-500/[0.04]", tone === "critical" && "border-rose-500/25 bg-rose-500/[0.05]")}>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-white">{title}</span>
        {hint && <span className="text-xs text-slate-400">— {hint}</span>}
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}

function Row({ name, size, risk, note, children }: { name: string; size?: number; risk: "safe" | "moderate" | "critical"; note?: string; children?: React.ReactNode }) {
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-100">{name}</span>
          <RiskBadge risk={risk} />
        </div>
        <span className="font-mono text-xs text-slate-300">{size !== undefined ? formatBytes(size) : "—"}</span>
      </div>
      {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
      {children}
    </div>
  );
}

function Notice({ children, icon, tone }: { children: React.ReactNode; icon: React.ReactNode; tone: "info" }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-xl border p-3 text-xs", tone === "info" && "border-sky-500/20 bg-sky-500/[0.06] text-sky-100/90")}>
      <span className="mt-0.5 text-sky-300">{icon}</span>
      {children}
    </div>
  );
}
