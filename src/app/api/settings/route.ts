import path from "node:path";
import type { Settings } from "@/lib/types";
import { getSettings, saveSettings } from "@/lib/server/store";
import { expandUserPath } from "@/lib/server/paths";
import { body, fail, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json(await getSettings());
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request) {
  try {
    const input = await body<Partial<Settings>>(req);
    if (Array.isArray(input.excludedPaths)) {
      input.excludedPaths = input.excludedPaths
        .filter((p) => typeof p === "string" && p.trim())
        .map((p) => path.resolve(expandUserPath(p)));
    }
    return json(await saveSettings(input));
  } catch (e) {
    return fail(e);
  }
}
