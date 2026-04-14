"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { ArrowRight, Loader2, Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { useIntelligence } from "@/features/intelligence/context/IntelligenceProvider";
import type { IntelligenceSignalSeverity, UserIntelligenceSnapshot } from "@/features/intelligence/types";
import { cn } from "@/lib/utils";

type TrendDirection = "up" | "down" | "flat";

interface PerformanceTrend {
  recentAverage: number;
  previousAverage: number | null;
  drop: number;
  direction: TrendDirection;
}

interface RankedWeakness {
  topic: string;
  confidence: number;
  trend: TrendDirection;
  frequency: number;
  recencyLabel: string;
  recentSessionMentions: number;
  route: string;
  rankScore: number;
}

interface SkillProgressCard {
  skill: string;
  level: number;
  trend: TrendDirection;
  evidenceCount: number;
}

const CODING_TOPIC_KEYWORDS = [
  "recursion",
  "dynamic programming",
  "dp",
  "graph",
  "tree",
  "array",
  "string",
  "linked list",
  "stack",
  "queue",
  "binary search",
  "sorting",
  "hash",
  "algorithm",
  "backtracking",
  "greedy",
  "sliding window",
  "two pointer",
  "coding",
];

const CS_REVISION_KEYWORDS = [
  "dbms",
  "database",
  "sql",
  "normalization",
  "join",
  "joins",
  "operating system",
  "os",
  "oops",
  "object oriented",
  "computer networks",
  "network",
  "cn",
  "system design",
  "microservice",
  "api design",
];

const COMMUNICATION_KEYWORDS = [
  "communication",
  "confidence",
  "fluency",
  "conciseness",
  "answer structure",
  "storytelling",
  "behavioral",
  "presentation",
];

const APTITUDE_KEYWORDS = [
  "aptitude",
  "probability",
  "permutation",
  "combination",
  "ratio",
  "percentage",
  "puzzle",
  "logical reasoning",
  "quant",
  "time and work",
  "speed",
  "accuracy",
];

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function containsAny(topic: string, keywords: string[]): boolean {
  const lowerTopic = topic.toLowerCase();
  return keywords.some((keyword) => lowerTopic.includes(keyword));
}

function routeForTopic(topic: string): string {
  if (containsAny(topic, CODING_TOPIC_KEYWORDS)) return "/code-playground";
  if (containsAny(topic, CS_REVISION_KEYWORDS)) return "/revision";
  if (containsAny(topic, COMMUNICATION_KEYWORDS)) return "/interview";
  if (containsAny(topic, APTITUDE_KEYWORDS)) return "/aptitude";
  return "/mcq";
}

function severityWeight(severity: IntelligenceSignalSeverity): number {
  if (severity === "high") return 100;
  if (severity === "medium") return 65;
  return 35;
}

function maxSeverity(
  left: IntelligenceSignalSeverity,
  right: IntelligenceSignalSeverity
): IntelligenceSignalSeverity {
  return severityWeight(right) > severityWeight(left) ? right : left;
}

function confidenceLabel(score: number): string {
  if (score < 45) return "Low confidence";
  if (score < 65) return "Moderate confidence";
  return "Stable confidence";
}

function confidenceBarClass(score: number): string {
  if (score < 45) return "bg-destructive";
  if (score < 65) return "bg-amber-500";
  return "bg-emerald-500";
}

function trendMeta(trend: TrendDirection): {
  label: string;
  Icon: typeof TrendingUp;
  className: string;
  symbol: string;
} {
  if (trend === "down") {
    return {
      label: "Declining",
      Icon: TrendingDown,
      className: "text-destructive",
      symbol: "\u2193",
    };
  }

  if (trend === "up") {
    return {
      label: "Improving",
      Icon: TrendingUp,
      className: "text-emerald-600",
      symbol: "\u2191",
    };
  }

  return {
    label: "Stable",
    Icon: Minus,
    className: "text-muted-foreground",
    symbol: "\u2192",
  };
}

