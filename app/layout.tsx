import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { QueryProvider } from "@/lib/query/query-provider";
import { TopNav } from "@/components/layout/top-nav";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Management",
  description: "Live markets dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <QueryProvider>
            <TopNav />
            {children}
            <Footer />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
