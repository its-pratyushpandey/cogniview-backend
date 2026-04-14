"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Minus,
  RefreshCw,
  Signal,
  Target,
  TrendingUp,
} from "lucide-react";

import { useIntelligence } from "@/features/intelligence/context/IntelligenceProvider";
import type {
  IntelligenceRecommendationPriority,
  IntelligenceSignalSeverity,
  UserIntelligenceSnapshot,
} from "@/features/intelligence/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type InsightTrendDirection = "up" | "down" | "flat";

interface SkillProgressInsight {
  skill: string;
  level: number;
  trend: InsightTrendDirection;
  delta: number;
  evidenceCount: number;
  source: string;
}

interface WeaknessInsightRow {
  topic: string;
  frequency: number;
  trend: InsightTrendDirection;
  severity: IntelligenceSignalSeverity;
  source: string;
}

function recommendationPriorityClassName(priority: IntelligenceRecommendationPriority): string {
  if (priority === "urgent") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (priority === "medium") return "border-amber-500/40 bg-amber-500/10 text-amber-700";
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700";
}

function recommendationCardClassName(priority: IntelligenceRecommendationPriority): string {
  if (priority === "urgent") return "border-destructive/30 bg-destructive/[0.03]";
  if (priority === "medium") return "border-amber-500/30 bg-amber-500/[0.04]";
  return "border-emerald-500/30 bg-emerald-500/[0.04]";
}

function renderRecommendationIcon(priority: IntelligenceRecommendationPriority) {
  if (priority === "urgent") {
    return <AlertTriangle className="h-4 w-4 text-destructive" />;
  }

  if (priority === "medium") {
    return <Clock3 className="h-4 w-4 text-amber-600" />;
  }

  return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
}

