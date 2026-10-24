import { getPermissionStatus, openPermissionSettings } from "@/lib/server/permissions";
import { body, fail, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json(await getPermissionStatus());
  } catch (e) {
    return fail(e);
  }
}

/** POST { action: "open-full-disk-access" | "open-admin-help" } */
export async function POST(req: Request) {
  try {
    const { action } = await body<{ action?: string }>(req);
    return json(await openPermissionSettings(action ?? ""));
  } catch (e) {
    return fail(e);
  }
}
