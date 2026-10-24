"use client";

import { AlertTriangle, CheckCircle2, Globe, Laptop, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { IS_HOSTED } from "@/lib/mode";
import { Button } from "@/components/ui";

/**
 * Local consent screen. Opened in a pop-up by the hosted dashboard:
 *   http://127.0.0.1:4321/pair?origin=https://your-app.vercel.app
 * Only YOU, on this computer, can click "Allow". The secret token is then handed to the
 * requesting website (and only to that exact origin) with window.postMessage.
 */
type Phase = "ask" | "busy" | "done" | "denied" | "error";

function parseOrigin(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export default function PairPage() {
  const [origin, setOrigin] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("ask");
  const [error, setError] = useState("");
  const [hasOpener, setHasOpener] = useState(true);

  useEffect(() => {
    setOrigin(parseOrigin(new URLSearchParams(window.location.search).get("origin")));
    setHasOpener(!!window.opener);
  }, []);

  function reply(msg: Record<string, unknown>) {
    if (window.opener && origin) window.opener.postMessage({ source: "cleancache-agent", ...msg }, origin);
  }

  async function allow() {
    if (!origin) return;
    setPhase("busy");
    try {
      const res = await fetch("/api/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-clean-cache": "1" },
        body: JSON.stringify({ origin }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) throw new Error(data.error ?? "Pairing failed");
      reply({ type: "paired", token: data.token });
      setPhase("done");
      setTimeout(() => window.close(), 1500);
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }

  function deny() {
    reply({ type: "denied" });
    setPhase("denied");
    setTimeout(() => window.close(), 800);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink-950 p-4">
      <div className="card w-full max-w-md animate-fade-in p-6">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-slate-300 ring-1 ring-white/10">
            <Globe className="h-6 w-6" />
          </div>
          <div className="h-px w-10 bg-gradient-to-r from-white/10 via-brand-400 to-white/10" />
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-emerald-700 text-ink-950 shadow-glow">
            <Laptop className="h-6 w-6" />
          </div>
        </div>

        {IS_HOSTED ? (
          <p className="text-center text-sm text-slate-300">This page only works on the CleanCache agent running on your computer.</p>
        ) : !origin ? (
          <div className="text-center">
            <XCircle className="mx-auto mb-3 h-8 w-8 text-rose-300" />
            <p className="text-sm text-slate-300">Invalid request. Open this page from the “Allow access” button on your CleanCache dashboard.</p>
          </div>
        ) : phase === "done" ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-brand-300" />
            <h1 className="text-lg font-semibold text-white">Access granted</h1>
            <p className="mt-1 text-sm text-slate-400">You can close this window and go back to the dashboard.</p>
          </div>
        ) : phase === "denied" ? (
          <div className="text-center">
            <XCircle className="mx-auto mb-3 h-10 w-10 text-slate-400" />
            <h1 className="text-lg font-semibold text-white">Access denied</h1>
            <p className="mt-1 text-sm text-slate-400">Nothing was shared. You can close this window.</p>
          </div>
        ) : (
          <>
            <h1 className="text-center text-xl font-semibold text-white">Allow this dashboard to clean your computer?</h1>
            <div className="mt-4 break-all rounded-xl bg-ink-850 px-4 py-3 text-center font-mono text-sm text-brand-200 ring-1 ring-white/10">{origin}</div>
            <p className="mt-3 text-center text-xs text-slate-400">Only click Allow if you opened this from your own CleanCache dashboard.</p>

            <div className="mt-5 space-y-2.5 text-sm">
              <div className="label">This website will be able to</div>
              {["See cache folder sizes and system info (disk, memory)", "Clean caches you select — always after your confirmation", "Change CleanCache settings"].map((x) => (
                <div key={x} className="flex items-start gap-2 text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" /> {x}
                </div>
              ))}
              <div className="label pt-2">It will never be able to</div>
              {["Read, upload or delete your documents, photos or downloads", "Bypass the built-in safety guard", "Grant access to other websites"].map((x) => (
                <div key={x} className="flex items-start gap-2 text-slate-300">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" /> {x}
                </div>
              ))}
            </div>

            {!hasOpener && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> This window was not opened by the dashboard, so the permission can&apos;t be delivered. Use the “Allow access” button on the dashboard instead.
              </div>
            )}
            {phase === "error" && <div className="mt-4 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={deny} disabled={phase === "busy"}>
                Deny
              </Button>
              <Button onClick={allow} loading={phase === "busy"} disabled={!hasOpener} icon={<ShieldCheck className="h-4 w-4" />}>
                Allow
              </Button>
            </div>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
              <Sparkles className="h-3 w-3" /> Revoke anytime in CleanCache → Permissions → Connected dashboards
            </p>
          </>
        )}
      </div>
    </div>
  );
}
