import { PLATFORM } from "@/lib/server/paths";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Health check used by the hosted dashboard to detect the local agent. Exposes no personal data. */
export async function GET() {
  return json({ ok: true, app: "clean-cache", version: "1.1.0", platform: PLATFORM });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
