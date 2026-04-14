"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Menu,
  Search,
  LogOut,
  User as UserIcon,
  IdCard,
  BadgeCheck,
  Settings,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth.action";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "@/components/shell/AppSidebar";
import GlobalSearch from "@/components/shell/GlobalSearch";

function initials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${last}`.toUpperCase();
}

function AppTopbar({ user }: { user: User }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false);
  const [isSigningOut, startSignOut] = React.useTransition();

  const shortId = user?.id ? user.id.slice(0, 10) : "unknown";

  const handleSignOut = () => {
    startSignOut(async () => {
      await signOut();
      router.push("/sign-in");
      router.refresh();
    });
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b",
        "border-border/80 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center gap-3">
          {/* Mobile nav */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[320px] p-0">
              <SheetHeader className="border-b px-4 py-4">
                <SheetTitle asChild>
                  <Link href="/" prefetch={true} className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
                    <div className="grid h-10 w-10 place-items-center rounded-2xl border bg-card/60 shadow-sm">
                      <span className="text-sm font-semibold">CV</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold leading-none">Cogniview</div>
                      <div className="mt-1 text-xs text-muted-foreground">Premium placement prep</div>
                    </div>
                  </Link>
                </SheetTitle>
              </SheetHeader>
              <div className="max-h-[calc(100dvh-64px)] overflow-y-auto pt-3">
                <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          {/* Desktop search */}
          <div className="hidden w-full max-w-xl md:block">
            <GlobalSearch userId={user?.id} />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={mobileSearchOpen ? "Close search" : "Open search"}
              aria-expanded={mobileSearchOpen}
              aria-controls="mobile-global-search"
              onClick={() => setMobileSearchOpen((open) => !open)}
              className="rounded-xl border border-border/60 bg-card/50 md:hidden"
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="relative hidden rounded-xl border border-border/60 bg-card/50 sm:inline-flex"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
            </Button>

            {/* Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 rounded-xl border border-border/70 bg-card/55 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback>{initials(user?.name)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">{user?.name ?? "Account"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 rounded-2xl border-border/85 bg-card/92 p-2">
                <DropdownMenuLabel className="rounded-xl border border-border/70 bg-secondary/55 p-3 text-foreground">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 ring-1 ring-border/70">
                      <AvatarFallback>{initials(user?.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{user?.name ?? "Learner"}</p>
                      <p className="truncate text-xs text-muted-foreground">{user?.email ?? "Signed in"}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      <BadgeCheck className="mr-1 h-3 w-3" />
                      Active
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      <Sparkles className="mr-1 h-3 w-3" />
                      Learner
                    </Badge>
                  </div>

                  <div className="mt-2 rounded-lg border border-border/70 bg-card/70 px-2 py-1.5 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">ID</span>: {shortId}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                  <Link href="/profile" prefetch={true} className="flex items-center">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>View profile</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href="/company-mode" prefetch={true} className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Preferences</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem disabled>
                  <IdCard className="mr-2 h-4 w-4" />
                  <span className="text-xs">Email verified account</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {mobileSearchOpen ? (
          <div id="mobile-global-search" className="border-t border-border/70 pb-3 pt-2 md:hidden">
            <GlobalSearch
              userId={user?.id}
              autoFocus
              onNavigate={() => setMobileSearchOpen(false)}
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}

const MemoizedAppTopbar = React.memo(AppTopbar, (prev, next) => {
  return (
    prev.user?.id === next.user?.id &&
    prev.user?.name === next.user?.name &&
    prev.user?.email === next.user?.email
  );
});

export default MemoizedAppTopbar;
