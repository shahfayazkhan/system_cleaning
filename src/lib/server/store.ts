import fs from "node:fs/promises";
import path from "node:path";
import type { HistoryEntry, Settings } from "../types";
import { APP_DIR } from "./paths";

const SETTINGS_FILE = path.join(APP_DIR, "settings.json");
const HISTORY_FILE = path.join(APP_DIR, "history.json");

export const DEFAULT_SETTINGS: Settings = {
  minAgeHours: 0,
  defaultMode: "delete",
  quarantineRetentionDays: 7,
  excludedPaths: [],
  skipRunningApps: false,
  disabledTargets: [],
};

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

export async function getSettings(): Promise<Settings> {
  const s = await readJson<Partial<Settings>>(SETTINGS_FILE, {});
  return { ...DEFAULT_SETTINGS, ...s };
}

export async function saveSettings(input: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = {
    minAgeHours: clamp(Number(input.minAgeHours ?? current.minAgeHours), 0, 24 * 365),
    defaultMode: input.defaultMode === "quarantine" ? "quarantine" : input.defaultMode === "delete" ? "delete" : current.defaultMode,
    quarantineRetentionDays: clamp(Number(input.quarantineRetentionDays ?? current.quarantineRetentionDays), 1, 90),
    excludedPaths: Array.isArray(input.excludedPaths) ? input.excludedPaths.filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim()) : current.excludedPaths,
    skipRunningApps: typeof input.skipRunningApps === "boolean" ? input.skipRunningApps : current.skipRunningApps,
    disabledTargets: Array.isArray(input.disabledTargets) ? input.disabledTargets.filter((p) => typeof p === "string") : current.disabledTargets,
  };
  await writeJson(SETTINGS_FILE, next);
  return next;
}

function clamp(n: number, min: number, max: number) {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min;
}

export async function getHistory(): Promise<HistoryEntry[]> {
  return readJson<HistoryEntry[]>(HISTORY_FILE, []);
}

export async function addHistory(entry: HistoryEntry) {
  const list = await getHistory();
  list.unshift(entry);
  await writeJson(HISTORY_FILE, list.slice(0, 500));
}

export async function clearHistory() {
  await writeJson(HISTORY_FILE, []);
}
