import { listPairings, revokePairing } from "@/lib/server/pairing";
import { body, fail, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Local-only: list / revoke websites that may control this agent. */
export async function GET() {
  return json({ pairings: listPairings() });
}

export async function DELETE(req: Request) {
  try {
    const { origin } = await body<{ origin?: string }>(req);
    if (!origin) return json({ error: "origin required" }, 400);
    revokePairing(origin);
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
