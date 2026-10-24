import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { CONFIRM_PHRASE, type CleanMode, type ProjectCacheItem, type RiskLevel } from "../types";
import { HOME, isInside, isSameOrInside, normalizeForCompare } from "./paths";
import { pathRefusalReason, SYSTEM_PROTECTED } from "./safety";
import { QuarantineWriter } from "./quarantine";
import { addHistory, getSettings } from "./store";

/**
 * Developer project scanner: finds build artefacts & caches INSIDE a folder you choose
 * (e.g. ~/Projects). Every rule requires a "marker" file next to the folder so that, for
 * example, a folder simply named "build" is only touched when it really belongs to a
 * Gradle/Flutter project — never your own folder that happens to be called "build".
 */

interface Rule {
  kind: string;
  label: string;
  /** directory name (or "a/b" sub-path) to match */
  name: string;
  risk: RiskLevel;
  /** at least one of these must exist in the parent directory */
  markers?: string[];
  /** marker suffix (e.g. ".csproj") */
  markerExt?: string[];
}

const RULES: Rule[] = [
  { kind: "node_modules", label: "node_modules (npm install restores)", name: "node_modules", risk: "critical", markers: ["package.json"] },
  { kind: "next", label: "Next.js build (.next)", name: ".next", risk: "safe", markers: ["package.json"] },
  { kind: "nuxt", label: "Nuxt build (.nuxt / .output)", name: ".nuxt", risk: "safe", markers: ["package.json"] },
  { kind: "svelte", label: "SvelteKit (.svelte-kit)", name: ".svelte-kit", risk: "safe", markers: ["package.json"] },
  { kind: "turbo", label: "Turborepo cache (.turbo)", name: ".turbo", risk: "safe", markers: ["package.json", "turbo.json"] },
  { kind: "parcel", label: "Parcel cache", name: ".parcel-cache", risk: "safe", markers: ["package.json"] },
  { kind: "angular", label: "Angular cache", name: ".angular", risk: "safe", markers: ["angular.json"] },
  { kind: "expo", label: "Expo cache (.expo)", name: ".expo", risk: "safe", markers: ["package.json", "app.json"] },
  { kind: "coverage", label: "Test coverage reports", name: "coverage", risk: "safe", markers: ["package.json"] },
  { kind: "pycache", label: "__pycache__", name: "__pycache__", risk: "safe" },
  { kind: "pytest", label: ".pytest_cache", name: ".pytest_cache", risk: "safe" },
  { kind: "mypy", label: ".mypy_cache", name: ".mypy_cache", risk: "safe" },
  { kind: "ruff", label: ".ruff_cache", name: ".ruff_cache", risk: "safe" },
  { kind: "tox", label: ".tox environments", name: ".tox", risk: "moderate", markers: ["tox.ini", "pyproject.toml", "setup.py"] },
  { kind: "venv", label: "Python virtualenv (.venv)", name: ".venv", risk: "critical", markers: ["requirements.txt", "pyproject.toml", "setup.py", "Pipfile"] },
  { kind: "rust", label: "Rust target/", name: "target", risk: "moderate", markers: ["Cargo.toml"] },
  { kind: "maven-target", label: "Maven target/", name: "target", risk: "moderate", markers: ["pom.xml"] },
  { kind: "gradle-build", label: "Gradle / Android build/", name: "build", risk: "moderate", markers: ["build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"] },
  { kind: "gradle-local", label: "Project .gradle cache", name: ".gradle", risk: "safe", markers: ["build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts", "gradlew"] },
  { kind: "flutter-build", label: "Flutter build/", name: "build", risk: "moderate", markers: ["pubspec.yaml"] },
  { kind: "dart-tool", label: "Flutter .dart_tool", name: ".dart_tool", risk: "safe", markers: ["pubspec.yaml"] },
  { kind: "pods", label: "CocoaPods Pods/", name: "Pods", risk: "moderate", markers: ["Podfile"] },
  { kind: "dotnet-bin", label: ".NET bin/", name: "bin", risk: "moderate", markerExt: [".csproj", ".fsproj", ".vbproj"] },
  { kind: "dotnet-obj", label: ".NET obj/", name: "obj", risk: "safe", markerExt: [".csproj", ".fsproj", ".vbproj"] },
  { kind: "hardhat", label: "Hardhat cache & artifacts", name: "cache", risk: "safe", markers: ["hardhat.config.js", "hardhat.config.ts"] },
  { kind: "hardhat-artifacts", label: "Hardhat artifacts/", name: "artifacts", risk: "moderate", markers: ["hardhat.config.js", "hardhat.config.ts"] },
  { kind: "foundry", label: "Foundry out/ & cache/", name: "out", risk: "moderate", markers: ["foundry.toml"] },
  { kind: "anchor", label: "Anchor / Solana target/", name: "target", risk: "moderate", markers: ["Anchor.toml"] },
  { kind: "truffle", label: "Truffle build/", name: "build", risk: "moderate", markers: ["truffle-config.js", "truffle.js"] },
];

const SKIP_DESCEND = new Set([".git", ".hg", ".svn", "node_modules", ".Trash", "Library", "AppData", "Applications"]);
const MAX_DEPTH = 7;
const MAX_ITEMS = 3000;

async function matchRule(dir: string, name: string, siblings: Set<string>): Promise<Rule | null> {
  for (const r of RULES) {
    if (r.name !== name) continue;
    if (r.markers && !r.markers.some((m) => siblings.has(m))) continue;
    if (r.markerExt && ![...siblings].some((s) => r.markerExt!.some((ext) => s.toLowerCase().endsWith(ext)))) continue;
    return r;
  }
  return null;
}

