import fs from "node:fs/promises";
import type { CleanMode } from "@/lib/types";
import { cleanProjects, scanProjects, validateProjectRoot } from "@/lib/server/projects";
import { expandUserPath } from "@/lib/server/paths";
import { body, fail, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * POST { action: "scan", root }
 * POST { action: "clean", root, paths[], mode, dryRun?, acknowledged?, confirmation? }
 */
export async function POST(req: Request) {
  try {
    const input = await body<{
      action?: string;
      root?: string;
      paths?: string[];
      mode?: CleanMode;
      dryRun?: boolean;
      acknowledged?: boolean;
      confirmation?: string;
    }>(req);
    if (!input.root) return json({ error: "Choose a folder first" }, 400);
    const root = expandUserPath(input.root);
    const err = validateProjectRoot(root);
    if (err) return json({ error: err }, 400);
    try {
      if (!(await fs.stat(root)).isDirectory()) return json({ error: "Not a folder" }, 400);
    } catch {
      return json({ error: "Folder not found" }, 404);
    }

    if (input.action === "scan") return json({ root, ...(await scanProjects(root)) });
    if (input.action === "clean") {
      if (!Array.isArray(input.paths) || !input.paths.length) return json({ error: "Nothing selected" }, 400);
      return json(
        await cleanProjects({
          root,
          paths: input.paths.filter((p) => typeof p === "string"),
          mode: input.mode === "quarantine" ? "quarantine" : "delete",
          dryRun: !!input.dryRun,
          acknowledged: !!input.acknowledged,
          confirmation: input.confirmation,
        })
      );
    }
    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    return fail(e);
  }
}
