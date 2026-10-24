import { listBatches, purgeBatch, restoreBatch } from "@/lib/server/quarantine";
import { body, fail, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json({ batches: await listBatches() });
  } catch (e) {
    return fail(e);
  }
}

/** POST { action: "restore" | "purge" | "purge-all", id? } */
export async function POST(req: Request) {
  try {
    const { action, id } = await body<{ action?: string; id?: string }>(req);
    if (action === "restore" && id) return json(await restoreBatch(id));
    if (action === "purge" && id) return json(await purgeBatch(id));
    if (action === "purge-all") {
      let freed = 0;
      for (const b of await listBatches()) freed += (await purgeBatch(b.id)).freed;
      return json({ freed });
    }
    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    return fail(e);
  }
}