function formatRelativeTime(value: string | null): string {
  if (!value) return "No events yet";

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Unknown";

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function normalizeInsightKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function clampLevel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function getTopicScores(snapshot: UserIntelligenceSnapshot, topic: string): number[] {
  const topicKey = normalizeInsightKey(topic);
  if (!topicKey) return [];

  return [...snapshot.history]
    .filter((entry) => {
      if (!entry.topic) return false;
      const entryKey = normalizeInsightKey(entry.topic);
      return entryKey.includes(topicKey) || topicKey.includes(entryKey);
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((entry) => entry.score);
}

function getTrendFromScores(scores: number[]): { direction: InsightTrendDirection; delta: number } {
  const recentAverage = average(scores.slice(0, 3));
  const previousAverage = average(scores.slice(3, 6));

  if (recentAverage === null || previousAverage === null) {
    return { direction: "flat", delta: 0 };
  }

  const delta = Number((recentAverage - previousAverage).toFixed(1));
  if (delta >= 2.5) return { direction: "up", delta };
  if (delta <= -2.5) return { direction: "down", delta };
  return { direction: "flat", delta };
}

function trendVisual(direction: InsightTrendDirection): {
  icon: typeof ArrowUpRight;
  className: string;
  label: string;
  symbol: string;
} {
  if (direction === "up") {
    return {
      icon: ArrowUpRight,
      className: "text-emerald-600",
      label: "Improving",
      symbol: "\u2191",
    };
  }

  if (direction === "down") {
    return {
      icon: ArrowDownRight,
      className: "text-destructive",
      label: "Declining",
      symbol: "\u2193",
    };
  }

  return {
    icon: Minus,
    className: "text-muted-foreground",
    label: "Stable",
    symbol: "\u2192",
  };
}

function severityWeight(severity: IntelligenceSignalSeverity): number {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function buildSkillProgressInsights(snapshot: UserIntelligenceSnapshot): SkillProgressInsight[] {
  const skillEntries = Object.values(snapshot.skills)
    .filter((entry) => entry.skill.trim().length > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6)
    .map((entry) => {
      const trend = getTrendFromScores(getTopicScores(snapshot, entry.skill));

      return {
        skill: entry.skill,
        level: clampLevel(entry.confidence),
        trend: trend.direction,
        delta: Math.abs(Math.round(trend.delta)),
        evidenceCount: Math.max(entry.evidenceCount, 0),
        source: entry.source,
      } satisfies SkillProgressInsight;
    });

  if (skillEntries.length > 0) {
    return skillEntries;
  }

  return Object.entries(snapshot.mastery)
    .sort(([, left], [, right]) => right.score - left.score)
    .slice(0, 6)
    .map(([topic, mastery]) => {
      const trend = getTrendFromScores(getTopicScores(snapshot, topic));

      return {
        skill: topic,
        level: clampLevel(mastery.score),
        trend: trend.direction,
        delta: Math.abs(Math.round(trend.delta)),
        evidenceCount: mastery.attempts,
        source: "mastery",
      } satisfies SkillProgressInsight;
    });
}

function buildWeaknessInsightRows(snapshot: UserIntelligenceSnapshot): WeaknessInsightRow[] {
  const topicMap = new Map<
    string,
    {
      topic: string;
      frequency: number;
      severity: IntelligenceSignalSeverity;
      source: string;
    }
  >();

  snapshot.weakSignals.forEach((signal) => {
    const key = normalizeInsightKey(signal.topic);
    if (!key) return;

    const existing = topicMap.get(key);
    if (!existing) {
      topicMap.set(key, {
        topic: signal.topic,
        frequency: Math.max(1, signal.count),
        severity: signal.severity,
        source: signal.source,
      });
      return;
    }

    topicMap.set(key, {
      topic: existing.topic,
      frequency: existing.frequency + Math.max(1, signal.count),
      severity: severityWeight(signal.severity) > severityWeight(existing.severity) ? signal.severity : existing.severity,
      source: existing.source,
    });
  });

  snapshot.weakAreas.forEach((area) => {
    const key = normalizeInsightKey(area);
    if (!key) return;

    const existing = topicMap.get(key);
    if (!existing) {
      topicMap.set(key, {
        topic: area,
        frequency: 1,
        severity: "low",
        source: "history",
      });
      return;
    }

    topicMap.set(key, {
      ...existing,
      frequency: existing.frequency + 1,
    });
  });

  return Array.from(topicMap.values())
    .map((entry) => ({
      topic: entry.topic,
      frequency: entry.frequency,
      severity: entry.severity,
      source: entry.source,
      trend: getTrendFromScores(getTopicScores(snapshot, entry.topic)).direction,
    }))
    .sort((left, right) => {
      const bySeverity = severityWeight(right.severity) - severityWeight(left.severity);
      if (bySeverity !== 0) return bySeverity;
      return right.frequency - left.frequency;
    })
    .slice(0, 8);
}

export function IntelligenceDashboard({ userId }: { userId: string }) {
  const router = useRouter();
  const { snapshot, recommendations, loading, error, refresh } = useIntelligence();

  if (loading && !snapshot) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <CardDescription>Loading...</CardDescription>
              <CardTitle className="text-3xl">--</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <Card className="border-destructive/40 bg-destructive/10">
        <CardHeader>
          <CardTitle className="text-destructive">Unable to load intelligence snapshot</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void refresh()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No intelligence data available</CardTitle>
          <CardDescription>Start a practice flow to generate your first snapshot.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const skillProgressInsights = buildSkillProgressInsights(snapshot);
  const weaknessInsightRows = buildWeaknessInsightRows(snapshot);
  const topStrengths = snapshot.strengths.slice(0, 8);
  const masteryEntries = Object.entries(snapshot.mastery)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 8);
  const topRecommendedActions = recommendations.slice(0, 3);
  const additionalRecommendedActions = recommendations.slice(3, 6);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border bg-card/60 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">Intelligence Core</CardTitle>
            <CardDescription>
              Unified adaptive state for user {userId} with live signals across interview, practice, and coding.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => void refresh()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Interview Readiness
            </CardDescription>
            <CardTitle className="text-4xl tabular-nums">{Math.round(snapshot.metrics.interviewReadiness)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Signal className="h-4 w-4" /> Technical Depth
            </CardDescription>
            <CardTitle className="text-4xl tabular-nums">{Math.round(snapshot.metrics.technicalDepth)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Target className="h-4 w-4" /> Problem Solving
            </CardDescription>
            <CardTitle className="text-4xl tabular-nums">{Math.round(snapshot.metrics.problemSolving)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Events</CardDescription>
            <CardTitle className="text-4xl tabular-nums">{snapshot.eventStats.totalEvents}</CardTitle>
            <CardDescription>Updated {formatRelativeTime(snapshot.eventStats.lastEventAt)}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="overflow-hidden border bg-card/60 shadow-sm">
        <CardHeader>
          <CardTitle>Skill Progress Cards</CardTitle>
          <CardDescription>Live skill level (0-100) with short-term trend from recent sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          {skillProgressInsights.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {skillProgressInsights.map((skill) => {
                const trend = trendVisual(skill.trend);
                const TrendIcon = trend.icon;

                return (
                  <div key={skill.skill} className="rounded-xl border bg-card/70 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{skill.skill}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{skill.evidenceCount} evidence points</p>
                      </div>
                      <div className={`inline-flex items-center gap-1 text-xs font-medium ${trend.className}`}>
                        <TrendIcon className="h-3.5 w-3.5" />
                        <span>{trend.symbol}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-end justify-between">
                      <p className="text-2xl font-semibold tabular-nums">{skill.level}</p>
                      <p className="text-xs text-muted-foreground">
                        {trend.label}
                        {skill.delta > 0 ? ` (${skill.delta} pts)` : ""}
                      </p>
                    </div>

                    <div className="mt-2 h-2 w-full rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${skill.level}%` }} />
                    </div>

                    <p className="mt-2 text-[11px] text-muted-foreground">Source: {skill.source || "intelligence"}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Skill progress appears after your first tracked activity.</p>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border bg-card/60 shadow-sm">
        <CardHeader>
          <CardTitle>Recommended Actions</CardTitle>
          <CardDescription>
            Dynamic guidance generated from weak areas, recent performance, and your company selection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {topRecommendedActions.length > 0 ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {topRecommendedActions.map((item, index) => (
                  <div
                    key={`${item.action}-${item.route}`}
                    className={`rounded-xl border p-4 ${recommendationCardClassName(item.priority)}`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <Badge variant="outline" className={recommendationPriorityClassName(item.priority)}>
                        {item.priority}
                      </Badge>
                      {renderRecommendationIcon(item.priority)}
                    </div>
                    <p className="text-sm font-semibold leading-snug">{item.action}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{item.reason}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full justify-between"
                      onClick={() => router.push(item.route)}
                    >
                      Start Action
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <p className="mt-2 text-[11px] text-muted-foreground">Top {index + 1} priority</p>
                  </div>
                ))}
              </div>

              {additionalRecommendedActions.length > 0 ? (
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Additional Suggestions
                  </p>
                  <div className="space-y-2">
                    {additionalRecommendedActions.map((item) => (
                      <div
                        key={`${item.action}-${item.route}`}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{item.action}</p>
                          <p className="text-xs text-muted-foreground">{item.reason}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => router.push(item.route)}>
                          Open
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Complete at least one tracked session to unlock personalized recommendations.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Current Context</CardTitle>
            <CardDescription>Shared company and role alignment across modules.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Company</span>
              <span className="font-medium">{snapshot.context.companyId || "Not selected"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium">{snapshot.context.roleId || snapshot.context.targetRole || "Not selected"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Company Type</span>
              <span className="font-medium">{snapshot.context.companyType || "Not selected"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Difficulty Preference</span>
              <span className="font-medium capitalize">{snapshot.difficultyPreference}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg Response Time</span>
              <span className="font-medium tabular-nums">
                {snapshot.behavior.averageResponseTimeMs > 0
                  ? `${Math.round(snapshot.behavior.averageResponseTimeMs)} ms`
                  : "No data"}
              </span>
            </div>
            <div>
              <div className="mb-2 text-muted-foreground">Recommended Roles</div>
              <div className="flex flex-wrap gap-2">
                {snapshot.context.recommendedRoles.length > 0 ? (
                  snapshot.context.recommendedRoles.map((role) => (
                    <Badge key={role} variant="outline">
                      {role}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">None yet</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Weakness Insights</CardTitle>
            <CardDescription>Topic, frequency, and trend from your adaptive learning history.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {weaknessInsightRows.length > 0 ? (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Topic</span>
                  <span>Frequency</span>
                  <span>Trend</span>
                </div>

                {weaknessInsightRows.map((signal) => {
                  const trend = trendVisual(signal.trend);
                  const TrendIcon = trend.icon;

                  return (
                    <div key={signal.topic} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-xl border px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{signal.topic}</p>
                        <p className="text-[11px] text-muted-foreground">{signal.source}</p>
                      </div>

                      <Badge variant="outline" className="tabular-nums">
                        {signal.frequency}
                      </Badge>

                      <div className={`inline-flex items-center gap-1 text-xs font-medium ${trend.className}`}>
                        <TrendIcon className="h-3.5 w-3.5" />
                        <span>{trend.symbol}</span>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No weak signals captured yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Strength Signals</CardTitle>
            <CardDescription>Top strengths inferred from recent sessions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topStrengths.length > 0 ? (
              topStrengths.map((signal) => (
                <div key={signal.topic} className="flex items-center justify-between rounded-xl border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{signal.topic}</p>
                    <p className="text-xs text-muted-foreground">{signal.source}</p>
                  </div>
                  <Badge variant="secondary" className="tabular-nums">
                    {Math.round(signal.score)}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No strengths captured yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mastery Index</CardTitle>
            <CardDescription>Subject-level performance memory.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {masteryEntries.length > 0 ? (
              masteryEntries.map(([subject, mastery]) => (
                <div key={subject} className="rounded-xl border p-3">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{subject}</span>
                    <span className="tabular-nums text-muted-foreground">{mastery.attempts} attempts</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.max(0, Math.min(100, mastery.score))}%` }}
                    />
                  </div>
                  <div className="mt-1 text-right text-xs text-muted-foreground tabular-nums">{mastery.score}%</div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Mastery data will appear after first tracked activity.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Events</CardTitle>
            <CardDescription>Latest intelligence pipeline events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.recentEvents.length > 0 ? (
              snapshot.recentEvents.slice(0, 10).map((event) => (
                <div key={event.id} className="rounded-xl border p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Badge variant="outline">{event.type}</Badge>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(event.createdAt)}</span>
                  </div>
                  <p className="text-sm">{event.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{event.source}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No event history yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
