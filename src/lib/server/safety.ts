import path from "node:path";
import { APP_DIR, HOME, IS_WIN, PLATFORM, expandTemplate, isSameOrInside, normalizeForCompare } from "./paths";

/**
 * ──────────────────────────────────────────────────────────────────────────
 *  SAFETY GUARD — every single path is checked here before it is removed.
 * ──────────────────────────────────────────────────────────────────────────
 *
 *  Layer 1  ALLOW-LIST      A path can only be removed if it is strictly inside a
 *                           known cache root (never the root itself).
 *  Layer 2  SYSTEM GUARD    Never touch the OS, installed applications, credentials,
 *                           keychains, SSH/GPG keys, cloud-sync folders, phone backups.
 *  Layer 3  USER-DATA GUARD Never touch Documents / Desktop / Downloads / Pictures /
 *                           Movies / Music / Photos library (for registry targets).
 *  Layer 4  ANCESTOR GUARD  Never remove a folder that CONTAINS any protected path.
 *  Layer 5  FILE-TYPE GUARD Key / wallet / certificate files are never removed anywhere;
 *                           in temp folders, images/videos/documents are also kept.
 *  Layer 6  USER EXCLUSIONS Paths you add in Settings are never touched.
 *  Layer 7  NO SYMLINK FOLLOW  Links are removed as links; their targets are never visited.
 */

const h = (...p: string[]) => path.join(HOME, ...p);

function winPaths(): string[] {
  if (!IS_WIN) return [];
  const sys = (t: string) => expandTemplate(t);
  return [
    sys("%WINDIR%\\System32"),
    sys("%WINDIR%\\SysWOW64"),
    sys("%WINDIR%\\WinSxS"),
    sys("%WINDIR%\\Installer"),
    sys("%WINDIR%\\Boot"),
    sys("%WINDIR%\\Fonts"),
    sys("%WINDIR%\\assembly"),
    sys("%WINDIR%\\Microsoft.NET"),
    sys("%SYSTEMDRIVE%\\Program Files"),
    sys("%SYSTEMDRIVE%\\Program Files (x86)"),
    sys("%PROGRAMDATA%\\Microsoft\\Crypto"),
    sys("%PROGRAMDATA%\\Microsoft\\Windows\\Start Menu"),
    sys("%APPDATA%\\Microsoft\\Credentials"),
    sys("%APPDATA%\\Microsoft\\Protect"),
    sys("%APPDATA%\\Microsoft\\SystemCertificates"),
    sys("%APPDATA%\\Microsoft\\Crypto"),
    sys("%LOCALAPPDATA%\\Microsoft\\Credentials"),
    sys("%LOCALAPPDATA%\\Microsoft\\Vault"),
    sys("%LOCALAPPDATA%\\Packages\\Microsoft.WindowsStore_8wekyb3d8bbwe"),
  ].filter(Boolean) as string[];
}

/** Never removed, never an ancestor of something removed — for ANY operation. */
export const SYSTEM_PROTECTED: string[] = [
  HOME,
  APP_DIR, // our own settings/history (quarantine is managed separately)
  h(".ssh"),
  h(".gnupg"),
  h(".aws"),
  h(".azure"),
  h(".kube"),
  h(".docker"),
  h(".config", "gcloud"),
  h(".config", "solana"),
  h(".bitcoin"),
  h(".ethereum"),
  h(".electrum"),
  h(".local", "share", "keyrings"),
  h(".password-store"),
  h(".git-credentials"),
  h(".npmrc"),
  ...(PLATFORM === "darwin"
    ? [
        "/System",
        "/Applications",
        "/Library",
        "/usr",
        "/bin",
        "/sbin",
        "/private/etc",
        "/private/var/db",
        "/Users",
        "/Volumes",
        h("Applications"),
        h("Library"),
        h("Library", "Keychains"),
        h("Library", "Mobile Documents"),
        h("Library", "CloudStorage"),
        h("Library", "Mail"),
        h("Library", "Messages"),
        h("Library", "Photos"),
        h("Library", "Calendars"),
        h("Library", "Contacts"),
        h("Library", "Safari"),
        h("Library", "Preferences"),
        h("Library", "Accounts"),
        h("Library", "Cookies"),
        h("Library", "Group Containers"),
        h("Library", "Application Support", "MobileSync"),
        h("Library", "Application Support", "AddressBook"),
        h("Library", "Application Support", "Google", "Chrome", "Default", "Login Data"),
      ]
    : []),
  ...(IS_WIN ? [expandTemplate("%WINDIR%") ?? "C:\\Windows", h("AppData"), h("AppData", "Local"), h("AppData", "Roaming"), "C:\\Users"] : []),
  ...(PLATFORM === "linux" ? ["/etc", "/usr", "/bin", "/sbin", "/boot", "/var/lib", "/home"] : []),
  ...winPaths(),
];

