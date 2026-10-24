"use client";

import { CheckCircle2, ChevronDown, Circle, Download, Github, KeyRound, Laptop, Loader2, Network, RefreshCw, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AGENT_AUTH_EVENT, DEFAULT_AGENT_URL, agentToken, agentUrl, setAgentToken, setAgentUrl } from "@/lib/agent";
import { cn } from "@/lib/format";
import { Button } from "./ui";
import { InstallSteps, REPO } from "./HostedLanding";

/**
 * Hosted (Vercel) mode: before the dashboard can show anything it needs three permissions —
 *   1. the CleanCache agent must be running on this computer,
 *   2. the browser must allow this site to reach it (Local Network Access prompt),
 *   3. you must approve this dashboard on the agent's own consent page (pairing).
 * Once all three are granted, the normal dashboard renders and talks to the agent directly.
 */

type Step = "pending" | "checking" | "granted" | "denied";

interface GateCtx {
  agent: string;
  disconnect: () => void;
}
const Ctx = createContext<GateCtx | null>(null);
export const useConnection = () => useContext(Ctx);

async function ping(base: string, timeoutMs = 4000): Promise<{ ok: boolean; platform?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/ping`, { cache: "no-store", signal: ctrl.signal, mode: "cors" });
    if (!res.ok) return { ok: false };
    const d = (await res.json()) as { ok?: boolean; app?: string; platform?: string };
    return { ok: d.app === "clean-cache", platform: d.platform };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(t);
  }
}

async function browserPermission(): Promise<PermissionState | "unsupported"> {
  for (const name of ["local-network-access", "loopback-network"]) {
    try {
      const s = await navigator.permissions.query({ name: name as PermissionName });
      return s.state;
    } catch {
      /* try next */
    }
  }
  return "unsupported";
}

async function verifyToken(base: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/api/system`, { headers: { "x-clean-cache": "1", "x-clean-cache-token": token }, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export function ConnectionGate({ children }: { children: ReactNode }) {
  const [base, setBase] = useState(DEFAULT_AGENT_URL);
  const [agentStep, setAgentStep] = useState<Step>("checking");
  const [netStep, setNetStep] = useState<Step>("pending");
  const [pairStep, setPairStep] = useState<Step>("pending");
  const [connected, setConnected] = useState(false);
  const [booting, setBooting] = useState(true);
  const [platform, setPlatform] = useState<string>();
  const [message, setMessage] = useState<string>("");
  const [advanced, setAdvanced] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const popup = useRef<Window | null>(null);

  const check = useCallback(async (b = agentUrl(), timeoutMs = 4000) => {
    setBase(b);
    setAgentStep((s) => (s === "granted" ? s : "checking"));
    const perm = await browserPermission();
    if (perm === "denied") {
      setNetStep("denied");
      setAgentStep("pending");
      return false;
    }
    const p = await ping(b, timeoutMs);
    if (!p.ok) {
      setAgentStep("denied");
      setNetStep(perm === "granted" ? "granted" : "pending");
      return false;
    }
    setPlatform(p.platform);
    setAgentStep("granted");
    setNetStep("granted");
    const token = agentToken();
    if (token && (await verifyToken(b, token))) {
      setPairStep("granted");
      setConnected(true);
      return true;
    }
    if (token) setAgentToken(null);
    setPairStep("pending");
    return false;
  }, []);

  // initial check
  useEffect(() => {
    setUrlInput(agentUrl());
    check().finally(() => setBooting(false));
  }, [check]);

  // keep polling until the agent shows up
  useEffect(() => {
    if (connected || agentStep === "granted") return;
    const id = setInterval(() => check(), 4000);
    return () => clearInterval(id);
  }, [connected, agentStep, check]);

  // permission revoked on the agent while using the dashboard
  useEffect(() => {
    const onLost = () => {
      setAgentToken(null);
      setConnected(false);
      setPairStep("pending");
      setMessage("Access for this dashboard was revoked on your computer. Allow it again to continue.");
    };
    window.addEventListener(AGENT_AUTH_EVENT, onLost);
    return () => window.removeEventListener(AGENT_AUTH_EVENT, onLost);
  }, []);

  // receive the token from the agent's consent pop-up
  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      let agentOrigin = "";
      try {
        agentOrigin = new URL(agentUrl()).origin;
      } catch {
        return;
      }
      if (e.origin !== agentOrigin || e.data?.source !== "cleancache-agent") return;
      if (e.data.type === "paired" && typeof e.data.token === "string") {
        setAgentToken(e.data.token);
        setPairStep("checking");
        const ok = await verifyToken(agentUrl(), e.data.token);
        setPairStep(ok ? "granted" : "denied");
        if (ok) {
          setMessage("");
          setConnected(true);
        }
      } else if (e.data.type === "denied") {
        setPairStep("denied");
        setMessage("You denied access in the CleanCache window.");
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  async function allowNetwork() {
    setNetStep("checking");
    await check(agentUrl(), 60_000); // the request itself triggers the browser's "local network" permission prompt
  }

  function allowPairing() {
    setMessage("");
    setPairStep("checking");
    const url = `${agentUrl()}/pair?origin=${encodeURIComponent(window.location.origin)}`;
    popup.current = window.open(url, "cleancache-pair", "popup,width=500,height=720");
    if (!popup.current) {
      setPairStep("pending");
      setMessage("Your browser blocked the pop-up. Allow pop-ups for this site and try again.");
      return;
    }
    const id = setInterval(() => {
      if (popup.current?.closed) {
        clearInterval(id);
        setPairStep((s) => (s === "checking" ? "pending" : s));
      }
    }, 600);
  }

  const disconnect = useCallback(() => {
    setAgentToken(null);
    setConnected(false);
    setPairStep("pending");
  }, []);

  if (connected) return <Ctx.Provider value={{ agent: base, disconnect }}>{children}</Ctx.Provider>;

  const doneCount = [agentStep, netStep, pairStep].filter((s) => s === "granted").length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-emerald-700 text-ink-950 shadow-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-white">CleanCache</div>
            <div className="text-[11px] text-slate-500">Safe system optimizer</div>
          </div>
        </div>
        <a href={REPO} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">
          <Github className="h-4 w-4" /> GitHub
        </a>
      </header>

      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-500/10 ring-1 ring-brand-500/25">
          <ShieldCheck className="h-8 w-8 text-brand-300" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Permissions required</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
          To clean caches on your {platform === "win32" ? "PC" : platform === "darwin" ? "Mac" : "computer"}, CleanCache needs your permission. Your files never leave your computer — this page talks directly to CleanCache running on it.
        </p>
        <div className="mx-auto mt-5 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-300 transition-all" style={{ width: `${(doneCount / 3) * 100}%` }} />
        </div>
        <div className="mt-1.5 text-xs text-slate-500">{doneCount} of 3 granted</div>
      </div>

      {message && <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-center text-sm text-amber-100">{message}</div>}

      <div className="space-y-3">
        <StepCard
          n={1}
          icon={<Laptop className="h-5 w-5" />}
          title="Run CleanCache on this computer"
          desc="A small local app does the actual cleaning. Install it once, then keep it running while you clean."
          state={booting ? "checking" : agentStep}
          grantedText="CleanCache is running"
          action={
            agentStep !== "granted" && (
              <div className="flex flex-wrap gap-2">
                <a href={`${REPO}/archive/refs/heads/office.zip`}>
                  <Button size="sm" icon={<Download className="h-4 w-4" />}>
                    Download
                  </Button>
                </a>
                <Button size="sm" variant="secondary" onClick={() => check()} icon={<RefreshCw className="h-4 w-4" />}>
                  I started it — check again
                </Button>
              </div>
            )
          }
        >
          {agentStep === "denied" && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-400">
                Not found at <code className="kbd">{base}</code>. Start it with the commands below (Node.js 20+), this page detects it automatically.
              </p>
              <InstallSteps />
            </div>
          )}
        </StepCard>

        <StepCard
          n={2}
          icon={<Network className="h-5 w-5" />}
          title="Allow this site to reach CleanCache"
          desc="Your browser asks whether this website may connect to apps on your device. Choose “Allow”."
          state={netStep}
          grantedText="Browser access allowed"
          action={
            netStep !== "granted" && (
              <Button size="sm" onClick={allowNetwork} loading={netStep === "checking"} icon={<Network className="h-4 w-4" />}>
                Allow local access
              </Button>
            )
          }
        >
          {netStep === "denied" && (
            <p className="mt-3 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-100">
              Access was blocked. Click the icon left of the address bar → <b>Site settings</b> → set <b>Local network access</b> to <b>Allow</b>, then reload this page.
            </p>
          )}
          <p className="mt-2 text-[11px] text-slate-500">Works in Chrome, Edge, Brave and Firefox. Safari blocks secure websites from reaching local apps — use the local dashboard at {DEFAULT_AGENT_URL} instead.</p>
        </StepCard>

        <StepCard
          n={3}
          icon={<KeyRound className="h-5 w-5" />}
          title="Approve this dashboard"
          desc="A CleanCache window opens from your computer. Click “Allow” there to give this dashboard a private access key."
          state={pairStep}
          grantedText="Dashboard approved"
          action={
            pairStep !== "granted" && (
              <Button size="sm" onClick={allowPairing} disabled={agentStep !== "granted"} loading={pairStep === "checking"} icon={<ShieldCheck className="h-4 w-4" />}>
                Allow access
              </Button>
            )
          }
        />
      </div>

      <div className="mt-6 rounded-2xl border border-white/5 p-4">
        <button onClick={() => setAdvanced((v) => !v)} className="flex w-full items-center justify-between text-xs text-slate-400">
          Advanced: CleanCache address
          <ChevronDown className={cn("h-4 w-4 transition", advanced && "rotate-180")} />
        </button>
        {advanced && (
          <div className="mt-3 flex gap-2">
            <input className="input h-9 font-mono" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder={DEFAULT_AGENT_URL} />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setAgentUrl(urlInput);
                setAgentToken(null);
                check(agentUrl());
              }}
            >
              Save
            </Button>
          </div>
        )}
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5 text-brand-400" /> Documents, photos, downloads, apps, keychains, SSH keys and wallets are always protected.
      </p>
    </div>
  );
}

