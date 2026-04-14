"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import useSWR from "swr";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

interface SubjectProgressHeatmapProps {
  userId: string;
  embedded?: boolean;
}

const SUBJECTS = ["OS", "DBMS", "OOPS", "CN", "DSA"];

const SUBJECT_TOPICS: Record<string, string[]> = {
  OS: [
    "Process Management",
    "Threads",
    "CPU Scheduling",
    "Deadlocks",
    "Memory Management",
    "Virtual Memory",
    "File Systems",
    "Disk Scheduling",
    "Synchronization",
    "Inter-Process Communication",
  ],
  DBMS: [
    "ER Diagrams",
    "Normalization",
    "SQL Queries",
    "Transactions",
    "ACID Properties",
    "Indexing",
    "B+ Trees",
    "Concurrency Control",
    "Recovery",
    "Query Optimization",
  ],
  OOPS: [
    "Classes & Objects",
    "Inheritance",
    "Polymorphism",
    "Encapsulation",
    "Abstraction",
    "Interfaces",
    "Constructors",
    "Method Overloading",
    "Method Overriding",
    "Design Patterns",
  ],
  CN: [
    "OSI Model",
    "TCP/IP",
    "HTTP/HTTPS",
    "Routing",
    "DNS",
    "Network Security",
    "Socket Programming",
    "Network Protocols",
    "Subnetting",
    "Network Devices",
  ],
  DSA: [
    "Arrays",
    "Linked Lists",
    "Stacks",
    "Queues",
    "Trees",
    "Graphs",
    "Sorting",
    "Searching",
    "Dynamic Programming",
    "Greedy Algorithms",
  ],
};

function isUserProgressResponse(value: unknown): value is UserProgress {
  return (
    typeof value === "object" &&
    value !== null &&
    "subject" in value &&
    "topics" in value
  );
}

