import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PermissionItem, PermissionStatus } from "../types";
import { HOME, IS_WIN, PLATFORM, expandTemplate } from "./paths";
import { getSystemInfo } from "./system";

const exec = promisify(execFile);

async function probe(dir: string): Promise<"granted" | "denied" | "missing"> {
  try {
    await fs.readdir(dir);
    return "granted";
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    return code === "EPERM" || code === "EACCES" ? "denied" : "missing";
  }
}

async function writable(dir: string): Promise<boolean> {
  try {
    await fs.access(dir, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Checks what the CleanCache agent is allowed to do on this computer. */
export async function getPermissionStatus(): Promise<PermissionStatus> {
  const items: PermissionItem[] = [];
  const sys = await getSystemInfo();

  const cacheRoot = PLATFORM === "darwin" ? path.join(HOME, "Library", "Caches") : IS_WIN ? expandTemplate("%LOCALAPPDATA%") ?? HOME : path.join(HOME, ".cache");
  const canWrite = await writable(cacheRoot);
  items.push({
    id: "cache-folders",
    title: "Access to your cache folders",
    description: `Read and remove files inside ${cacheRoot}. Granted automatically to your user account.`,
    status: canWrite ? "granted" : "denied",
    optional: false,
    help: canWrite ? undefined : "Run CleanCache from your own user account (not a guest or restricted account).",
  });

  if (PLATFORM === "darwin") {
    // macOS privacy (TCC) protects Safari, Mail & Messages data. Probing a protected folder tells us
    // whether the app that started CleanCache (Terminal, iTerm, VS Code…) has Full Disk Access.
    const probes = [path.join(HOME, "Library", "Safari"), path.join(HOME, "Library", "Mail"), path.join(HOME, "Library", "Containers", "com.apple.Safari")];
    let state: "granted" | "denied" | "missing" = "missing";
    for (const p of probes) {
      const r = await probe(p);
      if (r !== "missing") {
        state = r;
        break;
      }
    }
    items.push({
      id: "full-disk-access",
      title: "Full Disk Access (macOS)",
      description: "Lets CleanCache clean Safari & WebKit caches and protected app containers. Everything else works without it.",
      status: state === "granted" ? "granted" : state === "denied" ? "denied" : "unknown",
      optional: true,
      action: state === "granted" ? undefined : { id: "open-full-disk-access", label: "Open System Settings" },
      help: "In System Settings → Privacy & Security → Full Disk Access, switch ON the app you used to start CleanCache (Terminal, iTerm or VS Code), then restart CleanCache.",
    });
  }

  if (IS_WIN) {
    items.push({
      id: "administrator",
      title: "Administrator rights (Windows)",
      description: "Needed only for Windows Temp, Windows Update downloads, Delivery Optimization and CBS logs.",
      status: sys.isAdmin ? "granted" : "denied",
      optional: true,
      action: sys.isAdmin ? undefined : { id: "restart-as-admin", label: "Restart as Administrator" },
      help: "Windows will show a User Account Control prompt — click Yes. CleanCache restarts in a new window.",
    });
  }

  return { platform: PLATFORM, items };
}

export async function openPermissionSettings(action: string): Promise<{ ok: boolean; message: string }> {
  if (action === "open-full-disk-access" && PLATFORM === "darwin") {
    await exec("open", ["x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"]);
    return { ok: true, message: "System Settings opened. Enable Full Disk Access for your terminal app, then restart CleanCache." };
  }

  if (action === "restart-as-admin" && IS_WIN) {
    const script = process.env.npm_lifecycle_event === "dev" ? "dev" : "start";
    const cwd = process.cwd().replace(/'/g, "''");
    // Shows the Windows UAC prompt. If the user clicks "No", Start-Process fails and we keep running.
    await exec(
      "powershell.exe",
      ["-NoProfile", "-Command", `Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoExit','-Command','Set-Location ''${cwd}''; npm run ${script}'`],
      { windowsHide: true, timeout: 120_000 }
    ).catch(() => {
      throw new Error("Administrator permission was not granted.");
    });
    // hand the port over to the elevated instance
    setTimeout(() => process.exit(0), 1500);
    return { ok: true, message: "Restarting with Administrator rights… reconnect in a few seconds." };
  }

  throw new Error("This action is not available on this computer.");
}
