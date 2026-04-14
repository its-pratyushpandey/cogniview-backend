"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import AppSidebar from "@/components/shell/AppSidebar";
import AppTopbar from "@/components/shell/AppTopbar";
import PageTransition from "@/components/shell/PageTransition";
import PerformanceProfiler from "@/components/shell/PerformanceProfiler";
import { isFullScreenRoute } from "@/components/shell/nav";

const STORAGE_KEY = "cogniview.sidebar.collapsed";
const PRIORITY_PREFETCH_ROUTES = ["/", "/interview", "/practice", "/resume-analysis"] as const;

export default function AppShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const fullScreen = isFullScreenRoute(pathname);

  const [collapsed, setCollapsed] = React.useState(false);
  const toggleCollapsed = React.useCallback(() => setCollapsed((value) => !value), []);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "1") setCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const prefetchPriorityRoutes = () => {
      PRIORITY_PREFETCH_ROUTES.forEach((route) => router.prefetch(route));
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      const idleId = idleWindow.requestIdleCallback(prefetchPriorityRoutes, { timeout: 1500 });
      return () => {
        if (typeof idleWindow.cancelIdleCallback === "function") {
          idleWindow.cancelIdleCallback(idleId);
        }
      };
    }

    const timeoutId = window.setTimeout(prefetchPriorityRoutes, 250);
    return () => window.clearTimeout(timeoutId);
  }, [router]);

  if (fullScreen) {
    return <div className="min-h-dvh bg-background text-foreground">{children}</div>;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="flex min-h-dvh">
        <AppSidebar
          user={user}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />

        <div className={cn("flex min-w-0 flex-1 flex-col")}> 
          <AppTopbar user={user} />

          <main className="flex-1">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <PerformanceProfiler id="app-route-content" thresholdMs={24}>
                <PageTransition>{children}</PageTransition>
              </PerformanceProfiler>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
