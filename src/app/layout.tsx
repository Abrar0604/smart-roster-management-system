import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smart Roster — D2C CX Operations Scheduling",
  description:
    "Constraint-aware monthly roster planning, conflict detection, and multi-brand coverage management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col lg:flex-row bg-background text-foreground font-sans">
        <TooltipProvider delayDuration={150}>
          <AppSidebar />
          <main className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
              {children}
            </div>
          </main>
        </TooltipProvider>
      </body>
    </html>
  );
}
