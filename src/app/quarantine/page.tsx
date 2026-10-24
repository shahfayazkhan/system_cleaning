"use client";

import { Archive, Clock, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatBytes, formatDate, formatNumber, timeAgo } from "@/lib/format";
import type { QuarantineBatch } from "@/lib/types";
import { useApp } from "@/components/providers/AppProvider";
import { Button, EmptyState, Modal, PageHeader, Pill, Skeleton } from "@/components/ui";

export default function QuarantinePage() {
  const { toast, targets, refreshSystem } = useApp();
  const [batches, setBatches] = useState<QuarantineBatch[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ action: "purge" | "purge-all"; id?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setBatches((await api<{ batches: QuarantineBatch[] }>("/api/quarantine")).batches);
    } catch (e) {
      toast({ kind: "error", title: "Failed to load quarantine", body: (e as Error).message });
      setBatches([]);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const total = (batches ?? []).reduce((a, b) => a + b.totalSize, 0);
  const nameOf = (id: string) => (id.startsWith("project:") ? `Project ${id.slice(8)}` : targets.find((t) => t.id === id)?.name ?? id);

  async function restore(id: string) {
    setBusy(id);
    try {
      const r = await api<{ restored: number; conflicts: number; failed: number }>("/api/quarantine", { body: { action: "restore", id } });
      toast({ kind: "success", title: `Restored ${formatNumber(r.restored)} item(s)`, body: r.conflicts || r.failed ? `${r.conflicts} already existed, ${r.failed} failed.` : undefined });
      await load();
    } catch (e) {
      toast({ kind: "error", title: "Restore failed", body: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function purge() {
    if (!confirm) return;
    setBusy(confirm.id ?? "all");
    try {
      const r = await api<{ freed: number }>("/api/quarantine", { body: { action: confirm.action, id: confirm.id } });
      toast({ kind: "success", title: `${formatBytes(r.freed)} freed permanently` });
      setConfirm(null);
      await load();
      refreshSystem();
    } catch (e) {
      toast({ kind: "error", title: "Purge failed", body: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<Archive className="h-5 w-5" />}
        title="Quarantine"
        description="Files cleaned in Quarantine mode wait here so you can undo. They're deleted automatically when they expire."
        actions={
          batches && batches.length > 0 ? (
            <Button variant="danger" onClick={() => setConfirm({ action: "purge-all" })} icon={<Trash2 className="h-4 w-4" />}>
              Empty quarantine · {formatBytes(total)}
            </Button>
          ) : undefined
        }
      />

      {!batches && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {batches && batches.length === 0 && (
        <div className="card">
          <EmptyState icon={<Archive className="h-6 w-6" />} title="Quarantine is empty" body="Choose “Quarantine” instead of “Delete” when cleaning if you'd like the option to restore files later." />
        </div>
      )}

      <div className="space-y-3">
        {batches?.map((b) => {
          const expiresIn = Math.max(0, Math.ceil((new Date(b.expiresAt).getTime() - Date.now()) / 86_400_000));
          return (
            <div key={b.id} className="card card-pad flex flex-col gap-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold text-white">{formatBytes(b.totalSize)}</span>
                  <Pill>{formatNumber(b.itemCount)} items</Pill>
                  <Pill className="bg-amber-500/10 text-amber-200 ring-amber-500/20">
                    <Clock className="h-3 w-3" /> expires in {expiresIn} day{expiresIn === 1 ? "" : "s"}
                  </Pill>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {formatDate(b.createdAt)} ({timeAgo(b.createdAt)}) · {b.targets.map(nameOf).join(", ")}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => restore(b.id)} loading={busy === b.id} icon={<RotateCcw className="h-4 w-4" />}>
                  Restore
                </Button>
                <Button variant="outline" onClick={() => setConfirm({ action: "purge", id: b.id })} icon={<Trash2 className="h-4 w-4" />}>
                  Delete now
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        icon={<Trash2 className="h-5 w-5 text-rose-300" />}
        title={confirm?.action === "purge-all" ? "Empty the whole quarantine?" : "Delete this batch permanently?"}
        subtitle="These files cannot be restored afterwards."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={purge} loading={!!busy}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">They are regenerable cache files that you already chose to clean. Deleting them frees the disk space they still occupy.</p>
      </Modal>
    </div>
  );
}
