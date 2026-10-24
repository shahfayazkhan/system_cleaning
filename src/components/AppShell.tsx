"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { IS_HOSTED } from "@/lib/mode";
import { AppProvider } from "./providers/AppProvider";
import { ConnectionGate } from "./ConnectionGate";
import { Sidebar } from "./Sidebar";
import { Toaster } from "./Toaster";

function AppFrame({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-8 lg:px-10 lg:pt-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
      <Toaster />
    </AppProvider>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // the local consent page renders on its own, without the dashboard around it
  if (pathname === "/pair") return <>{children}</>;
  if (IS_HOSTED)
    return (
      <ConnectionGate>
        <AppFrame>{children}</AppFrame>
      </ConnectionGate>
    );
  return <AppFrame>{children}</AppFrame>;
}
