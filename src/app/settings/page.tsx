"use client";

import { Ban, FolderLock, Plus, Save, Settings as SettingsIcon, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Settings } from "@/lib/types";
import { useApp } from "@/components/providers/AppProvider";
import { Button, PageHeader, RiskBadge, Segmented, Skeleton, Switch } from "@/components/ui";

export default function SettingsPage() {
  const { settings, refreshSettings, refreshTargets, toast, system, categories } = useApp();
  const [form, setForm] = useState<Settings | null>(null);
  const [newPath, setNewPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [allTargets, setAllTargets] = useState<{ id: string; name: string; category: string; risk: "safe" | "moderate" | "critical" }[]>([]);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  // full list, including locations the user has hidden
  useEffect(() => {
    api<{ targets: { id: string; name: string; category: string; risk: "safe" | "moderate" | "critical" }[] }>("/api/targets?all=1")
      .then((d) => setAllTargets(d.targets))
      .catch(() => undefined);
  }, []);

  if (!form)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm({ ...form, [k]: v });

  async function save() {
    setSaving(true);
    try {
      await api("/api/settings", { method: "PUT", body: form });
      await Promise.all([refreshSettings(), refreshTargets()]);
      toast({ kind: "success", title: "Settings saved" });
    } catch (e) {
      toast({ kind: "error", title: "Could not save", body: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const disabled = new Set(form.disabledTargets);

  return (
    <div className="animate-fade-in pb-10">
      <PageHeader
        icon={<SettingsIcon className="h-5 w-5" />}
        title="Settings"
        description="Fine-tune how carefully CleanCache works."
        actions={
          <Button onClick={save} loading={saving} icon={<Save className="h-4 w-4" />}>
            Save changes
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card card-pad space-y-6">
            <h2 className="font-semibold text-white">Cleaning behaviour</h2>

            <Field title="Default removal mode" desc="Quarantine keeps files restorable for a few days (space is freed when they expire).">
              <Segmented value={form.defaultMode} onChange={(v) => set("defaultMode", v)} options={[{ value: "delete", label: "Delete" }, { value: "quarantine", label: "Quarantine" }]} />
            </Field>

            <Field title="Minimum file age" desc="Never touch files modified within this many hours (on top of each item's own rule).">
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={8760} className="input h-9 w-24 text-right font-mono" value={form.minAgeHours} onChange={(e) => set("minAgeHours", Number(e.target.value))} />
                <span className="text-xs text-slate-400">hours</span>
              </div>
            </Field>

            <Field title="Quarantine retention" desc="Quarantined files are deleted automatically after this many days.">
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={90} className="input h-9 w-24 text-right font-mono" value={form.quarantineRetentionDays} onChange={(e) => set("quarantineRetentionDays", Number(e.target.value))} />
                <span className="text-xs text-slate-400">days</span>
              </div>
            </Field>

            <Field title="Skip apps that are open" desc="Instead of asking, silently skip caches of apps that are currently running.">
              <Switch checked={form.skipRunningApps} onChange={(v) => set("skipRunningApps", v)} />
            </Field>
          </section>

          <section className="card card-pad">
            <div className="mb-1 flex items-center gap-2">
              <FolderLock className="h-4 w-4 text-brand-300" />
              <h2 className="font-semibold text-white">Never touch these paths</h2>
            </div>
            <p className="mb-4 text-xs text-slate-400">Anything inside these folders (or files) is always skipped. Use it for caches you want to keep.</p>
            <div className="flex gap-2">
              <input
                className="input font-mono"
                placeholder={system?.platform === "win32" ? "C:\\Users\\you\\AppData\\Local\\SomeApp\\Cache" : "~/Library/Caches/com.example.app"}
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPath.trim()) {
                    set("excludedPaths", [...form.excludedPaths, newPath.trim()]);
                    setNewPath("");
                  }
                }}
              />
              <Button
                variant="secondary"
                icon={<Plus className="h-4 w-4" />}
                disabled={!newPath.trim()}
                onClick={() => {
                  set("excludedPaths", [...form.excludedPaths, newPath.trim()]);
                  setNewPath("");
                }}
              >
                Add
              </Button>
            </div>
            <ul className="mt-4 space-y-2">
              {form.excludedPaths.length === 0 && <li className="text-xs text-slate-500">No custom exclusions.</li>}
              {form.excludedPaths.map((p, i) => (
                <li key={p + i} className="flex items-center justify-between gap-3 rounded-lg bg-ink-850 px-3 py-2">
                  <span className="break-all font-mono text-xs text-slate-300">{p}</span>
                  <button className="text-slate-500 hover:text-rose-300" onClick={() => set("excludedPaths", form.excludedPaths.filter((_, j) => j !== i))} aria-label="Remove">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="card card-pad">
            <div className="mb-1 flex items-center gap-2">
              <Ban className="h-4 w-4 text-brand-300" />
              <h2 className="font-semibold text-white">Visible cache locations</h2>
            </div>
            <p className="mb-4 text-xs text-slate-400">Turn off locations you never want to see in the cleaner.</p>
            <div className="space-y-5">
              {categories.map((c) => {
                const list = allTargets.filter((t) => t.category === c.id);
                if (!list.length) return null;
                return (
                  <div key={c.id}>
                    <div className="label mb-2">{c.label}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {list.map((t) => (
                        <label key={t.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-ink-850 px-3 py-2">
                          <span className="flex items-center gap-2 text-sm text-slate-200">
                            {t.name} <RiskBadge risk={t.risk} />
                          </span>
                          <Switch
                            checked={!disabled.has(t.id)}
                            onChange={(v) => set("disabledTargets", v ? form.disabledTargets.filter((x) => x !== t.id) : [...form.disabledTargets, t.id])}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card card-pad">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-300" />
              <h2 className="font-semibold text-white">Built-in protection</h2>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300">
              {[
                "Only known cache folders are ever cleaned (allow-list).",
                "Documents, Desktop, Downloads, Pictures, Movies, Music & Photos are off-limits.",
                "System folders, installed apps, Keychains, iCloud & OneDrive sync folders are off-limits.",
                "SSH/GPG keys, .env files, certificates & crypto wallets are never deleted.",
                "In temp folders, photos, videos and documents are kept.",
                "Symbolic links are never followed.",
                "Moderate items need a checkbox, critical items need you to type CLEAN.",
                "Apps that are open are detected and you're asked first.",
                "The server only accepts requests from this computer.",
              ].map((x) => (
                <li key={x} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  {x}
                </li>
              ))}
            </ul>
          </section>
          {system && (
            <section className="card card-pad text-xs text-slate-400">
              <div className="label mb-2">App data</div>
              Settings, history and quarantine are stored in
              <div className="mt-1 break-all font-mono text-slate-300">{system.appDataDir}</div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium text-slate-100">{title}</div>
        <div className="text-xs text-slate-400">{desc}</div>
      </div>
      {children}
    </div>
  );
}
