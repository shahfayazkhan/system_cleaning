import type { CleanRequest } from "@/lib/types";
import { cleanTargets } from "@/lib/server/cleaner";
import { getSettings } from "@/lib/server/store";
import { body, fail, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const input = await body<Partial<CleanRequest>>(req);
    if (!Array.isArray(input.targetIds) || !input.targetIds.length) return json({ error: "No targets selected" }, 400);
    const request: CleanRequest = {
      targetIds: input.targetIds.filter((x): x is string => typeof x === "string"),
      mode: input.mode === "quarantine" ? "quarantine" : "delete",
      dryRun: !!input.dryRun,
      acknowledged: Array.isArray(input.acknowledged) ? input.acknowledged : [],
      confirmations: input.confirmations && typeof input.confirmations === "object" ? input.confirmations : {},
      ignoreRunning: Array.isArray(input.ignoreRunning) ? input.ignoreRunning : [],
    };
    return json(await cleanTargets(request, await getSettings()));
  } catch (e) {
    return fail(e);
  }
}
