"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import type { SearchCategory, SearchResponsePayload, SearchResultItem } from "@/lib/search/types";
import { cn } from "@/lib/utils";

const FETCH_DEBOUNCE_MS = 220;
const CLIENT_CACHE_TTL_MS = 2 * 60_000;
const MAX_CACHE_ENTRIES = 50;

const CATEGORY_ORDER: SearchCategory[] = ["questions", "topics", "navigation"];
const CATEGORY_LABELS: Record<SearchCategory, string> = {
  questions: "Questions",
  topics: "Topics",
  navigation: "Navigation",
};

const KIND_LABELS: Record<SearchResultItem["kind"], string> = {
  question: "Question",
  topic: "Topic",
  feature: "Feature",
  company: "Company",
};

const EMPTY_CATEGORIES: SearchResponsePayload["categories"] = {
  questions: [],
  topics: [],
  navigation: [],
};

type FlatSearchItem = SearchResultItem;

type ClientCacheEntry = {
  expiresAt: number;
  payload: SearchResponsePayload;
};

export interface GlobalSearchProps {
  userId?: string;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
}

function flattenCategories(categories: SearchResponsePayload["categories"]): FlatSearchItem[] {
  const ordered: FlatSearchItem[] = [];

  for (const category of CATEGORY_ORDER) {
    ordered.push(...categories[category]);
  }

  return ordered;
}

function pruneClientCache(cache: Map<string, ClientCacheEntry>): void {
  const now = Date.now();

  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }

  if (cache.size <= MAX_CACHE_ENTRIES) {
    return;
  }

  const sorted = Array.from(cache.entries()).sort((left, right) => left[1].expiresAt - right[1].expiresAt);
  const removeCount = cache.size - Math.floor(MAX_CACHE_ENTRIES * 0.8);

  for (let index = 0; index < removeCount; index += 1) {
    const cacheKey = sorted[index]?.[0];
    if (cacheKey) {
      cache.delete(cacheKey);
    }
  }
}

