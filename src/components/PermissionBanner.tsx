"use client";

import Link from "next/link";
import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PermissionStatus } from "@/lib/types";
import { Button } from "./ui";

/** Shown on the dashboard when CleanCache is missing a permission that would let it clean more. */
export function PermissionBanner() {
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    api<PermissionStatus>("/api/permissions")
      .then((s) => setMissing(s.items.filter((i) => i.status === "denied").map((i) => i.title)))
      .catch(() => undefined);
  }, []);

  if (!missing.length) return null;
  return (
    <div className="card flex flex-col items-start gap-3 border-amber-500/20 p-4 sm:flex-row sm:items-center">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-300">
        <KeyRound className="h-5 w-5" />
      </div>
      <div className="flex-1 text-sm">
        <div className="font-semibold text-white">Grant permissions to clean everything</div>
        <div className="text-xs text-slate-400">Missing: {missing.join(", ")}. Those caches are skipped safely until you allow it.</div>
      </div>
      <Link href="/permissions">
        <Button size="sm" icon={<KeyRound className="h-4 w-4" />}>
          Allow permissions
        </Button>
      </Link>
    </div>
  );
}
