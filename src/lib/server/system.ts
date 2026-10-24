import os from "node:os";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SystemInfo } from "../types";
import { APP_DIR, HOME, IS_WIN, PLATFORM } from "./paths";

const exec = promisify(execFile);

/* ───────── running processes (used to warn before cleaning an open app's cache) ───────── */

let procCache: { at: number; names: string[] } | null = null;

export async function runningProcessNames(): Promise<string[]> {
  if (procCache && Date.now() - procCache.at < 5000) return procCache.names;
  let names: string[] = [];
  try {
    if (IS_WIN) {
      const { stdout } = await exec("tasklist", ["/fo", "csv", "/nh"], { windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 8000 });
      names = stdout
        .split(/\r?\n/)
        .map((l) => l.split('","')[0]?.replace(/^"/, "").replace(/\.exe$/i, "").toLowerCase())
        .filter(Boolean) as string[];
    } else {
      const { stdout } = await exec("ps", ["-axco", "comm"], { maxBuffer: 8 * 1024 * 1024, timeout: 8000 });
      names = stdout.split("\n").slice(1).map((l) => l.trim().toLowerCase()).filter(Boolean);
    }
  } catch {
    names = [];
  }
  names = [...new Set(names)];
  procCache = { at: Date.now(), names };
  return names;
}

export function matchRunning(processNames: string[] | undefined, running: string[]): string[] {
  if (!processNames?.length) return [];
  const hits = new Set<string>();
  for (const want of processNames) {
    for (const r of running) {
      // ignore our own runtime
      if (r === "node") continue;
      if (r === want || r.startsWith(want + " ") || r.startsWith(want + ".")) hits.add(want);
    }
  }
  return [...hits];
}

/* ───────── admin detection ───────── */

let adminCache: boolean | null = null;
async function isAdmin(): Promise<boolean> {
  if (adminCache !== null) return adminCache;
  if (IS_WIN) {
    try {
      await exec("net", ["session"], { windowsHide: true, timeout: 5000 });
      adminCache = true;
    } catch {
      adminCache = false;
    }
  } else {
    adminCache = typeof process.getuid === "function" && process.getuid() === 0;
  }
  return adminCache;
}

/* ───────── system info ───────── */

export async function getSystemInfo(): Promise<SystemInfo> {
  const cpus = os.cpus();
  let disk: SystemInfo["disk"] = null;
  const diskPath = IS_WIN ? (process.env.SystemDrive || "C:") + "\\" : PLATFORM === "darwin" ? "/System/Volumes/Data" : "/";
  for (const p of [diskPath, HOME]) {
    try {
      const s = await fs.statfs(p);
      const total = s.blocks * s.bsize;
      const free = s.bavail * s.bsize;
      disk = { path: p, total, free, used: total - free };
      break;
    } catch {
      /* try next */
    }
  }
  let platformLabel = PLATFORM === "darwin" ? "macOS" : PLATFORM === "win32" ? "Windows" : "Linux";
  if (PLATFORM === "darwin") {
    try {
      const { stdout } = await exec("sw_vers", ["-productVersion"], { timeout: 3000 });
      platformLabel = `macOS ${stdout.trim()}`;
    } catch {
      /* ignore */
    }
  } else if (IS_WIN) {
    const build = Number(os.release().split(".")[2] ?? 0);
    platformLabel = build >= 22000 ? "Windows 11" : "Windows 10";
  }
  return {
    platform: PLATFORM,
    platformLabel,
    release: os.release(),
    hostname: os.hostname(),
    username: os.userInfo().username,
    homeDir: HOME,
    arch: os.arch(),
    cpuModel: cpus[0]?.model?.trim() ?? "Unknown CPU",
    cpuCores: cpus.length,
    loadAvg: os.loadavg(),
    totalMem: os.totalmem(),
    freeMem: os.freemem(),
    uptimeSec: os.uptime(),
    disk,
    isAdmin: await isAdmin(),
    appDataDir: APP_DIR,
  };
}
