import { Apple, Bot, Code2, Download, Github, Globe, Layers, Lock, MonitorSmartphone, ShieldCheck, Sparkles, Terminal, Trash2 } from "lucide-react";

/**
 * Shown when the app is deployed to a cloud host (Vercel).
 * A web server in the cloud cannot read or clean files on a visitor's computer, so the
 * hosted build is an information + download page, and the file-system API is disabled.
 */
const REPO = "https://github.com/shahfayazkhan/system_cleaning";

const FEATURES = [
  { icon: Globe, title: "Browser caches", body: "Chrome, Edge, Brave, Arc, Firefox, Safari — history, cookies and passwords untouched." },
  { icon: Code2, title: "Developer caches", body: "npm, yarn, pnpm, pip, Gradle, Maven, Xcode DerivedData, Android Studio, VS Code." },
  { icon: Bot, title: "AI tool caches", body: "Cursor, Windsurf, Claude, ChatGPT, Copilot, Hugging Face, Ollama, LM Studio, PyTorch." },
  { icon: Layers, title: "App caches", body: "Slack, Discord, Teams, Spotify, Zoom plus logs, crash reports and temp files." },
  { icon: Trash2, title: "Dev project cleanup", body: "node_modules, .next, build/, target/, __pycache__, .venv, Pods — only next to a real project file." },
  { icon: ShieldCheck, title: "Safety first", body: "Allow-list only, protected folders, typed confirmation for critical items, restorable quarantine." },
];

export function HostedLanding() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-8 sm:py-20">
      <header className="mb-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-emerald-700 text-ink-950 shadow-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-white">CleanCache</span>
        </div>
        <a href={REPO} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">
          <Github className="h-4 w-4" /> GitHub
        </a>
      </header>

      <section className="text-center">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-200 ring-1 ring-brand-500/20">
          <MonitorSmartphone className="h-3.5 w-3.5" /> macOS & Windows
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Speed up your laptop by removing <span className="bg-gradient-to-r from-brand-300 to-emerald-200 bg-clip-text text-transparent">only safe caches</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-slate-400">
          CleanCache finds gigabytes of browser, developer and AI-tool caches — and never touches your documents, photos, apps or keys.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={`${REPO}/archive/refs/heads/office.zip`} className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-500 px-6 font-semibold text-ink-950 shadow-glow hover:bg-brand-400">
            <Download className="h-5 w-5" /> Download source
          </a>
          <a href="#install" className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/10 px-6 font-semibold text-slate-200 hover:bg-white/5">
            <Terminal className="h-5 w-5" /> Install guide
          </a>
        </div>
      </section>

      <section className="card mt-14 flex items-start gap-4 border-amber-500/20 p-5">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div className="text-sm text-slate-300">
          <div className="font-semibold text-white">Why can&apos;t I clean from this website?</div>
          Browsers and cloud servers have no access to the files on your computer — that&apos;s an important security boundary. CleanCache runs as a small local app at{" "}
          <code className="kbd">http://127.0.0.1:4321</code> that only your own computer can reach. This page is just the download & info page, and its cleaning API is switched off.
        </div>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="card card-pad">
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-500/20">
              <Icon className="h-5 w-5" />
            </div>
            <div className="font-semibold text-white">{title}</div>
            <p className="mt-1 text-sm text-slate-400">{body}</p>
          </div>
        ))}
      </section>

      <section id="install" className="mt-14 grid gap-4 md:grid-cols-2">
        <InstallCard icon={<Apple className="h-5 w-5" />} title="macOS" lines={[`git clone ${REPO}.git`, "cd system_cleaning", "npm install", "npm run build && npm start"]} note="Optional: give Terminal Full Disk Access to also clean Safari caches." />
        <InstallCard icon={<MonitorSmartphone className="h-5 w-5" />} title="Windows (PowerShell)" lines={[`git clone ${REPO}.git`, "cd system_cleaning", "npm install", "npm run build; npm start"]} note="Run PowerShell as Administrator to also clean Windows Temp & Update caches." />
      </section>
      <p className="mt-6 text-center text-sm text-slate-500">
        Requires Node.js 20+. Then open <code className="kbd">http://127.0.0.1:4321</code> in your browser.
      </p>
    </div>
  );
}

function InstallCard({ icon, title, lines, note }: { icon: React.ReactNode; title: string; lines: string[]; note: string }) {
  return (
    <div className="card card-pad">
      <div className="mb-3 flex items-center gap-2 font-semibold text-white">
        <span className="text-brand-300">{icon}</span> {title}
      </div>
      <pre className="overflow-x-auto rounded-xl bg-ink-950 p-4 font-mono text-xs leading-relaxed text-slate-300 ring-1 ring-white/5">
        {lines.map((l) => (
          <div key={l}>
            <span className="select-none text-brand-400">$ </span>
            {l}
          </div>
        ))}
      </pre>
      <p className="mt-3 text-xs text-slate-500">{note}</p>
    </div>
  );
}
