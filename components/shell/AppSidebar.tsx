"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { APP_NAV, type NavItem, type NavSection } from "@/components/shell/nav";

const PRIORITY_PREFETCH_ROUTES = ["/", "/interview", "/practice", "/resume-analysis"] as const;

function initials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${last}`.toUpperCase();
}

function normalizePathname(pathname: string): string {
  // Strip query/hash just in case; Next's pathname usually excludes them.
  return pathname.split("?")[0]?.split("#")[0] ?? pathname;
}

function parseNavHref(href: string): { path: string; query: URLSearchParams } {
  const [path, queryString = ""] = href.split("?");
  return {
    path: path || "/",
    query: new URLSearchParams(queryString),
  };
}

function doesQueryMatchCurrent(searchParams: ReturnType<typeof useSearchParams>, expectedQuery: URLSearchParams): boolean {
  const expectedEntries = Array.from(expectedQuery.entries());
  if (expectedEntries.length === 0) {
    return true;
  }

  return expectedEntries.every(([key, value]) => searchParams.get(key) === value);
}

function isItemActive(pathname: string, searchParams: ReturnType<typeof useSearchParams>, item: NavItem): boolean {
  const current = normalizePathname(pathname);
  const parsed = parseNavHref(item.href);
  const href = parsed.path;

  const pathMatches = item.exact
    ? current === href
    : href === "/"
      ? current === "/"
      : current === href || current.startsWith(`${href}/`);

  if (!pathMatches) {
    return false;
  }

  return doesQueryMatchCurrent(searchParams, parsed.query);
}

export function SidebarNav({
  collapsed,
  onNavigate,
  sections = APP_NAV,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  sections?: NavSection[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const [, startNavigationTransition] = React.useTransition();

  const prefetchRoute = React.useCallback(
    (href: string) => {
      router.prefetch(href);
      const parsed = parseNavHref(href);
      if (parsed.path !== href) {
        router.prefetch(parsed.path);
      }
    },
    [router]
  );

  React.useEffect(() => {
    setPendingHref(null);
  }, [pathname, searchParams]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const preloadPriorityRoutes = () => {
      PRIORITY_PREFETCH_ROUTES.forEach((route) => prefetchRoute(route));
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      const idleId = idleWindow.requestIdleCallback(preloadPriorityRoutes, { timeout: 1800 });
      return () => {
        if (typeof idleWindow.cancelIdleCallback === "function") {
          idleWindow.cancelIdleCallback(idleId);
        }
      };
    }

    const timeoutId = window.setTimeout(preloadPriorityRoutes, 300);
    return () => window.clearTimeout(timeoutId);
  }, [prefetchRoute]);

  const handleLinkClick = React.useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      onNavigate?.();
      event.preventDefault();
      setPendingHref(href);
      startNavigationTransition(() => {
        router.push(href);
      });
    },
    [onNavigate, router, startNavigationTransition]
  );

  return (
    <nav className="flex flex-col gap-3 px-3 pb-3">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-2">
          {!collapsed && (
            <div className="px-2 text-xs font-medium text-muted-foreground">
              {section.title}
            </div>
          )}

          <div className="flex flex-col gap-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = pendingHref === item.href || isItemActive(pathname, searchParams, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  onClick={(event) => handleLinkClick(event, item.href)}
                  onMouseEnter={() => prefetchRoute(item.href)}
                  onFocus={() => prefetchRoute(item.href)}
                  onTouchStart={() => prefetchRoute(item.href)}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                    "hover:bg-secondary/70",
                    active
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={collapsed ? item.title : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  {active && (
                    <motion.span
                      layoutId="cogniview-sidebar-active"
                      className="absolute left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-primary to-accent"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}

                  <span
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-xl border bg-secondary/60",
                      "text-foreground/90",
                      active ? "border-primary/40" : "border-border/70"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  {!collapsed && (
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                      {item.title}
                    </span>
                  )}

                  {!collapsed && item.badge && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {!collapsed && <Separator className="mt-2" />}
        </div>
      ))}
    </nav>
  );
}

function AppSidebar({
  user,
  collapsed,
  onToggleCollapsed,
}: {
  user: User;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 84 : 288 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className={cn(
        "hidden lg:flex",
        "sticky top-0 h-dvh shrink-0 flex-col",
        "border-r border-border/80 bg-card/45 backdrop-blur supports-[backdrop-filter]:bg-card/35"
      )}
    >
      <div className={cn("flex items-center gap-3 px-4 py-4", collapsed && "justify-center px-2")}>
        <div className={cn("grid h-10 w-10 place-items-center rounded-2xl border border-primary/35 bg-primary/12 shadow-sm")}
        >
          <span className="text-sm font-semibold">CV</span>
        </div>

        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-none">Cogniview</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">AI prep workspace</div>
          </div>
        )}

        <div className={cn("ml-auto", collapsed && "hidden")}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="rounded-2xl border border-border/75 bg-secondary/55 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Workspace</p>
            <p className="mt-1 truncate text-sm font-medium">{user.name || "Learner"}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <SidebarNav collapsed={collapsed} />
      </div>

      <div className={cn("px-3 pb-4", collapsed && "px-2")}> 
        {!collapsed && (
          <div className="mb-3 rounded-2xl border border-border/75 bg-secondary/55 p-2.5">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-9 w-9 ring-1 ring-border/70">
                <AvatarFallback>{initials(user?.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user?.name || "Learner"}</p>
                <p className="truncate text-xs text-muted-foreground">ID: {user?.id?.slice(0, 8)}</p>
              </div>
            </div>
          </div>
        )}

        {collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapsed}
            className="w-full"
            aria-label="Expand sidebar"
            title="Expand"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.aside>
  );
}

const MemoizedAppSidebar = React.memo(AppSidebar, (prev, next) => {
  return (
    prev.collapsed === next.collapsed &&
    prev.user?.id === next.user?.id &&
    prev.user?.name === next.user?.name &&
    prev.user?.email === next.user?.email
  );
});

export { MemoizedAppSidebar as AppSidebar };
export default MemoizedAppSidebar;
