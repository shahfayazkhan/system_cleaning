"use client";

import { CheckCircle2, CircleHelp, Globe, KeyRound, Laptop, LogOut, RefreshCw, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn, timeAgo } from "@/lib/format";
import { IS_HOSTED } from "@/lib/mode";
import type { PermissionItem, PermissionStatus } from "@/lib/types";
import { useConnection } from "@/components/ConnectionGate";
import { useApp } from "@/components/providers/AppProvider";
import { Button, EmptyState, PageHeader, Skeleton } from "@/components/ui";

interface Pairing {
  origin: string;
  createdAt: string;
  lastUsedAt?: string;
}

export default function PermissionsPage() {
  const { toast, system, refreshSystem } = useApp();
  const connection = useConnection();
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const [pairings, setPairings] = useState<Pairing[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await api<PermissionStatus>("/api/permissions"));
    } catch (e) {
      toast({ kind: "error", title: "Could not check permissions", body: (e as Error).message });
    }
    if (!IS_HOSTED) {
      api<{ pairings: Pairing[] }>("/api/pairings")
        .then((d) => setPairings(d.pairings))
        .catch(() => setPairings([]));
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(item: PermissionItem) {
    if (!item.action) return;
    setBusy(item.id);
    try {
      const r = await api<{ ok: boolean; message: string }>("/api/permissions", { body: { action: item.action.id } });
      toast({ kind: "info", title: item.action.label, body: r.message });
    } catch (e) {
      toast({ kind: "error", title: "Permission not granted", body: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function revoke(origin: string) {
    setBusy(origin);
    try {
      await api("/api/pairings", { method: "DELETE", body: { origin } });
      setPairings((p) => (p ?? []).filter((x) => x.origin !== origin));
      toast({ kind: "success", title: "Access revoked", body: origin });
    } catch (e) {
      toast({ kind: "error", title: "Could not revoke", body: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const granted = status?.items.filter((i) => i.status === "granted").length ?? 0;

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<KeyRound className="h-5 w-5" />}
        title="Permissions"
        description="What CleanCache is allowed to do on this computer, and buttons to grant what's missing."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              load();
              refreshSystem();
            }}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Check again
          </Button>
        }
      />

      {IS_HOSTED && connection && (
        <section className="card card-pad mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-500/20">
            <Laptop className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-semibold text-white">
              Dashboard connected <CheckCircle2 className="h-4 w-4 text-brand-300" />
            </div>
            <div className="text-xs text-slate-400">
              This website talks directly to CleanCache on <b className="text-slate-200">{system?.hostname ?? "your computer"}</b> at <code className="kbd">{connection.agent}</code>. To revoke it completely, open CleanCache locally → Permissions.
            </div>
          </div>
          <Button variant="outline" onClick={connection.disconnect} icon={<LogOut className="h-4 w-4" />}>
            Disconnect
          </Button>
        </section>
      )}

      <section className="card card-pad mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-white">System permissions</h2>
          {status && (
            <span className="text-xs text-slate-400">
              {granted} of {status.items.length} granted
            </span>
          )}
        </div>
        {!status ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {status.items.map((item) => (
              <div key={item.id} className={cn("rounded-xl border p-4", item.status === "granted" ? "border-brand-500/20 bg-brand-500/[0.03]" : item.optional ? "border-amber-500/20 bg-amber-500/[0.04]" : "border-rose-500/25 bg-rose-500/[0.05]")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {item.status === "granted" ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
                    ) : item.status === "unknown" ? (
                      <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                    ) : (
                      <XCircle className={cn("mt-0.5 h-5 w-5 shrink-0", item.optional ? "text-amber-300" : "text-rose-300")} />
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                        {item.title}
                        <span className="text-[11px] font-medium text-slate-500">{item.optional ? "Optional" : "Required"}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">{item.description}</p>
                      {item.status !== "granted" && item.help && <p className="mt-2 text-xs text-slate-300">{item.help}</p>}
                    </div>
                  </div>
                  {item.status === "granted" ? (
                    <span className="text-xs font-semibold text-brand-300">Allowed</span>
                  ) : item.action ? (
                    <Button size="sm" onClick={() => runAction(item)} loading={busy === item.id} icon={<ShieldCheck className="h-4 w-4" />}>
                      {item.action.label}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {!IS_HOSTED && (
        <section className="card card-pad">
          <div className="mb-1 flex items-center gap-2">
            <Globe className="h-4 w-4 text-brand-300" />
            <h2 className="font-semibold text-white">Connected dashboards</h2>
          </div>
          <p className="mb-4 text-xs text-slate-400">Websites you allowed (e.g. your Vercel deployment) to control CleanCache on this computer.</p>
          {!pairings ? (
            <Skeleton className="h-14 w-full rounded-xl" />
          ) : pairings.length === 0 ? (
            <EmptyState icon={<Globe className="h-6 w-6" />} title="No websites connected" body="When you click “Allow access” on your hosted dashboard, it will appear here." />
          ) : (
            <ul className="space-y-2">
              {pairings.map((p) => (
                <li key={p.origin} className="flex items-center justify-between gap-3 rounded-lg bg-ink-850 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-sm text-slate-200">{p.origin}</div>
                    <div className="text-[11px] text-slate-500">
                      Allowed {timeAgo(p.createdAt)}
                      {p.lastUsedAt ? ` · last used ${timeAgo(p.lastUsedAt)}` : ""}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => revoke(p.origin)} loading={busy === p.origin} icon={<Trash2 className="h-3.5 w-3.5" />}>
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