const SubjectProgressHeatmap = ({ userId, embedded = false }: SubjectProgressHeatmapProps) => {
  const [selectedSubject, setSelectedSubject] = useState<string>("OS");
  const progressKey = `/api/progress/get-heatmap?userId=${encodeURIComponent(userId)}`;

  const {
    data: allProgress = [],
    error,
    isLoading,
  } = useSWR<UserProgress[]>(
    progressKey,
    async (url: string) => {
      const result = await api.get<unknown>(url, {
        cache: "default",
        maxRetries: 2,
        retryDelay: 800,
        timeout: 18000,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch progress summary");
      }

      return Array.isArray(result.data)
        ? result.data.filter(isUserProgressResponse)
        : [];
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 20000,
      keepPreviousData: true,
    }
  );

  const loading = isLoading && allProgress.length === 0;
  const errorMessage = error instanceof Error ? error.message : null;

  const progressData = useMemo<UserProgress>(() => {
    const normalizedSubject = selectedSubject.trim().toLowerCase();
    const matched = allProgress.find((entry) => entry.subject.trim().toLowerCase() === normalizedSubject);

    if (matched) {
      return matched;
    }

    return {
      userId,
      subject: selectedSubject,
      topics: {},
      overallStrength: 0,
      updatedAt: new Date(0).toISOString(),
    };
  }, [allProgress, selectedSubject, userId]);

  const getSubjectOverallStrength = (subject: string): number => {
    const progress = allProgress.find((p) => p.subject === subject);
    return progress?.overallStrength || 0;
  };

  const stats = useMemo(() => {
    const topics = Object.values(progressData.topics);
    const total = SUBJECT_TOPICS[selectedSubject].length;
    const strong = topics.filter((t) => t.status === "STRONG").length;
    const moderate = topics.filter((t) => t.status === "MODERATE").length;
    const weak = topics.filter((t) => t.status === "WEAK").length;
    const notAttempted =
      topics.filter((t) => t.status === "NOT_ATTEMPTED").length + (total - topics.length);

    return { total, strong, moderate, weak, notAttempted };
  }, [progressData, selectedSubject]);

  const statusMeta = {
    STRONG: {
      label: "Strong",
      cell: "border-primary/25 bg-primary/10",
      badge: "border-primary/25 bg-primary/15 text-primary",
    },
    MODERATE: {
      label: "Moderate",
      cell: "border-primary/15 bg-primary/5",
      badge: "border-primary/15 bg-primary/10 text-primary",
    },
    WEAK: {
      label: "Weak",
      cell: "border-destructive/25 bg-destructive/10",
      badge: "border-destructive/25 bg-destructive/10 text-destructive",
    },
    NOT_ATTEMPTED: {
      label: "Not Attempted",
      cell: "border-border/70 bg-muted/40",
      badge: "border-border/70 bg-muted text-muted-foreground",
    },
  } as const;

  return (
    <div className={cn("space-y-4", embedded ? "" : "space-y-6")}> 
      {!embedded && (
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Subject Progress</h1>
          <p className="text-sm text-muted-foreground">
            Track your mastery across subjects and topics.
          </p>
        </div>
      )}

      {/* Subject selector */}
      <div className="flex flex-wrap gap-2">
        {SUBJECTS.map((subject) => {
          const strength = getSubjectOverallStrength(subject);
          const active = selectedSubject === subject;
          return (
            <Button
              key={subject}
              type="button"
              variant={active ? "secondary" : "ghost"}
              className={cn(
                "h-9 rounded-2xl px-3",
                !active && "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setSelectedSubject(subject)}
            >
              <span className="font-medium">{subject}</span>
              <span className="ml-2 text-xs text-muted-foreground">{Math.round(strength)}%</span>
            </Button>
          );
        })}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border bg-card/40 p-4">
            <div className="text-xs text-muted-foreground">Strong</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">{stats.strong}</div>
          </div>
          <div className="rounded-2xl border bg-card/40 p-4">
            <div className="text-xs text-muted-foreground">Moderate</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">{stats.moderate}</div>
          </div>
          <div className="rounded-2xl border bg-card/40 p-4">
            <div className="text-xs text-muted-foreground">Weak</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">{stats.weak}</div>
          </div>
          <div className="rounded-2xl border bg-card/40 p-4">
            <div className="text-xs text-muted-foreground">Not Attempted</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">{stats.notAttempted}</div>
          </div>
        </div>
      )}

      {/* Heatmap */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-2xl border bg-card/40 p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="mt-3 h-3 w-1/2" />
                <Skeleton className="mt-2 h-3 w-2/3" />
              </div>
            ))}
          </motion.div>
        ) : errorMessage ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border bg-card/40 p-4 text-sm"
          >
            <div className="font-medium">Unable to load heatmap</div>
            <div className="mt-1 text-muted-foreground">{errorMessage}</div>
          </motion.div>
        ) : (
          <motion.div
            key={selectedSubject}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {SUBJECT_TOPICS[selectedSubject].map((topicName, index) => {
              const topicData = progressData?.topics[topicName];
              const status = topicData?.status || "NOT_ATTEMPTED";
              const successRate = topicData?.successRate || 0;
              const attempts = topicData?.attempts || 0;

              const meta = statusMeta[status];

              return (
                <motion.div
                  key={topicName}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(index * 0.02, 0.18) }}
                  whileHover={{ y: -2 }}
                  className={cn(
                    "rounded-2xl border p-4 shadow-sm transition-colors",
                    "bg-card/50",
                    meta.cell
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{topicName}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {attempts > 0 ? `${attempts} attempts` : "No attempts yet"}
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("shrink-0", meta.badge)}>
                      {meta.label}
                    </Badge>
                  </div>

                  <div className="mt-4 flex items-end justify-between">
                    <div className="text-2xl font-semibold tracking-tight">
                      {attempts > 0 ? `${Math.round(successRate)}%` : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">Success</div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-primary/25 bg-primary/10" />
          <span>Strong</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-primary/15 bg-primary/5" />
          <span>Moderate</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-destructive/25 bg-destructive/10" />
          <span>Weak</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-border/70 bg-muted/40" />
          <span>Not attempted</span>
        </div>
      </div>
    </div>
  );
};

export default SubjectProgressHeatmap;