function summarizeRecentPerformance(snapshot: UserIntelligenceSnapshot): PerformanceTrend {
  const sortedHistory = [...snapshot.history].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const recentScores = sortedHistory.slice(0, 5).map((entry) => entry.score);
  const previousScores = sortedHistory.slice(5, 10).map((entry) => entry.score);

  const fallbackRecent =
    (snapshot.metrics.interviewReadiness +
      snapshot.metrics.technicalDepth +
      snapshot.metrics.problemSolving +
      snapshot.metrics.consistency) /
    4;

  const recentAverage = average(recentScores) ?? fallbackRecent;
  const previousAverage = average(previousScores);
  const drop = previousAverage === null ? 0 : Math.max(0, previousAverage - recentAverage);
  const delta = previousAverage === null ? 0 : recentAverage - previousAverage;

  let direction: TrendDirection = "flat";
  if (delta >= 2.5) direction = "up";
  else if (delta <= -2.5) direction = "down";

  return {
    recentAverage,
    previousAverage,
    drop,
    direction,
  };
}

function buildWeaknessRanking(
  snapshot: UserIntelligenceSnapshot,
  performance: PerformanceTrend
): RankedWeakness[] {
  const sortedHistory = [...snapshot.history].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const topicScores = new Map<string, number[]>();
  const recentMentions = new Map<string, number>();

  sortedHistory.forEach((entry, index) => {
    if (!entry.topic) return;
    const key = normalizeKey(entry.topic);
    if (!key) return;

    const scores = topicScores.get(key) ?? [];
    scores.push(entry.score);
    topicScores.set(key, scores);

    if (index < 6) {
      recentMentions.set(key, (recentMentions.get(key) ?? 0) + 1);
    }
  });

  const skillConfidence = new Map<string, number>();
  Object.values(snapshot.skills).forEach((skill) => {
    const key = normalizeKey(skill.skill);
    if (!key) return;
    skillConfidence.set(key, clampScore(skill.confidence));
  });

  type Aggregate = {
    topic: string;
    severity: IntelligenceSignalSeverity;
    frequency: number;
    lastSeenMs: number | null;
  };

  const topicMap = new Map<string, Aggregate>();

  snapshot.weakSignals.forEach((signal) => {
    const key = normalizeKey(signal.topic);
    if (!key) return;

    const signalCount = Math.max(1, signal.count);
    const signalTimestamp = parseTimestamp(signal.lastUpdated);
    const existing = topicMap.get(key);

    if (!existing) {
      topicMap.set(key, {
        topic: signal.topic,
        severity: signal.severity,
        frequency: signalCount,
        lastSeenMs: signalTimestamp,
      });
      return;
    }

    topicMap.set(key, {
      topic: existing.topic,
      severity: maxSeverity(existing.severity, signal.severity),
      frequency: existing.frequency + signalCount,
      lastSeenMs:
        signalTimestamp !== null && (existing.lastSeenMs === null || signalTimestamp > existing.lastSeenMs)
          ? signalTimestamp
          : existing.lastSeenMs,
    });
  });

  snapshot.weakAreas.forEach((area) => {
    const key = normalizeKey(area);
    if (!key) return;

    const existing = topicMap.get(key);
    if (!existing) {
      topicMap.set(key, {
        topic: area,
        severity: "low",
        frequency: 1,
        lastSeenMs: null,
      });
      return;
    }

    topicMap.set(key, {
      ...existing,
      frequency: existing.frequency + 1,
    });
  });

  const nowMs = Date.now();
  const ranked = Array.from(topicMap.entries()).map(([key, aggregate]) => {
    const scores = topicScores.get(key) ?? [];
    const recentScores = scores.slice(0, 3);
    const previousScores = scores.slice(3, 6);
    const recentAverage = average(recentScores);
    const previousAverage = average(previousScores);

    const topicDrop =
      recentAverage !== null && previousAverage !== null
        ? Number((previousAverage - recentAverage).toFixed(1))
        : Number((performance.drop * 0.35).toFixed(1));

    let trend: TrendDirection = "flat";
    if (recentAverage !== null && previousAverage !== null) {
      const topicDelta = recentAverage - previousAverage;
      if (topicDelta >= 2.5) trend = "up";
      else if (topicDelta <= -2.5) trend = "down";
    } else if (topicDrop >= 6 || (aggregate.severity === "high" && aggregate.frequency >= 3)) {
      trend = "down";
    } else if (topicDrop <= -4 || performance.direction === "up") {
      trend = "up";
    }

    const daysSince =
      aggregate.lastSeenMs === null
        ? null
        : Math.max(0, Math.floor((nowMs - aggregate.lastSeenMs) / (1000 * 60 * 60 * 24)));

    const learnedConfidence = skillConfidence.get(key) ?? null;

    let confidence = learnedConfidence;
    if (confidence === null) {
      const base = aggregate.severity === "high" ? 48 : aggregate.severity === "medium" ? 58 : 68;
      const frequencyPenalty = Math.min(24, aggregate.frequency * 3);
      const recencyPenalty = daysSince === null ? 0 : Math.max(0, 14 - daysSince * 2.5);
      const dropPenalty = Math.min(12, Math.max(0, topicDrop) * 1.2);
      confidence = clampScore(base - frequencyPenalty - recencyPenalty - dropPenalty);
    } else {
      confidence = clampScore(confidence - Math.min(10, Math.max(0, aggregate.frequency - 1)));
    }

    if (trend === "up") confidence = clampScore(confidence + 4);
    if (trend === "down") confidence = clampScore(confidence - 3);

    const frequencySignal = Math.min(100, aggregate.frequency * 14);
    const recencySignal = daysSince === null ? 35 : Math.max(0, 100 - daysSince * 18);
    const scoreDropSignal = Math.min(100, Math.max(0, topicDrop) * 10);

    const rankScore =
      frequencySignal * 0.4 +
      recencySignal * 0.3 +
      scoreDropSignal * 0.2 +
      severityWeight(aggregate.severity) * 0.1;

    const recencyLabel =
      daysSince === null ? "recently tracked" : daysSince === 0 ? "updated today" : `updated ${daysSince}d ago`;

    return {
      topic: aggregate.topic,
      confidence,
      trend,
      frequency: aggregate.frequency,
      recencyLabel,
      recentSessionMentions: recentMentions.get(key) ?? 0,
      route: routeForTopic(aggregate.topic),
      rankScore,
    } satisfies RankedWeakness;
  });

  return ranked
    .sort((left, right) => {
      const byRank = right.rankScore - left.rankScore;
      if (byRank !== 0) return byRank;
      return left.confidence - right.confidence;
    })
    .slice(0, 4);
}

