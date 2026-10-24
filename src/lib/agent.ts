"use client";

import { IS_HOSTED } from "./mode";

/**
 * In the hosted dashboard (Vercel) every API call goes from YOUR browser straight to the
 * CleanCache agent running on your computer. Nothing passes through the cloud server.
 */
export const DEFAULT_AGENT_URL = "http://127.0.0.1:4321";
const URL_KEY = "cleancache.agentUrl";
const TOKEN_KEY = "cleancache.agentToken";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {
    /* storage blocked */
  }
}

export function agentUrl(): string {
  return (read(URL_KEY) || DEFAULT_AGENT_URL).replace(/\/+$/, "");
}
export function setAgentUrl(url: string) {
  write(URL_KEY, url.trim() ? url.trim().replace(/\/+$/, "") : null);
}
export function agentToken(): string | null {
  return read(TOKEN_KEY);
}
export function setAgentToken(token: string | null) {
  write(TOKEN_KEY, token);
}

/** Base URL for API calls: same origin locally, the agent when hosted. */
export function apiBase(): string {
  return IS_HOSTED ? agentUrl() : "";
}

export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "x-clean-cache": "1" };
  if (IS_HOSTED) {
    const t = agentToken();
    if (t) h["x-clean-cache-token"] = t;
  }
  return h;
}

export class AgentAuthError extends Error {}
export const AGENT_AUTH_EVENT = "cleancache:agent-auth-lost";
