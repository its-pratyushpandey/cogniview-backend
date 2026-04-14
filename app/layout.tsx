import type { Metadata } from "next";
import { Mona_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import GlobalOverlays from "@/components/shell/GlobalOverlays";
import SWRProvider from "@/components/providers/SWRProvider";

const monaSans = Mona_Sans({
  variable: "--font-mona-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cogniview - Powered by AI",
  description: "An AI-powered job interview platform with Kiki AI Assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(monaSans.className, "min-h-dvh bg-bg text-text antialiased")}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
          <SWRProvider>
            {children}
            <Toaster richColors closeButton />
            <GlobalOverlays />
          </SWRProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
