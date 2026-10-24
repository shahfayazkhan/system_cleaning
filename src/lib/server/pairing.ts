import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { APP_DIR } from "./paths";

/**
 * Pairing = the permission you give a hosted dashboard (e.g. https://your-app.vercel.app)
 * to talk to the CleanCache agent running on THIS computer.
 *
 *  - The request can only be approved on the local /pair page (served from 127.0.0.1),
 *    so a website can never grant itself access.
 *  - Each approved website gets its own random 256-bit token, stored only on this computer
 *    and in that website's browser storage.
 *  - Every request from a paired website must send its Origin AND the matching token.
 *  - You can revoke a website at any time from Settings → Connected dashboards.
 */

export interface Pairing {
  origin: string;
  token: string;
  createdAt: string;
  lastUsedAt?: string;
}

const FILE = path.join(APP_DIR, "pairings.json");
let cache: { mtime: number; list: Pairing[] } | null = null;

function load(): Pairing[] {
  try {
    const st = fs.statSync(FILE);
    if (cache && cache.mtime === st.mtimeMs) return cache.list;
    const list = JSON.parse(fs.readFileSync(FILE, "utf8")) as Pairing[];
    cache = { mtime: st.mtimeMs, list: Array.isArray(list) ? list : [] };
    return cache.list;
  } catch {
    return [];
  }
}

function save(list: Pairing[]) {
  fs.mkdirSync(APP_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, FILE);
  cache = null;
}

/** Normalises and validates an origin. Only https origins (or http://localhost for dev) are accepted. */
export function normalizeOrigin(input: string): string | null {
  try {
    const u = new URL(input);
    if (u.username || u.password || (u.pathname !== "/" && u.pathname !== "")) return null;
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function listPairings(): Omit<Pairing, "token">[] {
  return load().map(({ token: _t, ...rest }) => rest);
}

export function createPairing(origin: string): string {
  const list = load().filter((p) => p.origin !== origin);
  const token = crypto.randomBytes(32).toString("hex");
  list.push({ origin, token, createdAt: new Date().toISOString() });
  save(list);
  return token;
}

export function revokePairing(origin: string) {
  save(load().filter((p) => p.origin !== origin));
}

export function isPairedOrigin(origin: string): boolean {
  return load().some((p) => p.origin === origin);
}

export function verifyPairing(origin: string, token: string | null): boolean {
  if (!token) return false;
  const p = load().find((x) => x.origin === origin);
  if (!p) return false;
  const a = Buffer.from(p.token);
  const b = Buffer.from(token);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const now = Date.now();
  if (!p.lastUsedAt || now - new Date(p.lastUsedAt).getTime() > 60_000) {
    p.lastUsedAt = new Date(now).toISOString();
    try {
      save(load().map((x) => (x.origin === origin ? { ...x, lastUsedAt: p.lastUsedAt } : x)));
    } catch {
      /* best effort */
    }
  }
  return true;
}
