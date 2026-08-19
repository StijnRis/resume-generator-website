import type { Metadata } from "next";
import Link from "next/link";
import { DebugProvider } from "@/lib/debug/context";
import { DebugPanel } from "@/components/DebugPanel";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Generator",
  description:
    "Generate personalised resumes with AI based on your biography and job description",
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
                Resume Generator
              </Link>
            </div>
          </nav>
          <main>{children}</main>
          <DebugPanel />
        </DebugProvider>
      </body>
    </html>
  );
}
