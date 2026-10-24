import { createPairing, normalizeOrigin } from "@/lib/server/pairing";
import { body, fail, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { origin } — called ONLY by the local /pair consent page after you click "Allow".
 * (The middleware rejects this route for any cross-origin caller.)
 */
export async function POST(req: Request) {
  try {
    const { origin } = await body<{ origin?: string }>(req);
    const o = normalizeOrigin(origin ?? "");
    if (!o) return json({ error: "Invalid website address" }, 400);
    return json({ origin: o, token: createPairing(o) });
  } catch (e) {
    return fail(e);
  }
}
