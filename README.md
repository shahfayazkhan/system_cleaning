# CleanCache — Safe Cache Cleaner for macOS & Windows

A local Next.js app that makes your laptop faster by removing **only regenerable caches** — browser caches, developer tool caches (npm, Gradle, Xcode, pnpm…), AI tool caches (Cursor, Claude, Copilot, Hugging Face, Ollama…), app caches, old logs and temp files.

It **never** touches your documents, photos, downloads, installed apps, keychains, SSH keys or crypto wallets, and it asks you before anything risky.

---

## Quick start

Requires **Node.js 18.18+** (Node 20/22 recommended).

```bash
npm install
npm run build
npm start          # → http://127.0.0.1:4321
```

For development: `npm run dev`.

The server binds to `127.0.0.1` only, so nothing on your network can reach it.

### macOS tip
Some caches, like Safari's, are protected by macOS privacy controls. To clean them, open **System Settings → Privacy & Security → Full Disk Access** and enable your Terminal (or iTerm / VS Code). If you skip this, the app leaves those files alone and lists them as "No permission".

### Windows tip
Windows Temp, Windows Update downloads and CBS logs need Administrator rights. To clean them, run your terminal **as Administrator** before `npm start`. If you don't, those items are skipped safely.

---

## Features

| Page | What it does |
|---|---|
| **Dashboard** | Disk-usage ring, Smart Scan, reclaimable space by category, memory/CPU/uptime, one-click **Quick clean** that only includes *safe* items |
| **Cache Cleaner** | 50+ cache locations grouped by category with risk badges, sizes, largest sub-folders, skipped/protected counts, running-app detection, search and filters |
| **Dev Projects** | Scans a code folder for `node_modules`, `.next`, `build/`, `target/`, `__pycache__`, `.venv`, `Pods/`, `.dart_tool`, `bin/obj`, Hardhat/Foundry/Anchor/Truffle outputs, and more |
| **Quarantine** | "Safe delete": files are moved here instead of being deleted. You can **restore** them for N days, then they are purged automatically |
| **History** | Every cleanup you ran, with a 14-day chart and per-item breakdown |
| **Settings** | Default mode, minimum file age, quarantine retention, skip open apps, **never-touch paths**, hide locations |

Other features: **dry run** (simulate only), sizes measured before cleaning, a per-item minimum file age (for example, temp files are only removed after 48h), and empty folders tidied up after cleaning.

---

## Safety design

Every path goes through `src/lib/server/safety.ts` before it is removed.

1. **Allow-list only.** A file can only be removed if it is *inside* a known cache folder from `src/lib/targets.ts`. The folder itself is kept.
2. **System guard.** The OS, `/Applications`, `Program Files`, `System32`, `WinSxS`, `Windows\Installer`, Keychains, Credentials and Vault, iCloud and OneDrive sync folders, Mail, Messages, Photos and iPhone backups are never touched.
3. **User-data guard.** Documents, Desktop, Downloads, Pictures, Movies, Music, Videos, Dropbox and Google Drive are off-limits for every cache target.
4. **Ancestor guard.** A folder that *contains* a protected path is never removed.
5. **File-type guard.** `.pem`, `.key`, `.p12`, `.keystore`, `.jks`, `.kdbx`, `wallet.dat`, `id_rsa`, `.env*` and similar files are never deleted anywhere. In temp folders, photos, videos and documents are also kept.
6. **No symlink following.** A link is removed as a link. The app never looks at what it points to.
7. **Confirmation levels, enforced on the server:**
   - 🟢 **Safe**: confirm in the review dialog.
   - 🟡 **Confirm** (for example Gradle, pnpm store, Device Support, model caches): you must tick "I understand".
   - 🔴 **Critical** (for example Hugging Face models, Ollama/LM Studio models, Xcode Archives, Maven repo, Trash, `node_modules`, `.venv`): you must **type `CLEAN`**.
8. **Open-app detection.** If Chrome, Slack, Xcode or Android Studio is running, the app warns you first. Files that are in use are always skipped.
9. **Local-only API.** Middleware rejects requests that aren't addressed to `localhost`, and cross-origin requests that change anything. This protects against DNS-rebinding and CSRF.
10. **Dev Projects needs marker files.** A `build/` folder is only listed if `build.gradle`, `pubspec.yaml` or `truffle-config.js` sits next to it. The same goes for `target/`, which needs `Cargo.toml`, `pom.xml` or `Anchor.toml`. A folder of yours that just happens to be called "build" is never matched.

App data (settings, history and quarantine) lives in `~/.clean-cache-app`.

---

## Project structure

```
src/
  middleware.ts               localhost + CSRF guard
  lib/
    targets.ts                registry of every cache location (macOS / Windows / Linux)
    types.ts                  shared types
    server/
      safety.ts               the safety guard (protected paths, file types)
      paths.ts                ~ / %ENV% expansion, * wildcards, path comparison
      engine.ts               target resolution, safe directory walker, scanner
      cleaner.ts              delete / quarantine with server-side confirmation gate
      quarantine.ts           move, restore, purge, auto-expiry
      projects.ts             developer project scanner & cleaner
      system.ts               disk, memory, CPU, running processes, admin check
      store.ts                settings & history (JSON)
  app/
    page.tsx                  Dashboard
    cleaner/  projects/  quarantine/  history/  settings/
    api/  system  targets  scan  clean  quarantine  history  settings  projects
  components/                 UI kit, CleanDialog, Sidebar, Toaster, AppProvider
```

### Adding a cache location

Add an entry to `TARGETS` in `src/lib/targets.ts`:

```ts
{
  id: "my-app",
  name: "My App Cache",
  description: "…",
  category: "apps",
  risk: "safe",                       // safe | moderate | critical
  platforms: ["darwin", "win32"],
  paths: {
    darwin: ["~/Library/Caches/com.example.myapp"],
    win32: ["%LOCALAPPDATA%\\MyApp\\Cache"],
  },
  processNames: ["myapp"],            // warn if it's running
  regenerates: "Rebuilt when the app starts.",
}
```

Only point at folders that hold **nothing but regenerable data**.

---

## Tips for more speed

- Restart your computer if it has been on for more than a week. That clears memory and the system caches the OS manages itself.
- Docker images and volumes aren't touched on purpose. Use `docker system prune` for those.
- For pnpm, `pnpm store prune` is a lighter alternative to clearing the whole store.
