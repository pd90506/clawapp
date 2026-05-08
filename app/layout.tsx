import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "clawapp", description: "openclaw chat" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
