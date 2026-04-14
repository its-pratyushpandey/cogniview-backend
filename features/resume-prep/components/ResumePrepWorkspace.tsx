"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FilePenLine, FileSearch } from "lucide-react";

import { cn } from "@/lib/utils";
import { ResumeAnalysisShell } from "@/features/resume-analysis/components/ResumeAnalysisShell";
import { ResumeBuilderPanel } from "@/features/resume-builder/components/ResumeBuilderPanel";

type ResumePrepTab = "analyzer" | "builder";

interface ResumePrepWorkspaceProps {
  userId: string;
  initialTab: ResumePrepTab;
}

const TAB_ITEMS: Array<{
  id: ResumePrepTab;
  label: string;
  description: string;
  icon: typeof FileSearch;
}> = [
  {
    id: "analyzer",
    label: "Analyzer",
    description: "Map resume to weak areas and interview questions",
    icon: FileSearch,
  },
  {
    id: "builder",
    label: "Builder",
    description: "Build role-focused resume drafts and variants",
    icon: FilePenLine,
  },
];

function resolveTab(value: string | null | undefined): ResumePrepTab {
  return value?.toLowerCase() === "builder" ? "builder" : "analyzer";
}

export function ResumePrepWorkspace({ userId, initialTab }: ResumePrepWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<ResumePrepTab>(resolveTab(initialTab));

  useEffect(() => {
    setActiveTab(resolveTab(queryTab ?? initialTab));
  }, [initialTab, queryTab]);

  const activeTabMeta = useMemo(() => {
    return TAB_ITEMS.find((item) => item.id === activeTab) ?? TAB_ITEMS[0];
  }, [activeTab]);

  const handleTabChange = useCallback(
    (tab: ResumePrepTab) => {
      if (tab === activeTab) {
        return;
      }

      setActiveTab(tab);

      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("tab", tab);

      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [activeTab, pathname, router, searchParams]
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-5 lg:px-8">
      <section className="rounded-3xl border border-border/80 bg-card/65 p-3 shadow-md backdrop-blur sm:p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Resume Prep</p>
            <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Analyzer and Builder in one workspace
            </h1>
            <p className="text-sm text-muted-foreground">{activeTabMeta.description}</p>
          </div>

          <div
            className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-border/80 bg-secondary/60 p-1"
            role="tablist"
            aria-label="Resume prep tabs"
          >
            {TAB_ITEMS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`resume-tab-panel-${tab.id}`}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "relative inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="resume-prep-active-tab"
                      className="absolute inset-0 rounded-xl border border-primary/30 bg-primary/15 shadow-[0_0_0_1px_rgba(59,130,246,0.18)]"
                      transition={{ type: "spring", stiffness: 360, damping: 32 }}
                    />
                  ) : null}

                  <Icon className="relative z-10 h-4 w-4" />
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          id={`resume-tab-panel-${activeTab}`}
          role="tabpanel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="mt-4"
        >
          {activeTab === "analyzer" ? <ResumeAnalysisShell userId={userId} /> : <ResumeBuilderPanel userId={userId} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
