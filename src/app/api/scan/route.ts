import { getTargetDef } from "@/lib/targets";
import { scanTarget } from "@/lib/server/engine";
import { getSettings } from "@/lib/server/store";
import { matchRunning, runningProcessNames } from "@/lib/server/system";
import { fail, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET /api/scan?id=<targetId> — measures one target (read-only, nothing is changed). */
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const def = getTargetDef(id);
    if (!def) return json({ error: "Unknown target" }, 404);
    const [settings, running] = await Promise.all([getSettings(), runningProcessNames()]);
    return json(await scanTarget(id, settings, matchRunning(def.processNames, running)));
  } catch (e) {
    return fail(e);
  }
}
