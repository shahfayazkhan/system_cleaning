import { Apple, MonitorSmartphone } from "lucide-react";

export const REPO = "https://github.com/shahfayazkhan/system_cleaning";

/** Install / start instructions for the local CleanCache agent. */
export function InstallSteps() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InstallCard
        icon={<Apple className="h-5 w-5" />}
        title="macOS (Terminal)"
        lines={[`git clone ${REPO}.git`, "cd system_cleaning", "npm install", "npm run build && npm start"]}
      />
      <InstallCard
        icon={<MonitorSmartphone className="h-5 w-5" />}
        title="Windows (PowerShell)"
        lines={[`git clone ${REPO}.git`, "cd system_cleaning", "npm install", "npm run build; npm start"]}
      />
    </div>
  );
}

function InstallCard({ icon, title, lines }: { icon: React.ReactNode; title: string; lines: string[] }) {
  return (
    <div className="rounded-xl border border-white/5 bg-ink-850 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <span className="text-brand-300">{icon}</span> {title}
      </div>
      <pre className="overflow-x-auto rounded-lg bg-ink-950 p-3 font-mono text-xs leading-relaxed text-slate-300 ring-1 ring-white/5">
        {lines.map((l) => (
          <div key={l}>
            <span className="select-none text-brand-400">$ </span>
            {l}
          </div>
        ))}
      </pre>
    </div>
  );
}