function buildInsights(
  rankedWeaknesses: RankedWeakness[],
  snapshot: UserIntelligenceSnapshot,
  performance: PerformanceTrend
): { primary: string; secondary: string; ctaRoute: string; ctaTopic: string } {
  const top = rankedWeaknesses[0];

  if (!top) {
    return {
      primary: "No active weak topics found yet.",
      secondary: "Complete one interview, revision, or coding session to generate personalized insights.",
      ctaRoute: "/interview",
      ctaTopic: "mock interview",
    };
  }

  const mentionCount =
    top.recentSessionMentions >= 2 ? top.recentSessionMentions : Math.min(3, Math.max(1, top.frequency));

  const primary =
    mentionCount >= 3
      ? `You struggle with ${top.topic} in the last ${mentionCount} sessions.`
      : `${top.topic} is appearing repeatedly in your recent weak signals.`;

  const improvingTopic = rankedWeaknesses.find((item) => item.trend === "up" && item.topic !== top.topic);

  const secondary = improvingTopic
    ? `Improving in ${improvingTopic.topic}. Keep momentum with short focused drills.`
    : snapshot.strongAreas[0]
      ? `Improving in ${snapshot.strongAreas[0]}. Build on this momentum with mixed practice.`
      : performance.direction === "down" && performance.drop >= 5
        ? `Recent performance dropped by ${Math.round(performance.drop)} points. Prioritize targeted recovery practice.`
        : `Recent performance is ${Math.round(performance.recentAverage)}%. Consistent sessions will keep this trend healthy.`;

  return {
    primary,
    secondary,
    ctaRoute: top.route,
    ctaTopic: top.topic,
  };
}