/** User content folders. Registry cache targets must never reach into these. */
export const USER_DATA_PROTECTED: string[] = [
  h("Documents"),
  h("Desktop"),
  h("Downloads"),
  h("Pictures"),
  h("Movies"),
  h("Music"),
  h("Videos"),
  h("Public"),
  h("OneDrive"),
  h("Dropbox"),
  h("Google Drive"),
  h("iCloud Drive"),
  h("Creative Cloud Files"),
  h("Projects"),
  h("Sites"),
  h("source"),
  h("repos"),
];

/** Never deleted under any circumstance (keys, wallets, certificates, password DBs). */
const NEVER_DELETE_EXT = new Set([
  ".kdbx", ".kdb", ".keystore", ".jks", ".pem", ".p12", ".pfx", ".key", ".ppk", ".gpg", ".asc",
  ".wallet", ".ovpn", ".mobileprovision", ".cer", ".crt", ".der", ".keychain", ".keychain-db",
]);
const NEVER_DELETE_NAMES = new Set(["wallet.dat", "id_rsa", "id_ed25519", "id_ecdsa", "keystore", ".env", "credentials", "credentials.json", "secrets.json"]);

/** User-created file types — kept when a target has protectUserFileTypes (e.g. Temp folders). */
const USER_FILE_EXT = new Set([
  // images
  ".jpg", ".jpeg", ".png", ".gif", ".heic", ".heif", ".webp", ".tif", ".tiff", ".bmp", ".raw", ".cr2", ".cr3", ".nef", ".arw", ".dng", ".psd", ".ai", ".svg", ".sketch", ".fig", ".xcf",
  // video / audio
  ".mp4", ".mov", ".m4v", ".avi", ".mkv", ".wmv", ".webm", ".mp3", ".wav", ".aac", ".flac", ".m4a", ".aiff",
  // documents
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".xlsm", ".csv", ".ppt", ".pptx", ".pages", ".numbers", ".key", ".odt", ".ods", ".odp", ".rtf", ".txt", ".md", ".epub",
  // archives & installers people download
  ".zip", ".rar", ".7z", ".dmg", ".iso", ".pkg", ".msi",
  // source & databases
  ".sql", ".sqlite", ".db", ".json", ".xml", ".yaml", ".yml",
]);

export type SkipReason =
  | "protected-path"
  | "protected-file-type"
  | "user-file-type"
  | "user-excluded"
  | "too-recent"
  | "pattern-mismatch"
  | "excluded-name"
  | "covered-by-other-target"
  | "in-use"
  | "permission-denied"
  | "special-file";

const SEP = path.sep;
let _norm: { sysExact: string[]; sysSub: string[]; user: string[] } | null = null;
function norm() {
  if (_norm) return _norm;
  _norm = {
    sysExact: [...new Set(SYSTEM_PROTECTED.map(normalizeForCompare))],
    sysSub: [...new Set(SYSTEM_PROTECTED_SUBTREES().map(normalizeForCompare))],
    user: [...new Set(USER_DATA_PROTECTED.map(normalizeForCompare))],
  };
  return _norm;
}
/** a inside-or-equal b, both already normalized */
const within = (a: string, b: string) => a === b || a.startsWith(b.endsWith(SEP) ? b : b + SEP);

