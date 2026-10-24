import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { QuarantineBatch } from "../types";
import { QUARANTINE_DIR, isInside } from "./paths";

/**
 * Quarantine = "safe delete". Files are MOVED into ~/.clean-cache-app/quarantine/<batch>
 * together with a manifest, so they can be restored with one click until the batch expires.
 * Disk space is only freed when the batch is purged (manually or after the retention period).
 */

interface ManifestItem {
  o: string; // original path
  q: string; // quarantine path (relative to batch dir)
  s: number; // size
  d?: boolean; // whole directory
}
interface Manifest {
  batch: QuarantineBatch;
  items: ManifestItem[];
}

export class QuarantineWriter {
  readonly id: string;
  readonly dir: string;
  private items: ManifestItem[] = [];
  private counter = 0;
  private size = 0;
  private targets = new Set<string>();
  private ready: Promise<void>;

  constructor(private retentionDays: number) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.id = `${stamp}_${crypto.randomBytes(3).toString("hex")}`;
    this.dir = path.join(QUARANTINE_DIR, this.id);
    this.ready = fs.mkdir(path.join(this.dir, "files"), { recursive: true }).then(() => undefined);
  }

  /** Move a file (or whole directory) into quarantine. */
  async add(original: string, size: number, targetId: string, isDir = false) {
    await this.ready;
    const n = this.counter++;
    const bucket = String(Math.floor(n / 1000)).padStart(4, "0");
    const rel = path.join("files", bucket, `${n}_${path.basename(original).slice(0, 80)}`);
    const dest = path.join(this.dir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await moveAcrossDevices(original, dest, isDir);
    this.items.push({ o: original, q: rel, s: size, d: isDir || undefined });
    this.size += size;
    this.targets.add(targetId);
  }

  get itemCount() {
    return this.items.length;
  }

  async finalize(): Promise<QuarantineBatch | null> {
    await this.ready;
    if (!this.items.length) {
      await fs.rm(this.dir, { recursive: true, force: true });
      return null;
    }
    const now = new Date();
    const batch: QuarantineBatch = {
      id: this.id,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.retentionDays * 86_400_000).toISOString(),
      totalSize: this.size,
      itemCount: this.items.length,
      targets: [...this.targets],
    };
    const manifest: Manifest = { batch, items: this.items };
    await fs.writeFile(path.join(this.dir, "manifest.json"), JSON.stringify(manifest), "utf8");
    return batch;
  }
}

async function moveAcrossDevices(src: string, dest: string, isDir: boolean) {
  try {
    await fs.rename(src, dest);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EXDEV") throw e;
    // different volume: copy then remove
    await fs.cp(src, dest, { recursive: isDir, preserveTimestamps: true, verbatimSymlinks: true, errorOnExist: true, force: false });
    await fs.rm(src, { recursive: isDir, force: true });
  }
}

function validBatchId(id: string) {
  return /^[A-Za-z0-9_-]+$/.test(id);
}

async function readManifest(id: string): Promise<Manifest | null> {
  if (!validBatchId(id)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(QUARANTINE_DIR, id, "manifest.json"), "utf8")) as Manifest;
  } catch {
    return null;
  }
}

export async function listBatches(): Promise<QuarantineBatch[]> {
  await purgeExpired();
  let dirs: string[] = [];
  try {
    dirs = await fs.readdir(QUARANTINE_DIR);
  } catch {
    return [];
  }
  const out: QuarantineBatch[] = [];
  for (const d of dirs) {
    const m = await readManifest(d);
    if (m) out.push(m.batch);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function restoreBatch(id: string) {
  const m = await readManifest(id);
  if (!m) throw new Error("Batch not found");
  const dir = path.join(QUARANTINE_DIR, id);
  let restored = 0;
  let conflicts = 0;
  let failed = 0;
  for (const item of m.items) {
    const from = path.join(dir, item.q);
    if (!isInside(from, dir)) {
      failed++;
      continue;
    }
    try {
      await fs.access(item.o);
      conflicts++; // something new already exists there — keep the new one
      continue;
    } catch {
      /* ok, free to restore */
    }
    try {
      await fs.mkdir(path.dirname(item.o), { recursive: true });
      await moveAcrossDevices(from, item.o, !!item.d);
      restored++;
    } catch {
      failed++;
    }
  }
  await fs.rm(dir, { recursive: true, force: true });
  return { restored, conflicts, failed };
}

export async function purgeBatch(id: string) {
  if (!validBatchId(id)) throw new Error("Invalid batch id");
  const dir = path.join(QUARANTINE_DIR, id);
  if (!isInside(dir, QUARANTINE_DIR)) throw new Error("Invalid batch id");
  const m = await readManifest(id);
  await fs.rm(dir, { recursive: true, force: true });
  return { freed: m?.batch.totalSize ?? 0 };
}

let lastPurge = 0;
export async function purgeExpired() {
  if (Date.now() - lastPurge < 60_000) return;
  lastPurge = Date.now();
  let dirs: string[] = [];
  try {
    dirs = await fs.readdir(QUARANTINE_DIR);
  } catch {
    return;
  }
  for (const d of dirs) {
    const m = await readManifest(d);
    if (m && new Date(m.batch.expiresAt).getTime() < Date.now()) await purgeBatch(d).catch(() => undefined);
  }
}
