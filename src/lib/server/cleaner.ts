import fs from "node:fs/promises";
import crypto from "node:crypto";
import { getTargetDef } from "../targets";
import { CONFIRM_PHRASE, type CleanRequest, type CleanResponse, type CleanTargetResult, type Settings } from "../types";
import { buildContext, pruneEmptyDirs, walkTarget } from "./engine";
import { PLATFORM } from "./paths";
import { QuarantineWriter } from "./quarantine";
import { addHistory } from "./store";
import { matchRunning, runningProcessNames } from "./system";

/** Server-side confirmation gate. The UI asks too, but the server never trusts the UI. */
export function confirmationProblem(targetId: string, req: CleanRequest): string | null {
  const def = getTargetDef(targetId);
  if (!def) return "Unknown target";
  if (!def.platforms.includes(PLATFORM)) return "Not available on this operating system";
  if (def.risk === "moderate" && !req.acknowledged?.includes(targetId)) return "Needs your confirmation (moderate risk)";
  if (def.risk === "critical" && (req.confirmations?.[targetId] ?? "").trim().toUpperCase() !== CONFIRM_PHRASE)
    return `Critical item — type ${CONFIRM_PHRASE} to confirm`;
  return null;
}

export async function cleanTargets(req: CleanRequest, settings: Settings): Promise<CleanResponse> {
  const startedAt = new Date().toISOString();
  const mode = req.mode === "quarantine" ? "quarantine" : "delete";
  const dryRun = !!req.dryRun;
  const running = await runningProcessNames();
  const quarantine = !dryRun && mode === "quarantine" ? new QuarantineWriter(settings.quarantineRetentionDays) : null;
  const results: CleanTargetResult[] = [];

  for (const id of [...new Set(req.targetIds)]) {
    const def = getTargetDef(id);
    const base: CleanTargetResult = { targetId: id, name: def?.name ?? id, freed: 0, removedFiles: 0, skipped: 0, errors: 0, errorSamples: [], status: "done" };

    const problem = confirmationProblem(id, req);
    if (problem || !def) {
      results.push({ ...base, status: "blocked", message: problem ?? "Unknown target" });
      continue;
    }

    const openApps = matchRunning(def.processNames, running);
    if (openApps.length && !(req.ignoreRunning ?? []).includes(id)) {
      results.push({
        ...base,
        status: settings.skipRunningApps ? "skipped" : "blocked",
        message: `Close ${openApps.join(", ")} first (or confirm to clean anyway — files in use are skipped).`,
      });
      continue;
    }

    const ctx = await buildContext(def, settings);
    if (!ctx || !ctx.roots.length) {
      results.push({ ...base, status: "skipped", message: "Nothing found on this computer" });
      continue;
    }

    const r = { ...base };
    const stats = await walkTarget(ctx, async (file, st) => {
      if (dryRun) {
        r.freed += st.size;
        r.removedFiles++;
        return;
      }
      try {
        if (quarantine) await quarantine.add(file, st.size, id);
        else await fs.unlink(file);
        r.freed += st.size;
        r.removedFiles++;
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code ?? "ERR";
        r.errors++;
        if (r.errorSamples.length < 5) r.errorSamples.push(`${code}: ${file}`);
      }
    });
    if (!dryRun) await pruneEmptyDirs(stats.dirs, ctx.roots);
    r.skipped = stats.skippedCount;
    r.status = r.errors > 0 ? "partial" : "done";
    if (r.errors > 0) r.message = `${r.errors} file(s) were in use or protected by the OS and were left alone.`;
    if (stats.truncated) r.message = (r.message ? r.message + " " : "") + "Very large folder — run again to continue.";
    results.push(r);
  }

  const batch = quarantine ? await quarantine.finalize() : null;
  const response: CleanResponse = {
    id: batch?.id ?? crypto.randomUUID(),
    startedAt,
    finishedAt: new Date().toISOString(),
    mode,
    dryRun,
    totalFreed: results.reduce((a, b) => a + b.freed, 0),
    results,
  };

  if (!dryRun && results.some((x) => x.removedFiles > 0)) {
    await addHistory({
      id: response.id,
      date: response.finishedAt,
      mode,
      dryRun,
      totalFreed: response.totalFreed,
      source: "cleaner",
      targets: results.map((x) => ({ id: x.targetId, name: x.name, freed: x.freed, files: x.removedFiles, status: x.status })),
    });
  }
  return response;
}