export function pathRefusalReason(
  candidate: string,
  opts: { allowedRoots: string[]; excludedPaths: string[]; allowUserData?: boolean }
): SkipReason | null {
  const c = normalizeForCompare(candidate);
  const n = norm();

  // Layer 1 — must be strictly inside an allowed root
  if (!opts.allowedRoots.some((r) => { const nr = normalizeForCompare(r); return c !== nr && within(c, nr); })) return "protected-path";

  // Layer 2/4 — candidate is a protected path, or an ancestor of one
  for (const p of n.sysExact) if (within(p, c)) return "protected-path";
  // Layer 2 — candidate lives inside a fully protected subtree
  for (const p of n.sysSub) if (within(c, p) || within(p, c)) return "protected-path";

  // Layer 3 — user data
  if (!opts.allowUserData) {
    for (const p of n.user) if (within(c, p) || within(p, c)) return "protected-path";
  }

  // Layer 6 — user exclusions
  for (const ex of opts.excludedPaths) {
    const e = normalizeForCompare(ex);
    if (within(c, e) || within(e, c)) return "user-excluded";
  }
  return null;
}

/**
 * Subtrees where nothing inside may be deleted at all (as opposed to SYSTEM_PROTECTED, whose
 * members only must not be deleted *themselves* or *via an ancestor*). e.g. /Library contains
 * /Library/Caches which we may want later, but ~/.ssh contents must never be touched.
 */
let _subtrees: string[] | null = null;
function SYSTEM_PROTECTED_SUBTREES(): string[] {
  if (_subtrees) return _subtrees;
  const list = [
    h(".ssh"), h(".gnupg"), h(".aws"), h(".azure"), h(".kube"), h(".docker"),
    h(".config", "gcloud"), h(".config", "solana"), h(".bitcoin"), h(".ethereum"), h(".electrum"),
    h(".local", "share", "keyrings"), h(".password-store"),
    APP_DIR,
  ];
  if (PLATFORM === "darwin") {
    list.push(
      "/System", "/Applications", "/usr", "/bin", "/sbin", "/private/etc", "/private/var/db",
      h("Applications"),
      h("Library", "Keychains"), h("Library", "Mobile Documents"), h("Library", "CloudStorage"),
      h("Library", "Mail"), h("Library", "Messages"), h("Library", "Photos"), h("Library", "Calendars"),
      h("Library", "Contacts"), h("Library", "Safari"), h("Library", "Preferences"), h("Library", "Accounts"),
      h("Library", "Cookies"), h("Library", "Group Containers"),
      h("Library", "Application Support", "MobileSync"), h("Library", "Application Support", "AddressBook")
    );
  }
  if (IS_WIN) list.push(...winPaths());
  _subtrees = list;
  return list;
}

export function fileRefusalReason(filePath: string, protectUserFileTypes?: boolean): SkipReason | null {
  const base = path.basename(filePath);
  const lower = base.toLowerCase();
  const ext = path.extname(lower);
  if (NEVER_DELETE_NAMES.has(lower) || NEVER_DELETE_EXT.has(ext) || lower.startsWith(".env.")) return "protected-file-type";
  if (protectUserFileTypes && USER_FILE_EXT.has(ext)) return "user-file-type";
  return null;
}

/** Is this target root itself acceptable? (Defense in depth against a bad registry entry.) */
export function isRootAllowed(root: string): boolean {
  const n = normalizeForCompare(root);
  for (const p of SYSTEM_PROTECTED) if (normalizeForCompare(p) === n) return false;
  for (const p of SYSTEM_PROTECTED_SUBTREES()) if (isSameOrInside(root, p)) return false;
  for (const p of USER_DATA_PROTECTED) if (isSameOrInside(root, p)) return false;
  // a root must never be an ancestor of the home folder (e.g. "/" or "C:\Users")
  if (isSameOrInside(HOME, root)) return false;
  // a root must be at least 2 levels deep to avoid catastrophic mistakes
  const depth = path.resolve(root).split(path.sep).filter(Boolean).length;
  return depth >= 2;
}

export function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  "protected-path": "Protected location",
  "protected-file-type": "Key / wallet / certificate file",
  "user-file-type": "Personal file type (photo, document…)",
  "user-excluded": "Excluded in Settings",
  "too-recent": "Modified recently",
  "pattern-mismatch": "Not a cache file",
  "excluded-name": "Sync / system state",
  "covered-by-other-target": "Listed as its own item",
  "in-use": "In use by an app",
  "permission-denied": "No permission",
  "special-file": "Socket / device file",
};
