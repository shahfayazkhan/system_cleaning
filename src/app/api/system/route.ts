import { getSystemInfo } from "@/lib/server/system";
import { fail, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json(await getSystemInfo());
  } catch (e) {
    return fail(e);
  }
}
