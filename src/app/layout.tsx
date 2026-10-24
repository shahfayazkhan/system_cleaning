import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/components/providers/AppProvider";
import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "@/components/Toaster";
import { HostedLanding } from "@/components/HostedLanding";
import { IS_HOSTED } from "@/lib/mode";

export const metadata: Metadata = {
  title: "CleanCache — Safe Cache Cleaner",
  description: "Free up space and speed up your Mac or Windows PC by removing only regenerable caches.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body style={{ ["--font-sans" as string]: "Inter, 'SF Pro Text', 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif" }} className="font-sans">
        {IS_HOSTED ? (
          <HostedLanding />
        ) : (
        <AppProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-8 lg:px-10 lg:pt-10">
              <div className="mx-auto max-w-6xl">{children}</div>
            </main>
          </div>
          <Toaster />
        </AppProvider>
        )}
      </body>
    </html>
  );
}
