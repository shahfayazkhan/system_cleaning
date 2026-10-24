import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "CleanCache — Safe Cache Cleaner",
  description: "Free up space and speed up your Mac or Windows PC by removing only regenerable caches.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body style={{ ["--font-sans" as string]: "Inter, 'SF Pro Text', 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif" }} className="font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
