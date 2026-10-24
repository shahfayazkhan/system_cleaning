"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { CacheTarget, CategoryInfo, CleanMode, ScanResult, Settings, SystemInfo } from "@/lib/types";

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  title: string;
  body?: string;
}

interface AppState {
  system: SystemInfo | null;
  settings: Settings | null;
  categories: CategoryInfo[];
  targets: CacheTarget[];
  results: Record<string, ScanResult>;
  scanning: Set<string>;
  scanProgress: { done: number; total: number } | null;
  lastScanAt: string | null;
  selected: Set<string>;
  loading: boolean;
  setSelected: (s: Set<string>) => void;
  toggle: (id: string) => void;
  refreshTargets: () => Promise<void>;
  refreshSystem: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  scan: (ids?: string[]) => Promise<void>;
  rescan: (ids: string[]) => Promise<void>;
  defaultMode: CleanMode;
  toasts: Toast[];
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [targets, setTargets] = useState<CacheTarget[]>([]);
  const [results, setResults] = useState<Record<string, ScanResult>>({});
  const [scanning, setScanning] = useState<Set<string>>(new Set());
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const targetsRef = useRef<CacheTarget[]>([]);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToasts((x) => [...x, { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 6000);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((x) => x.filter((y) => y.id !== id)), []);

  const refreshSystem = useCallback(async () => {
    try {
      setSystem(await api<SystemInfo>("/api/system"));
    } catch (e) {
      toast({ kind: "error", title: "Could not read system info", body: (e as Error).message });
    }
  }, [toast]);

  const refreshSettings = useCallback(async () => {
    try {
      setSettings(await api<Settings>("/api/settings"));
    } catch {
      /* ignore */
    }
  }, []);

  const refreshTargets = useCallback(async () => {
    const data = await api<{ categories: CategoryInfo[]; targets: CacheTarget[] }>("/api/targets");
    setCategories(data.categories);
    setTargets(data.targets);
    targetsRef.current = data.targets;
    setSelected((prev) => {
      if (prev.size) return new Set([...prev].filter((id) => data.targets.some((t) => t.id === id)));
      return new Set(data.targets.filter((t) => t.exists && !t.defaultOff && t.risk === "safe").map((t) => t.id));
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([refreshSystem(), refreshSettings(), refreshTargets()]);
      } catch (e) {
        toast({ kind: "error", title: "Failed to load", body: (e as Error).message });
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshSystem, refreshSettings, refreshTargets, toast]);

  const runScan = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    setScanning((s) => new Set([...s, ...ids]));
    setScanProgress({ done: 0, total: ids.length });
    let done = 0;
    const queue = [...ids];
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift()!;
        try {
          const r = await api<ScanResult>(`/api/scan?id=${encodeURIComponent(id)}`);
          setResults((x) => ({ ...x, [id]: r }));
        } catch (e) {
          setResults((x) => ({
            ...x,
            [id]: { targetId: id, size: 0, fileCount: 0, skippedCount: 0, skippedReasons: {}, largest: [], durationMs: 0, runningProcesses: [], error: (e as Error).message },
          }));
        } finally {
          done++;
          setScanProgress({ done, total: ids.length });
          setScanning((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
        }
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    setScanProgress(null);
    setLastScanAt(new Date().toISOString());
  }, []);

  const scan = useCallback(
    async (ids?: string[]) => {
      const list = ids ?? targetsRef.current.filter((t) => t.exists).map((t) => t.id);
      await runScan(list);
    },
    [runScan]
  );

  const rescan = useCallback(async (ids: string[]) => runScan(ids), [runScan]);

  const toggle = useCallback((id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const value = useMemo<AppState>(
    () => ({
      system,
      settings,
      categories,
      targets,
      results,
      scanning,
      scanProgress,
      lastScanAt,
      selected,
      loading,
      setSelected,
      toggle,
      refreshTargets,
      refreshSystem,
      refreshSettings,
      scan,
      rescan,
      defaultMode: settings?.defaultMode ?? "delete",
      toasts,
      toast,
      dismissToast,
    }),
    [system, settings, categories, targets, results, scanning, scanProgress, lastScanAt, selected, loading, toggle, refreshTargets, refreshSystem, refreshSettings, scan, rescan, toasts, toast, dismissToast]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
