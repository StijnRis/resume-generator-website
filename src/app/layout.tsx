import type { Metadata } from "next";
import Link from "next/link";
import { DebugProvider } from "@/lib/debug/context";
import { DebugPanel } from "@/components/DebugPanel";
import "./globals.css";

export const metadata: Metadata = {
  title: "CV Generator",
  description: "Generate personalised CVs with AI based on your biography and job description",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <DebugProvider>
          <nav className="border-b border-zinc-200 bg-white">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
              <Link href="/" className="text-lg font-bold text-zinc-900">
                CV Generator
              </Link>
              <div className="flex gap-4 text-sm">
                <Link href="/" className="text-zinc-600 hover:text-zinc-900">
                  Home
                </Link>
                <Link
                  href="/generate"
                  className="text-zinc-600 hover:text-zinc-900"
                >
                  Generate
                </Link>
              </div>
            </div>
          </nav>
          <main>{children}</main>
          <DebugPanel />
        </DebugProvider>
      </body>
    </html>
  );
}
