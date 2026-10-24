import fs from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";
import { TARGETS, getTargetDef } from "../targets";
import type { CacheTarget, CacheTargetDef, ScanResult, Settings } from "../types";
import { PLATFORM, expandGlobs, expandTemplate, isInside, normalizeForCompare } from "./paths";
import { fileRefusalReason, globToRegex, isRootAllowed, pathRefusalReason, type SkipReason } from "./safety";

const MAX_FILES_PER_TARGET = 750_000;
const CONCURRENCY = 48;

/* ───────────────────────────── target resolution ───────────────────────────── */

const rootCache = new Map<string, { at: number; roots: string[] }>();

export async function resolveRoots(def: CacheTargetDef): Promise<string[]> {
  const cached = rootCache.get(def.id);
  if (cached && Date.now() - cached.at < 30_000) return cached.roots;
  const templates = def.paths[PLATFORM] ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of templates) {
    const expanded = expandTemplate(t);
    if (!expanded) continue;
    for (const p of await expandGlobs(expanded)) {
      let real = p;
      try {
        const st = await fs.lstat(p);
        if (st.isSymbolicLink()) real = await fs.realpath(p);
        const rst = await fs.stat(real);
        if (!rst.isDirectory()) continue;
      } catch {
        continue;
      }
      if (!isRootAllowed(real)) continue; // defense in depth
      const key = normalizeForCompare(real);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(real);
    }
  }
  rootCache.set(def.id, { at: Date.now(), roots: out });
  return out;
}

export function targetsForPlatform(settings?: Settings): CacheTargetDef[] {
  return TARGETS.filter((t) => t.platforms.includes(PLATFORM) && !(settings?.disabledTargets ?? []).includes(t.id));
}

export async function listTargets(settings: Settings): Promise<CacheTarget[]> {
  const defs = targetsForPlatform(settings);
  return Promise.all(
    defs.map(async (d) => {
      const roots = await resolveRoots(d);
      const { paths: _p, ...rest } = d;
      return { ...rest, resolvedPaths: roots, exists: roots.length > 0 };
    })
  );
}

/** Roots of all OTHER targets — so a parent target (e.g. ~/Library/Caches) never double-counts a child target. */
async function otherRoots(def: CacheTargetDef): Promise<Set<string>> {
  const set = new Set<string>();
  for (const other of targetsForPlatform()) {
    if (other.id === def.id) continue;
    for (const r of await resolveRoots(other)) set.add(normalizeForCompare(r));
  }
  return set;
}

/* ───────────────────────────── walking ───────────────────────────── */

export interface WalkContext {
  def: CacheTargetDef;
  roots: string[];
  settings: Settings;
  /** if provided, the walk stops descending at these (normalized) paths */
  skipDirs: Set<string>;
  minAgeMs: number;
  patterns: RegExp[] | null;
  excludeNames: Set<string>;
}

export interface WalkStats {
  size: number;
  fileCount: number;
  skippedCount: number;
  skippedReasons: Record<string, number>;
  truncated: boolean;
  dirs: string[];
}

export async function buildContext(defOrId: CacheTargetDef | string, settings: Settings): Promise<WalkContext | null> {
  const def = typeof defOrId === "string" ? getTargetDef(defOrId) : defOrId;
  if (!def || !def.platforms.includes(PLATFORM)) return null;
  const roots = await resolveRoots(def);
  const minAgeHours = Math.max(settings.minAgeHours ?? 0, def.minAgeHours ?? 0);
  return {
    def,
    roots,
    settings,
    skipDirs: await otherRoots(def),
    minAgeMs: minAgeHours * 3_600_000,
    patterns: def.filePatterns?.length ? def.filePatterns.map(globToRegex) : null,
    excludeNames: new Set((def.excludeNames ?? []).map((n) => n.toLowerCase())),
  };
}

