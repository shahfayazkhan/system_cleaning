import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import type { Platform } from "../types";

export const PLATFORM: Platform =
  process.platform === "win32" ? "win32" : process.platform === "darwin" ? "darwin" : "linux";

export const IS_WIN = PLATFORM === "win32";
/** APFS (macOS default) and NTFS are case-insensitive, so compare paths case-insensitively there. */
export const CASE_INSENSITIVE = PLATFORM !== "linux";

export const HOME = os.homedir();

/** Where this app keeps its own settings, history and quarantine. */
export const APP_DIR = path.join(HOME, ".clean-cache-app");
export const QUARANTINE_DIR = path.join(APP_DIR, "quarantine");

let cachedSid: string | null | undefined;
function currentUserSid(): string | null {
  if (cachedSid !== undefined) return cachedSid;
  cachedSid = null;
  if (!IS_WIN) return cachedSid;
  try {
    const out = execFileSync("whoami", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8", windowsHide: true, timeout: 5000 });
    const m = out.match(/"(S-1-[0-9-]+)"/);
    if (m) cachedSid = m[1];
  } catch {
    /* ignore */
  }
  return cachedSid;
}

function tokens(): Record<string, string | undefined> {
  const env = process.env;
  return {
    LOCALAPPDATA: env.LOCALAPPDATA || (IS_WIN ? path.join(HOME, "AppData", "Local") : undefined),
    APPDATA: env.APPDATA || (IS_WIN ? path.join(HOME, "AppData", "Roaming") : undefined),
    TEMP: env.TEMP || env.TMP || os.tmpdir(),
    TMPDIR: os.tmpdir(),
    WINDIR: env.WINDIR || env.SystemRoot || (IS_WIN ? "C:\\Windows" : undefined),
    PROGRAMDATA: env.PROGRAMDATA || env.ALLUSERSPROFILE || (IS_WIN ? "C:\\ProgramData" : undefined),
    SYSTEMDRIVE: env.SystemDrive || (IS_WIN ? "C:" : undefined),
    USERPROFILE: HOME,
    USERSID: IS_WIN ? currentUserSid() ?? undefined : undefined,
  };
}

/** Replace ~ and %TOKEN% placeholders. Returns null if a token is unknown on this machine. */
export function expandTemplate(template: string): string | null {
  let p = template;
  if (p === "~" || p.startsWith("~/") || p.startsWith("~\\")) p = HOME + p.slice(1);
  const t = tokens();
  let missing = false;
  p = p.replace(/%([A-Z_]+)%/g, (_m, name: string) => {
    const v = t[name];
    if (!v) missing = true;
    return v ?? "";
  });
  if (missing) return null;
  return path.normalize(p);
}

function segmentToRegex(seg: string): RegExp {
  const escaped = seg.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, CASE_INSENSITIVE ? "i" : "");
}

/** Expand `*` wildcards that appear inside path segments. Only existing paths are returned. */
export async function expandGlobs(p: string): Promise<string[]> {
  if (!p.includes("*")) return [p];
  const parsed = path.parse(p);
  const rest = p.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = [parsed.root];
  for (const seg of rest) {
    const next: string[] = [];
    for (const base of current) {
      if (seg.includes("*") || seg.includes("?")) {
        const re = segmentToRegex(seg);
        try {
          const entries = await fs.readdir(base, { withFileTypes: true });
          for (const e of entries) if (e.isDirectory() && re.test(e.name)) next.push(path.join(base, e.name));
        } catch {
          /* parent missing / no permission */
        }
      } else {
        next.push(path.join(base, seg));
      }
    }
    current = next;
    if (!current.length) break;
  }
  return current;
}

export function normalizeForCompare(p: string): string {
  let n = path.resolve(p);
  if (n.length > 1 && (n.endsWith(path.sep))) n = n.slice(0, -1);
  return CASE_INSENSITIVE ? n.toLowerCase() : n;
}

/** true when `child` is strictly inside `parent` (not equal). */
export function isInside(child: string, parent: string): boolean {
  const c = normalizeForCompare(child);
  const p = normalizeForCompare(parent);
  if (c === p) return false;
  const rel = path.relative(p, c);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export function isSameOrInside(child: string, parent: string): boolean {
  return normalizeForCompare(child) === normalizeForCompare(parent) || isInside(child, parent);
}

/** Expand "~" that the user typed in the UI (settings / project folder). */
export function expandUserPath(input: string): string {
  const trimmed = input.trim().replace(/^["']|["']$/g, "");
  return expandTemplate(trimmed) ?? path.resolve(trimmed);
}
