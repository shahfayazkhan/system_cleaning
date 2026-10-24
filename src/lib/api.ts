"use client";

import { AGENT_AUTH_EVENT, AgentAuthError, apiBase, authHeaders } from "./agent";
import { IS_HOSTED } from "./mode";

/** Tiny fetch wrapper. Adds the security headers the agent requires. */
export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiBase() + url, {
      method: init?.method ?? (init?.body ? "POST" : "GET"),
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      mode: IS_HOSTED ? "cors" : "same-origin",
    });
  } catch (e) {
    if (IS_HOSTED) throw new Error("Can't reach the CleanCache agent on your computer. Is it running?");
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (IS_HOSTED && res.status === 401) {
    window.dispatchEvent(new Event(AGENT_AUTH_EVENT));
    throw new AgentAuthError("Permission for this dashboard was revoked. Please allow access again.");
  }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}