async function dirSize(dir: string): Promise<{ size: number; files: number }> {
  let size = 0;
  let files = 0;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop()!;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      continue;
    }
    await Promise.all(
      entries.map(async (e) => {
        const full = path.join(d, e.name);
        if (e.isDirectory()) stack.push(full);
        else if (e.isFile()) {
          try {
            size += (await fs.lstat(full)).size;
            files++;
          } catch {
            /* ignore */
          }
        }
      })
    );
  }
  return { size, files };
}

/** Validate a project root chosen by the user. */
export function validateProjectRoot(root: string): string | null {
  const abs = path.resolve(root);
  if (!isSameOrInside(abs, HOME) || normalizeForCompare(abs) === normalizeForCompare(HOME)) {
    return "Choose a folder inside your home folder (e.g. ~/Projects), not the home folder itself.";
  }
  for (const p of SYSTEM_PROTECTED) {
    if (normalizeForCompare(p) === normalizeForCompare(abs) && normalizeForCompare(p) !== normalizeForCompare(HOME)) return "That folder is protected.";
  }
  return null;
}

export async function scanProjects(root: string): Promise<{ items: ProjectCacheItem[]; truncated: boolean }> {
  const settings = await getSettings();
  const items: ProjectCacheItem[] = [];
  const stack: { dir: string; depth: number }[] = [{ dir: root, depth: 0 }];
  let truncated = false;
  while (stack.length) {
    if (items.length >= MAX_ITEMS) {
      truncated = true;
      break;
    }
    const { dir, depth } = stack.pop()!;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    const siblings = new Set(entries.map((e) => e.name));
    for (const e of entries) {
      if (!e.isDirectory()) continue; // symlinks are never followed
      const full = path.join(dir, e.name);
      const rule = await matchRule(dir, e.name, siblings);
      if (rule) {
        if (pathRefusalReason(full, { allowedRoots: [root], excludedPaths: settings.excludedPaths, allowUserData: true })) continue;
        const { size, files } = await dirSize(full);
        items.push({ path: full, kind: rule.kind, label: rule.label, risk: rule.risk, size, fileCount: files, projectRoot: dir });
        continue; // never descend into a matched folder
      }
      if (depth + 1 > MAX_DEPTH || SKIP_DESCEND.has(e.name) || (e.name.startsWith(".") && e.name !== ".github")) continue;
      stack.push({ dir: full, depth: depth + 1 });
    }
  }
  items.sort((a, b) => b.size - a.size);
  return { items, truncated };
}

/** Re-validate a path received from the browser — it must still match a rule. */
async function revalidate(p: string, root: string, excluded: string[]): Promise<{ rule: Rule } | { error: string }> {
  const abs = path.resolve(p);
  if (!isInside(abs, root)) return { error: "Outside the selected folder" };
  if (pathRefusalReason(abs, { allowedRoots: [root], excludedPaths: excluded, allowUserData: true })) return { error: "Protected path" };
  try {
    const st = await fs.lstat(abs);
    if (!st.isDirectory()) return { error: "Not a folder" };
  } catch {
    return { error: "No longer exists" };
  }
  const parent = path.dirname(abs);
  const siblings = new Set(await fs.readdir(parent).catch(() => [] as string[]));
  const rule = await matchRule(parent, path.basename(abs), siblings);
  if (!rule) return { error: "Not a recognised cache/build folder" };
  return { rule };
}

export async function cleanProjects(input: {
  root: string;
  paths: string[];
  mode: CleanMode;
  dryRun?: boolean;
  acknowledged?: boolean;
  confirmation?: string;
}) {
  const settings = await getSettings();
  const root = path.resolve(input.root);
  const rootErr = validateProjectRoot(root);
  if (rootErr) throw new Error(rootErr);
  const quarantine = !input.dryRun && input.mode === "quarantine" ? new QuarantineWriter(settings.quarantineRetentionDays) : null;
  const results: { path: string; freed: number; status: "done" | "blocked" | "error"; message?: string }[] = [];

  for (const p of [...new Set(input.paths)]) {
    const v = await revalidate(p, root, settings.excludedPaths);
    if ("error" in v) {
      results.push({ path: p, freed: 0, status: "blocked", message: v.error });
      continue;
    }
    if (v.rule.risk === "moderate" && !input.acknowledged) {
      results.push({ path: p, freed: 0, status: "blocked", message: "Needs confirmation" });
      continue;
    }
    if (v.rule.risk === "critical" && (input.confirmation ?? "").trim().toUpperCase() !== CONFIRM_PHRASE) {
      results.push({ path: p, freed: 0, status: "blocked", message: `Type ${CONFIRM_PHRASE} to confirm` });
      continue;
    }
    const { size } = await dirSize(p);
    if (input.dryRun) {
      results.push({ path: p, freed: size, status: "done" });
      continue;
    }
    try {
      if (quarantine) await quarantine.add(p, size, `project:${v.rule.kind}`, true);
      else await fs.rm(p, { recursive: true, force: true, maxRetries: 2 });
      results.push({ path: p, freed: size, status: "done" });
    } catch (e) {
      results.push({ path: p, freed: 0, status: "error", message: (e as Error).message });
    }
  }
  const batch = quarantine ? await quarantine.finalize() : null;
  const totalFreed = results.reduce((a, b) => a + b.freed, 0);
  if (!input.dryRun && totalFreed > 0) {
    await addHistory({
      id: batch?.id ?? crypto.randomUUID(),
      date: new Date().toISOString(),
      mode: input.mode,
      dryRun: false,
      totalFreed,
      source: "projects",
      targets: results
        .filter((r) => r.status === "done")
        .map((r) => ({ id: r.path, name: path.relative(root, r.path), freed: r.freed, files: 1, status: r.status })),
    });
  }
  return { totalFreed, results, dryRun: !!input.dryRun, mode: input.mode };
}