function StepCard({ n, icon, title, desc, state, grantedText, action, children }: { n: number; icon: ReactNode; title: string; desc: string; state: Step; grantedText: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className={cn("card p-5 transition", state === "granted" && "border-brand-500/25")}>
      <div className="flex items-start gap-4">
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1", state === "granted" ? "bg-brand-500/10 text-brand-300 ring-brand-500/25" : "bg-white/5 text-slate-300 ring-white/10")}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">STEP {n}</span>
            <StateBadge state={state} grantedText={grantedText} />
          </div>
          <div className="mt-0.5 font-semibold text-white">{title}</div>
          <p className="mt-0.5 text-sm text-slate-400">{desc}</p>
          {action && <div className="mt-3">{action}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}

function StateBadge({ state, grantedText }: { state: Step; grantedText: string }) {
  if (state === "granted")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/25">
        <CheckCircle2 className="h-3 w-3" /> {grantedText}
      </span>
    );
  if (state === "checking")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-300 ring-1 ring-sky-500/25">
        <Loader2 className="h-3 w-3 animate-spin" /> Waiting…
      </span>
    );
  if (state === "denied")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-500/25">
        <XCircle className="h-3 w-3" /> Not granted
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-slate-400 ring-1 ring-white/10">
      <Circle className="h-3 w-3" /> Required
    </span>
  );
}