function bump(stats: WalkStats, reason: SkipReason) {
  stats.skippedCount++;
  stats.skippedReasons[reason] = (stats.skippedReasons[reason] ?? 0) + 1;
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/**
 * Walk every root of a target and call `onFile` for each file that passed ALL safety checks.
 * Symlinks are never followed. Sockets / devices are skipped.
 */
export async function walkTarget(
  ctx: WalkContext,
  onFile: (file: string, st: Stats) => Promise<void> | void
): Promise<WalkStats> {
  const stats: WalkStats = { size: 0, fileCount: 0, skippedCount: 0, skippedReasons: {}, truncated: false, dirs: [] };
  const now = Date.now();
  const allowedRoots = ctx.roots;
  const excluded = ctx.settings.excludedPaths ?? [];

  const stack: { dir: string; depth: number }[] = ctx.roots.map((r) => ({ dir: r, depth: 0 }));
  while (stack.length) {
    if (stats.fileCount >= MAX_FILES_PER_TARGET) {
      stats.truncated = true;
      break;
    }
    const { dir, depth } = stack.pop()!;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (e: unknown) {
      const code = (e as NodeJS.ErrnoException).code;
      if (depth > 0) bump(stats, code === "EBUSY" ? "in-use" : "permission-denied");
      continue;
    }
    if (depth > 0) stats.dirs.push(dir);

    await pool(entries, CONCURRENCY, async (entry) => {
      const full = path.join(dir, entry.name);
      if (depth === 0 && ctx.excludeNames.has(entry.name.toLowerCase())) return bump(stats, "excluded-name");
      if (ctx.skipDirs.has(normalizeForCompare(full))) return bump(stats, "covered-by-other-target");

      const refusal = pathRefusalReason(full, { allowedRoots, excludedPaths: excluded });
      if (refusal) return bump(stats, refusal);

      let st: Stats;
      try {
        st = await fs.lstat(full);
      } catch {
        return bump(stats, "permission-denied");
      }

      if (st.isDirectory()) {
        stack.push({ dir: full, depth: depth + 1 });
        return;
      }
      if (!st.isFile() && !st.isSymbolicLink()) return bump(stats, "special-file");

      const fRefusal = fileRefusalReason(full, ctx.def.protectUserFileTypes);
      if (fRefusal) return bump(stats, fRefusal);
      if (ctx.patterns && !ctx.patterns.some((re) => re.test(entry.name))) return bump(stats, "pattern-mismatch");
      if (ctx.minAgeMs > 0 && now - Math.max(st.mtimeMs, st.ctimeMs) < ctx.minAgeMs) return bump(stats, "too-recent");

      stats.fileCount++;
      stats.size += st.isSymbolicLink() ? 0 : st.size;
      await onFile(full, st);
    });
  }
  return stats;
}

/** Remove now-empty directories (deepest first). The target roots themselves are always kept. */
export async function pruneEmptyDirs(dirs: string[], roots: string[]) {
  const sorted = [...new Set(dirs)].sort((a, b) => b.length - a.length);
  for (const d of sorted) {
    if (!roots.some((r) => isInside(d, r))) continue;
    try {
      await fs.rmdir(d); // fails harmlessly with ENOTEMPTY
    } catch {
      /* keep */
    }
  }
}

/* ───────────────────────────── scan ───────────────────────────── */

export async function scanTarget(id: string, settings: Settings, runningProcesses: string[]): Promise<ScanResult> {
  const started = Date.now();
  const ctx = await buildContext(id, settings);
  if (!ctx) {
    return { targetId: id, size: 0, fileCount: 0, skippedCount: 0, skippedReasons: {}, largest: [], durationMs: 0, runningProcesses: [], error: "Unknown target" };
  }
  const largestDirs = new Map<string, number>();
  const stats = await walkTarget(ctx, (file, st) => {
    // aggregate by first-level child so the UI can show "what is big"
    const root = ctx.roots.find((r) => isInside(file, r))!;
    const rel = path.relative(root, file).split(path.sep)[0];
    const key = path.join(root, rel);
    largestDirs.set(key, (largestDirs.get(key) ?? 0) + st.size);
  });
  const largest = [...largestDirs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([p, size]) => ({ path: p, size }));
  return {
    targetId: id,
    size: stats.size,
    fileCount: stats.fileCount,
    skippedCount: stats.skippedCount,
    skippedReasons: stats.skippedReasons,
    largest,
    durationMs: Date.now() - started,
    runningProcesses,
    truncated: stats.truncated,
  };
}
