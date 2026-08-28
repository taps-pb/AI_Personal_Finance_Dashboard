import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar, BottomNav } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { QuickAdd } from "@/components/quick-add";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Personal Finance Dashboard",
  description: "Your manual-entry personal financial command center.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({ where: { userId: user.id, status: "active" }, orderBy: { createdAt: "asc" } }),
    prisma.category.findMany({ where: { userId: user.id } }),
  ]);
  const acctOpts = accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, icon: a.icon }));
  const catOpts = categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, parentId: c.parentId }));

  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Sidebar />
          <div className="flex min-h-full flex-col md:pl-60">
            <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
              <div className="flex items-center gap-2 md:hidden">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">₹</div>
                <span className="font-semibold tracking-tight">Finance</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <QuickAdd accounts={acctOpts} categories={catOpts} />
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">
              <div className="mx-auto w-full max-w-6xl">{children}</div>
            </main>
          </div>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
