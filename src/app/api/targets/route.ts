import { CATEGORIES } from "@/lib/targets";
import { listTargets } from "@/lib/server/engine";
import { getSettings } from "@/lib/server/store";
import { fail, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const settings = await getSettings();
    const all = new URL(req.url).searchParams.get("all") === "1";
    return json({ categories: CATEGORIES, targets: await listTargets(all ? { ...settings, disabledTargets: [] } : settings) });
  } catch (e) {
    return fail(e);
  }
}