function trendForTopic(snapshot: UserIntelligenceSnapshot, topic: string): TrendDirection {
  const topicKey = normalizeKey(topic);
  if (!topicKey) return "flat";

  const topicScores = [...snapshot.history]
    .filter((entry) => {
      if (!entry.topic) return false;
      const entryKey = normalizeKey(entry.topic);
      return entryKey.includes(topicKey) || topicKey.includes(entryKey);
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((entry) => entry.score);

  const recentAverage = average(topicScores.slice(0, 3));
  const previousAverage = average(topicScores.slice(3, 6));

  if (recentAverage === null || previousAverage === null) {
    return "flat";
  }

  const delta = recentAverage - previousAverage;
  if (delta >= 2.5) return "up";
  if (delta <= -2.5) return "down";
  return "flat";
}

function buildSkillProgressCards(snapshot: UserIntelligenceSnapshot): SkillProgressCard[] {
  const skillEntries = Object.values(snapshot.skills)
    .filter((entry) => entry.skill.trim().length > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4)
    .map((entry) => ({
      skill: entry.skill,
      level: clampScore(entry.confidence),
      trend: trendForTopic(snapshot, entry.skill),
      evidenceCount: entry.evidenceCount,
    }));

  if (skillEntries.length > 0) {
    return skillEntries;
  }

  return Object.entries(snapshot.mastery)
    .sort(([, left], [, right]) => right.score - left.score)
    .slice(0, 4)
    .map(([skill, mastery]) => ({
      skill,
      level: clampScore(mastery.score),
      trend: trendForTopic(snapshot, skill),
      evidenceCount: mastery.attempts,
    }));
}

export default function HomeWeaknessInsights() {
  const { snapshot, loading, error, refresh } = useIntelligence();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, 45000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  const performance = useMemo(() => {
    if (!snapshot) return null;
    return summarizeRecentPerformance(snapshot);
  }, [snapshot]);

  const rankedWeaknesses = useMemo(() => {
    if (!snapshot || !performance) return [];
    return buildWeaknessRanking(snapshot, performance);
  }, [snapshot, performance]);

  const insights = useMemo(() => {
    if (!snapshot || !performance) return null;
    return buildInsights(rankedWeaknesses, snapshot, performance);
  }, [snapshot, rankedWeaknesses, performance]);

  const skillProgressCards = useMemo(() => {
    if (!snapshot) return [];
    return buildSkillProgressCards(snapshot);
  }, [snapshot]);

  if (loading && !snapshot) {
    return (
      <div className="space-y-3">
        <div className="h-20 animate-pulse rounded-2xl border border-border/70 bg-muted/40" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-2xl border border-border/70 bg-muted/35" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <div className="font-medium text-destructive">Unable to load intelligence insights</div>
          <div className="mt-1 text-muted-foreground">{error}</div>
        </div>
        <Button variant="outline" onClick={() => void refresh()} className="w-full justify-between rounded-2xl">
          Retry loading insights
          <Loader2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (!snapshot || !performance || rankedWeaknesses.length === 0 || !insights) {
    return (
      <div className="space-y-3 text-sm">
        <div className="rounded-2xl border border-border/80 bg-secondary/55 p-4">
          <div className="font-medium">No insights yet</div>
          <div className="mt-1 text-muted-foreground">
            Finish an interview session to unlock AI weakness analysis and targeted next steps.
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild variant="outline" className="w-full justify-between rounded-2xl">
            <Link href="/interview">
              Run a mock interview
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full justify-between rounded-2xl">
            <Link href="/revision">
              Open smart revision
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const performanceTrend = trendMeta(performance.direction);
  const performanceDelta =
    performance.previousAverage === null
      ? "New baseline"
      : performance.direction === "flat"
        ? "Stable"
        : `${performance.direction === "down" ? "-" : "+"}${Math.abs(
            Math.round(performance.recentAverage - performance.previousAverage)
          )} pts`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-secondary/45 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Recent Performance</p>
          <p className="text-2xl font-semibold tabular-nums">{Math.round(performance.recentAverage)}%</p>
        </div>
        <div className={cn("inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm", performanceTrend.className)}>
          <performanceTrend.Icon className="h-4 w-4" />
          <span>{performanceDelta}</span>
        </div>
      </div>

      {skillProgressCards.length > 0 ? (
        <div className="rounded-2xl border border-border/80 bg-card/65 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skill Progress Cards</p>
            <p className="text-[11px] text-muted-foreground">Level (0-100) + trend</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {skillProgressCards.map((skill) => {
              const trend = trendMeta(skill.trend);

              return (
                <div key={skill.skill} className="rounded-xl border border-border/70 bg-secondary/45 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{skill.skill}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{skill.evidenceCount} evidence points</p>
                    </div>

                    <div className={cn("inline-flex items-center gap-1 text-xs font-medium", trend.className)}>
                      <trend.Icon className="h-3.5 w-3.5" />
                      <span>{trend.symbol}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{trend.label}</span>
                    <span className="font-medium tabular-nums">{skill.level}</span>
                  </div>

                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted/70">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${skill.level}%` }}
                      transition={{ duration: 0.55, ease: "easeOut" }}
                      className="h-full rounded-full bg-primary"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {rankedWeaknesses.map((weakness, index) => {
          const trend = trendMeta(weakness.trend);

          return (
            <motion.div
              key={weakness.topic}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.08 }}
              className="rounded-2xl border border-border/80 bg-card/65 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{weakness.topic}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{weakness.frequency} signals • {weakness.recencyLabel}</p>
                </div>
                <div className={cn("inline-flex items-center gap-1 text-xs font-medium", trend.className)}>
                  <trend.Icon className="h-3.5 w-3.5" />
                  <span>{trend.symbol}</span>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{confidenceLabel(weakness.confidence)}</span>
                  <span className="tabular-nums text-foreground/90">{weakness.confidence}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted/70">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${weakness.confidence}%` }}
                    transition={{ duration: 0.7, delay: 0.15 + index * 0.08, ease: "easeOut" }}
                    className={cn("h-full rounded-full", confidenceBarClass(weakness.confidence))}
                  />
                </div>
              </div>

              <Button asChild size="sm" variant="outline" className="mt-4 w-full justify-between rounded-xl">
                <Link href={weakness.route}>
                  Practice Now
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.18 }}
        className="rounded-2xl border border-primary/25 bg-primary/5 p-4"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Smart Insights
        </div>
        <p className="mt-2 text-sm">{insights.primary}</p>
        <p className="mt-1 text-sm text-muted-foreground">{insights.secondary}</p>
        <Button asChild variant="ghost" className="mt-3 h-9 w-full justify-between rounded-xl sm:w-auto">
          <Link href={insights.ctaRoute}>
            Practice {insights.ctaTopic}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </motion.div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild variant="outline" className="w-full justify-between rounded-2xl">
          <Link href={rankedWeaknesses[0]?.route ?? "/mcq"}>
            Continue targeted practice
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="ghost" className="w-full justify-between rounded-2xl">
          <Link href="/revision">
            Open smart revision
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
