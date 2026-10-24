/**
 * Shared types used by both the server (API routes) and the client (UI).
 * Keep this file free of Node.js imports so it can be bundled for the browser.
 */

export type Platform = "darwin" | "win32" | "linux";

/**
 * Risk levels decide how much confirmation the user must give.
 *  - safe:     pure caches that apps rebuild automatically. One click confirm.
 *  - moderate: caches that cost time/bandwidth to rebuild (re-download, re-index)
 *              or that may sign you out of nothing but need apps closed. Checkbox confirm.
 *  - critical: large regenerable data that you might still want (AI models, Trash,
 *              Xcode archives, node_modules…). Must type a confirmation phrase.
 */
export type RiskLevel = "safe" | "moderate" | "critical";

export type CategoryId =
  | "system"
  | "browser"
  | "developer"
  | "ai"
  | "apps"
  | "logs"
  | "trash";

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  description: string;
}

export interface CacheTargetDef {
  id: string;
  name: string;
  description: string;
  category: CategoryId;
  risk: RiskLevel;
  platforms: Platform[];
  /** Path templates. Supports ~, %ENV% tokens and `*` wildcard segments. */
  paths: Partial<Record<Platform, string[]>>;
  /** Only remove entries older than this many hours (overrides global minimum when larger). */
  minAgeHours?: number;
  /** Only remove files whose name matches one of these simple glob patterns (e.g. "thumbcache_*.db"). */
  filePatterns?: string[];
  /** Child folder/file names that are never touched inside this target (e.g. iCloud sync state). */
  excludeNames?: string[];
  /** Skip images/documents/videos inside this target (used for temp folders that may hold user files). */
  protectUserFileTypes?: boolean;
  /** Process names (lower-case, without .exe) that should be closed before cleaning. */
  processNames?: string[];
  /** Shown in the confirmation dialog. */
  warning?: string;
  /** What happens after cleaning — reassures the user. */
  regenerates?: string;
  /** Needs Administrator / elevated rights to clean fully. */
  requiresAdmin?: boolean;
  /** Not selected by default in the UI. */
  defaultOff?: boolean;
}

/** A target as returned to the client (paths already resolved for this machine). */
export interface CacheTarget extends Omit<CacheTargetDef, "paths"> {
  resolvedPaths: string[];
  exists: boolean;
}

export interface ScanEntrySample {
  path: string;
  size: number;
}

export interface ScanResult {
  targetId: string;
  size: number;
  fileCount: number;
  skippedCount: number;
  skippedReasons: Record<string, number>;
  largest: ScanEntrySample[];
  durationMs: number;
  runningProcesses: string[];
  error?: string;
  truncated?: boolean;
}

export type CleanMode = "delete" | "quarantine";

export interface CleanRequest {
  targetIds: string[];
  mode: CleanMode;
  dryRun?: boolean;
  /** ids of moderate targets the user explicitly acknowledged */
  acknowledged: string[];
  /** map of critical target id -> typed confirmation phrase */
  confirmations: Record<string, string>;
  /** allow cleaning while the related app is running (user confirmed) */
  ignoreRunning?: string[];
}

export interface CleanTargetResult {
  targetId: string;
  name: string;
  freed: number;
  removedFiles: number;
  skipped: number;
  errors: number;
  errorSamples: string[];
  status: "done" | "partial" | "blocked" | "skipped";
  message?: string;
}

export interface CleanResponse {
  id: string;
  startedAt: string;
  finishedAt: string;
  mode: CleanMode;
  dryRun: boolean;
  totalFreed: number;
  results: CleanTargetResult[];
}

export interface HistoryEntry {
  id: string;
  date: string;
  mode: CleanMode;
  dryRun: boolean;
  totalFreed: number;
  targets: { id: string; name: string; freed: number; files: number; status: string }[];
  source: "cleaner" | "projects";
}

export interface QuarantineBatch {
  id: string;
  createdAt: string;
  expiresAt: string;
  totalSize: number;
  itemCount: number;
  targets: string[];
}

export interface Settings {
  /** Global minimum file age in hours. Files modified more recently are left alone. */
  minAgeHours: number;
  defaultMode: CleanMode;
  quarantineRetentionDays: number;
  /** Absolute paths the cleaner must never touch (in addition to the built-in protected list). */
  excludedPaths: string[];
  /** Skip targets whose app is running instead of warning. */
  skipRunningApps: boolean;
  /** Hidden target ids */
  disabledTargets: string[];
}

export interface SystemInfo {
  platform: Platform;
  platformLabel: string;
  release: string;
  hostname: string;
  username: string;
  homeDir: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  loadAvg: number[];
  totalMem: number;
  freeMem: number;
  uptimeSec: number;
  disk: { path: string; total: number; free: number; used: number } | null;
  isAdmin: boolean;
  appDataDir: string;
}

export interface ProjectCacheItem {
  path: string;
  kind: string;
  label: string;
  risk: RiskLevel;
  size: number;
  fileCount: number;
  projectRoot: string;
}

export const CONFIRM_PHRASE = "CLEAN";

export type PermissionState = "granted" | "denied" | "unknown" | "optional";

export interface PermissionItem {
  id: string;
  title: string;
  description: string;
  status: PermissionState;
  /** true = cleaning works without it, but some locations will be skipped */
  optional: boolean;
  action?: { id: string; label: string };
  help?: string;
}

export interface PermissionStatus {
  platform: Platform;
  items: PermissionItem[];
}