export function GlobalSearch(props: GlobalSearchProps) {
  const {
    userId,
    className,
    inputClassName,
    placeholder = "Search questions, topics, companies, and features...",
    autoFocus = false,
    onNavigate,
  } = props;

  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [categories, setCategories] = React.useState<SearchResponsePayload["categories"]>(EMPTY_CATEGORIES);
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const requestControllerRef = React.useRef<AbortController | null>(null);
  const cacheRef = React.useRef<Map<string, ClientCacheEntry>>(new Map());

  const normalizedUserId = userId?.trim() ?? "guest";

  const flatResults = React.useMemo(() => flattenCategories(categories), [categories]);

  const itemIndexMap = React.useMemo(() => {
    const map = new Map<string, number>();
    flatResults.forEach((item, index) => {
      map.set(`${item.category}:${item.id}`, index);
    });
    return map;
  }, [flatResults]);

  const closeDropdown = React.useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const handleSelectResult = React.useCallback(
    (item: FlatSearchItem) => {
      closeDropdown();
      setQuery("");
      router.push(item.href);
      onNavigate?.();
    },
    [closeDropdown, onNavigate, router]
  );

  React.useEffect(() => {
    return () => {
      requestControllerRef.current?.abort();
    };
  }, []);

  React.useEffect(() => {
    setOpen(false);
    setActiveIndex(-1);
    setQuery("");
    setErrorMessage(null);
  }, [pathname]);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      if (event.target instanceof Node && !container.contains(event.target)) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [closeDropdown]);

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (event.key.toLowerCase() !== "k") {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  React.useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      requestControllerRef.current?.abort();
      setLoading(false);
      setErrorMessage(null);
      setCategories(EMPTY_CATEGORIES);
      setActiveIndex(-1);
      return;
    }

    setOpen(true);
    setLoading(true);
    setErrorMessage(null);
    setActiveIndex(-1);

    const timer = window.setTimeout(() => {
      const cacheKey = `${normalizedUserId}:${trimmed.toLowerCase()}`;
      const cached = cacheRef.current.get(cacheKey);

      if (cached && cached.expiresAt > Date.now()) {
        setCategories(cached.payload.categories);
        setLoading(false);
        return;
      }

      requestControllerRef.current?.abort();
      const controller = new AbortController();
      requestControllerRef.current = controller;

      const searchUrl = new URL("/api/search", window.location.origin);
      searchUrl.searchParams.set("q", trimmed);
      if (userId?.trim()) {
        searchUrl.searchParams.set("userId", userId.trim());
      }

      void fetch(searchUrl.toString(), { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Search request failed (${response.status})`);
          }

          return (await response.json()) as SearchResponsePayload;
        })
        .then((payload) => {
          if (controller.signal.aborted) {
            return;
          }

          setCategories(payload.categories);
          setLoading(false);
          cacheRef.current.set(cacheKey, {
            expiresAt: Date.now() + CLIENT_CACHE_TTL_MS,
            payload,
          });
          pruneClientCache(cacheRef.current);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) {
            return;
          }

          console.error("[global-search] request failed", error);
          setLoading(false);
          setCategories(EMPTY_CATEGORIES);
          setErrorMessage("Search is temporarily unavailable.");
        });
    }, FETCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [normalizedUserId, query, userId]);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const total = flatResults.length;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (total === 0) {
        return;
      }

      setOpen(true);
      setActiveIndex((previous) => {
        if (previous < 0) {
          return 0;
        }

        return (previous + 1) % total;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (total === 0) {
        return;
      }

      setOpen(true);
      setActiveIndex((previous) => {
        if (previous < 0) {
          return total - 1;
        }

        return (previous - 1 + total) % total;
      });
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
      return;
    }

    if (event.key === "Enter") {
      if (!open || total === 0) {
        return;
      }

      event.preventDefault();

      const selected = activeIndex >= 0 ? flatResults[activeIndex] : flatResults[0];
      if (selected) {
        handleSelectResult(selected);
      }
    }
  };

  const hasResults = flatResults.length > 0;
  const hasQuery = query.trim().length > 0;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
      {loading ? <Loader2 className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" /> : null}
      {!loading ? (
        <span className="pointer-events-none absolute right-3 top-2 hidden rounded-md border border-border/70 bg-card/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline-flex">
          Ctrl K
        </span>
      ) : null}

      <Input
        ref={inputRef}
        type="search"
        value={query}
        onFocus={() => {
          if (query.trim().length > 0) {
            setOpen(true);
          }
        }}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder}
        className={cn("h-9 rounded-xl border-border/80 bg-card/60 pl-9 pr-16", inputClassName)}
        aria-label="Global search"
        aria-expanded={open}
        aria-controls="global-search-results"
        autoComplete="off"
        autoFocus={autoFocus}
      />

      {open ? (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-50 max-h-[min(70vh,30rem)] overflow-y-auto rounded-2xl border border-border/80 bg-card/95 p-2 shadow-2xl backdrop-blur"
        >
          {loading ? (
            <div className="flex items-center gap-2 rounded-xl px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : null}

          {!loading && errorMessage ? <div className="rounded-xl px-3 py-3 text-sm text-destructive">{errorMessage}</div> : null}

          {!loading && !errorMessage && !hasResults ? (
            <div className="rounded-xl px-3 py-4 text-sm text-muted-foreground">
              {hasQuery ? "No matches found for this query." : "Start typing to search globally."}
            </div>
          ) : null}

          {!loading && !errorMessage && hasResults
            ? CATEGORY_ORDER.map((category) => {
                const items = categories[category];
                if (items.length === 0) {
                  return null;
                }

                return (
                  <section key={category} className="py-1">
                    <h4 className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {CATEGORY_LABELS[category]}
                    </h4>

                    <div className="space-y-1">
                      {items.map((item) => {
                        const indexKey = `${item.category}:${item.id}`;
                        const itemIndex = itemIndexMap.get(indexKey) ?? -1;
                        const isActive = itemIndex >= 0 && itemIndex === activeIndex;

                        return (
                          <button
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            key={item.id}
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setActiveIndex(itemIndex)}
                            onClick={() => handleSelectResult(item)}
                            className={cn(
                              "w-full rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors",
                              isActive
                                ? "border-primary/35 bg-primary/10"
                                : "hover:border-border/70 hover:bg-secondary/55"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                                <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                              </div>
                              <div className="shrink-0 rounded-md border border-border/70 bg-secondary/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {item.badge ?? KIND_LABELS[item.kind]}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })
            : null}
        </div>
      ) : null}
    </div>
  );
}

export default GlobalSearch;
