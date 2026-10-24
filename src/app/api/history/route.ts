import { clearHistory, getHistory } from "@/lib/server/store";
import { fail, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json({ history: await getHistory() });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE() {
  try {
    await clearHistory();
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
