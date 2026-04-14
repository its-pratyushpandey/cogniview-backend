import type {
  IntelligenceRecommendedAction,
  IntelligenceRecommendationPriority,
  IntelligenceSignalSeverity,
  UserIntelligenceSnapshot,
} from "@/features/intelligence/types";

const DEFAULT_MAX_ACTIONS = 6;
const LOW_PERFORMANCE_THRESHOLD = 55;
const MEDIUM_PERFORMANCE_THRESHOLD = 70;
const TREND_DROP_ALERT_THRESHOLD = 8;
const TOPIC_RECENT_HISTORY_WINDOW = 8;

const PRIORITY_WEIGHT: Record<IntelligenceRecommendationPriority, number> = {
  urgent: 3,
  medium: 2,
  optional: 1,
};

const SEVERITY_WEIGHT: Record<IntelligenceSignalSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

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

interface WeakTopicCandidate {
  topic: string;
  severity: IntelligenceSignalSeverity;
  count: number;
  reason?: string;
}

interface RecommendationCandidate extends IntelligenceRecommendedAction {
  score: number;
}

interface PerformanceSummary {
  recentAverage: number;
  previousAverage: number | null;
  trendDrop: number;
  sampleSize: number;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeKey(value: string): string {
  return normalizeText(value).toLowerCase();
}

function toReadableLabel(value: string): string {
  const normalized = normalizeText(value.replace(/[-_]+/g, " "));
  if (!normalized) return "your target company";

  return normalized
    .split(" ")
    .map((part) => {
      if (part.length <= 3 && part === part.toUpperCase()) {
        return part;
      }

      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function containsAny(topic: string, keywords: string[]): boolean {
  const lowerTopic = topic.toLowerCase();
  return keywords.some((keyword) => lowerTopic.includes(keyword));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function severityToPriority(severity: IntelligenceSignalSeverity): IntelligenceRecommendationPriority {
  if (severity === "high") return "urgent";
  if (severity === "medium") return "medium";
  return "optional";
}

function promotePriority(priority: IntelligenceRecommendationPriority): IntelligenceRecommendationPriority {
  if (priority === "optional") return "medium";
  if (priority === "medium") return "urgent";
  return "urgent";
}

function routeForWeakTopic(topic: string): string {
  if (containsAny(topic, CODING_TOPIC_KEYWORDS)) return "/code-playground";
  if (containsAny(topic, CS_REVISION_KEYWORDS)) return "/revision";
  if (containsAny(topic, COMMUNICATION_KEYWORDS)) return "/interview";
  if (containsAny(topic, APTITUDE_KEYWORDS)) return "/aptitude";
  return "/mcq";
}

function actionForWeakTopic(topic: string, route: string): string {
  if (route === "/revision") return `Revise ${topic}`;
  if (route === "/interview") return `Practice ${topic} in Mock Interview`;
  return `Practice ${topic}`;
}

function summarizeRecentTopicSignal(snapshot: UserIntelligenceSnapshot, topic: string): {
  recentMentions: number;
  lowScoreMentions: number;
  trendDrop: number;
} {
  const topicKey = normalizeKey(topic);
  if (!topicKey) {
    return { recentMentions: 0, lowScoreMentions: 0, trendDrop: 0 };
  }

  const topicHistory = [...snapshot.history]
    .filter((entry) => {
      if (!entry.topic) return false;
      const entryKey = normalizeKey(entry.topic);
      return entryKey.includes(topicKey) || topicKey.includes(entryKey);
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, TOPIC_RECENT_HISTORY_WINDOW);

  const recentScores = topicHistory.slice(0, 3).map((entry) => entry.score);
  const previousScores = topicHistory.slice(3, 6).map((entry) => entry.score);

  const recentAverage = average(recentScores);
  const previousAverage = average(previousScores);
  const trendDrop = previousAverage === null || recentAverage === null ? 0 : Math.max(0, previousAverage - recentAverage);

  return {
    recentMentions: Math.min(5, topicHistory.length),
    lowScoreMentions: topicHistory.slice(0, 5).filter((entry) => entry.score < 60).length,
    trendDrop,
  };
}

function reasonForWeakTopic(
  snapshot: UserIntelligenceSnapshot,
  topic: WeakTopicCandidate
): string {
  if (topic.reason?.trim()) {
    return topic.reason.trim();
  }

  const recentSignal = summarizeRecentTopicSignal(snapshot, topic.topic);
  if (recentSignal.recentMentions >= 2 && recentSignal.trendDrop >= 4) {
    return `You struggled recently with ${topic.topic}; recent scores dropped by ${Math.round(recentSignal.trendDrop)} points.`;
  }

  if (recentSignal.lowScoreMentions >= 2) {
    return `You struggled recently with ${topic.topic} across ${recentSignal.lowScoreMentions} low-scoring attempts.`;
  }

  if (recentSignal.recentMentions >= 1) {
    return `You struggled recently with ${topic.topic}. Reinforcing it now can prevent repeat mistakes.`;
  }

  return `${topic.topic} appears in recent weak signals (${topic.count} hit${topic.count === 1 ? "" : "s"}).`;
}

function lowestMetricRoute(snapshot: UserIntelligenceSnapshot): string {
  const ranked = [
    { key: "interview" as const, score: snapshot.metrics.interviewReadiness, route: "/interview" },
    { key: "technical" as const, score: snapshot.metrics.technicalDepth, route: "/revision" },
    { key: "problem" as const, score: snapshot.metrics.problemSolving, route: "/code-playground" },
    { key: "communication" as const, score: snapshot.metrics.communication, route: "/viva" },
  ].sort((a, b) => a.score - b.score);

  return ranked[0]?.route ?? "/mcq";
}

function summarizePerformance(snapshot: UserIntelligenceSnapshot): PerformanceSummary {
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
  const trendDrop = previousAverage === null ? 0 : Math.max(0, previousAverage - recentAverage);

  return {
    recentAverage,
    previousAverage,
    trendDrop,
    sampleSize: recentScores.length,
  };
}

function collectWeakTopicCandidates(snapshot: UserIntelligenceSnapshot): WeakTopicCandidate[] {
  const byTopic = new Map<string, WeakTopicCandidate>();

  for (const signal of snapshot.weakSignals) {
    const topic = normalizeText(signal.topic);
    if (!topic) continue;

    const key = normalizeKey(topic);
    const existing = byTopic.get(key);

    if (!existing) {
      byTopic.set(key, {
        topic,
        severity: signal.severity,
        count: Math.max(1, signal.count),
        reason: signal.reason,
      });
      continue;
    }

    const nextSeverity =
      SEVERITY_WEIGHT[signal.severity] > SEVERITY_WEIGHT[existing.severity] ? signal.severity : existing.severity;

    byTopic.set(key, {
      topic: existing.topic,
      severity: nextSeverity,
      count: existing.count + Math.max(1, signal.count),
      reason: existing.reason ?? signal.reason,
    });
  }

  for (const weakArea of snapshot.weakAreas) {
    const topic = normalizeText(weakArea);
    if (!topic) continue;

    const key = normalizeKey(topic);
    if (byTopic.has(key)) continue;

    byTopic.set(key, {
      topic,
      severity: "low",
      count: 1,
    });
  }

  return Array.from(byTopic.values()).sort((a, b) => {
    const bySeverity = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (bySeverity !== 0) return bySeverity;
    return b.count - a.count;
  });
}

function upsertCandidate(store: Map<string, RecommendationCandidate>, candidate: RecommendationCandidate): void {
  const normalizedAction = normalizeKey(candidate.action);
  if (!normalizedAction) return;

  const key = `${normalizedAction}::${candidate.route}`;
  const existing = store.get(key);

  if (!existing || candidate.score > existing.score) {
    store.set(key, candidate);
  }
}

function addWeakAreaActions(
  store: Map<string, RecommendationCandidate>,
  snapshot: UserIntelligenceSnapshot,
  weakTopics: WeakTopicCandidate[],
  performance: PerformanceSummary
): void {
  for (const topic of weakTopics.slice(0, 4)) {
    const route = routeForWeakTopic(topic.topic);
    const basePriority = severityToPriority(topic.severity);
    const priority =
      performance.recentAverage < LOW_PERFORMANCE_THRESHOLD ? promotePriority(basePriority) : basePriority;

    const reason = reasonForWeakTopic(snapshot, topic);

    upsertCandidate(store, {
      action: actionForWeakTopic(topic.topic, route),
      reason,
      priority,
      route,
      score: PRIORITY_WEIGHT[priority] * 100 + SEVERITY_WEIGHT[topic.severity] * 18 + Math.min(topic.count, 10) * 4,
    });
  }
}

function addPerformanceActions(
  store: Map<string, RecommendationCandidate>,
  snapshot: UserIntelligenceSnapshot,
  performance: PerformanceSummary
): void {
  const recentRounded = Math.round(performance.recentAverage);

  if (performance.recentAverage < LOW_PERFORMANCE_THRESHOLD) {
    const route = lowestMetricRoute(snapshot);

    upsertCandidate(store, {
      action: "Run a Recovery Practice Session",
      reason: `Recent performance is ${recentRounded}%. Focused practice will help recover momentum quickly.`,
      priority: "urgent",
      route,
      score: 320,
    });
  } else if (performance.recentAverage < MEDIUM_PERFORMANCE_THRESHOLD) {
    upsertCandidate(store, {
      action: "Take a Timed Practice Sprint",
      reason: `Recent performance is ${recentRounded}%. Short timed drills can improve consistency.`,
      priority: "medium",
      route: "/mcq",
      score: 220,
    });
  }

  if (performance.trendDrop >= TREND_DROP_ALERT_THRESHOLD) {
    const priority: IntelligenceRecommendationPriority = performance.trendDrop >= 15 ? "urgent" : "medium";

    upsertCandidate(store, {
      action: "Stabilize Recent Performance Trend",
      reason: `Recent scores dropped by ${Math.round(performance.trendDrop)} points compared to earlier sessions.`,
      priority,
      route: lowestMetricRoute(snapshot),
      score: PRIORITY_WEIGHT[priority] * 100 + Math.round(performance.trendDrop * 3),
    });
  }

  if (snapshot.behavior.averageRetries >= 2.5 || snapshot.behavior.averageResponseTimeMs >= 75000) {
    const timingReasonParts: string[] = [];

    if (snapshot.behavior.averageRetries >= 2.5) {
      timingReasonParts.push(`average retries are ${snapshot.behavior.averageRetries.toFixed(1)}`);
    }

    if (snapshot.behavior.averageResponseTimeMs >= 75000) {
      timingReasonParts.push(`responses average ${Math.round(snapshot.behavior.averageResponseTimeMs / 1000)}s`);
    }

    upsertCandidate(store, {
      action: "Improve Speed and Accuracy",
      reason: `Performance pressure is increasing (${timingReasonParts.join(", ")}). Timed drills can help.`,
      priority: "medium",
      route: "/aptitude",
      score: 210,
    });
  }
}

function addCompanyActions(
  store: Map<string, RecommendationCandidate>,
  snapshot: UserIntelligenceSnapshot,
  performance: PerformanceSummary
): void {
  const companyTarget = snapshot.context.companyId ?? snapshot.context.targetCompanies[0] ?? snapshot.context.companyType;
  const roleTarget = snapshot.context.roleId ?? snapshot.context.targetRole;

  if (companyTarget) {
    const companyLabel = toReadableLabel(companyTarget);
    const priority: IntelligenceRecommendationPriority =
      performance.recentAverage < 65 || snapshot.metrics.interviewReadiness < 65 ? "urgent" : "medium";

    upsertCandidate(store, {
      action: `Take ${companyLabel} Mock Test`,
      reason: roleTarget
        ? `Context is set to ${companyLabel} (${roleTarget}). A targeted mock test improves relevance.`
        : `Context is set to ${companyLabel}. A targeted mock test keeps preparation aligned.`,
      priority,
      route: "/company-prep",
      score: PRIORITY_WEIGHT[priority] * 100 + 55,
    });

    return;
  }

  upsertCandidate(store, {
    action: "Set Your Company Target",
    reason: "Selecting a company unlocks sharper recommendations and company-specific mock tests.",
    priority: "optional",
    route: "/company-mode",
    score: 120,
  });
}

function addFallbackActions(store: Map<string, RecommendationCandidate>): void {
  const fallbacks: RecommendationCandidate[] = [
    {
      action: "Take a Full Mock Interview",
      reason: "Run a complete interview flow to measure communication, structure, and confidence.",
      priority: "medium",
      route: "/interview",
      score: 200,
    },
    {
      action: "Revise Core CS Fundamentals",
      reason: "Reinforce DBMS, OS, OOPS, and networking to improve technical consistency.",
      priority: "optional",
      route: "/revision",
      score: 125,
    },
    {
      action: "Practice a Mixed MCQ Set",
      reason: "A mixed set strengthens recall across weak and moderate areas.",
      priority: "optional",
      route: "/mcq",
      score: 122,
    },
  ];

  for (const fallback of fallbacks) {
    if (store.size >= 3) break;
    upsertCandidate(store, fallback);
  }
}

export function buildRecommendedActions(
  snapshot: UserIntelligenceSnapshot,
  maxActions = DEFAULT_MAX_ACTIONS
): IntelligenceRecommendedAction[] {
  const limit = Number.isFinite(maxActions) ? Math.max(3, Math.min(10, Math.round(maxActions))) : DEFAULT_MAX_ACTIONS;
  const candidates = new Map<string, RecommendationCandidate>();

  const performance = summarizePerformance(snapshot);
  const weakTopics = collectWeakTopicCandidates(snapshot);

  addWeakAreaActions(candidates, snapshot, weakTopics, performance);
  addPerformanceActions(candidates, snapshot, performance);
  addCompanyActions(candidates, snapshot, performance);
  addFallbackActions(candidates);

  const sorted = Array.from(candidates.values()).sort((a, b) => {
    const byScore = b.score - a.score;
    if (byScore !== 0) return byScore;

    const byPriority = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (byPriority !== 0) return byPriority;

    return a.action.localeCompare(b.action);
  });

  return sorted.slice(0, limit).map(({ action, reason, priority, route }) => ({
    action,
    reason,
    priority,
    route,
  }));
}
