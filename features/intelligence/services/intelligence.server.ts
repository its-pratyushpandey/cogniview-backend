import { db } from "@/firebase/admin";
import type {
  IntelligenceBehaviorProfile,
  IntelligenceContextState,
  IntelligenceDifficultyPreference,
  IntelligenceEventInput,
  IntelligenceEventRecord,
  IntelligenceEventType,
  IntelligenceHistoryEntry,
  IntelligenceMasteryEntry,
  IntelligenceSignalSeverity,
  IntelligenceSkillEntry,
  UserIntelligenceSnapshot,
} from "@/features/intelligence/types";

const COLLECTION_NAME = "user_intelligence";
const SNAPSHOT_VERSION = 1;
const MAX_RECENT_EVENTS = 40;
const MAX_WEAK_SIGNALS = 40;
const MAX_STRENGTH_SIGNALS = 25;
const MAX_HISTORY_ENTRIES = 90;
const MAX_SKILL_ENTRIES = 120;
const SNAPSHOT_CACHE_TTL_MS = 45_000;

type SnapshotCacheEntry = {
  value: UserIntelligenceSnapshot;
  expiresAt: number;
};

const snapshotCache = new Map<string, SnapshotCacheEntry>();
const inflightSnapshotReads = new Map<string, Promise<UserIntelligenceSnapshot>>();

function nowIso(): string {
  return new Date().toISOString();
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function coerceNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function blend(existing: number, incoming: number, incomingWeight = 0.4): number {
  const e = clampScore(existing);
  const i = clampScore(incoming);
  const w = Math.max(0.05, Math.min(0.95, incomingWeight));
  return Math.round(e * (1 - w) + i * w);
}

function normalizeSeverity(raw: unknown): IntelligenceSignalSeverity {
  const value = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  return "low";
}

function normalizeTopic(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, 120);
}

function normalizeDifficultyPreference(raw: unknown): IntelligenceDifficultyPreference {
  const value = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  if (value === "easy" || value === "medium" || value === "hard" || value === "adaptive") {
    return value;
  }

  return "adaptive";
}

function toStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];

  for (const value of raw) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (!normalized) continue;
    if (!out.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) {
      out.push(normalized);
    }
  }

  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as T;
  }

  if (isPlainObject(value)) {
    const sanitized = Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entryValue]) => {
      if (entryValue === undefined) {
        return acc;
      }

      const cleanedValue = stripUndefinedDeep(entryValue);
      if (cleanedValue !== undefined) {
        acc[key] = cleanedValue;
      }

      return acc;
    }, {});

    return sanitized as T;
  }

  return value;
}

function cloneSnapshot(snapshot: UserIntelligenceSnapshot): UserIntelligenceSnapshot {
  return structuredClone(snapshot) as UserIntelligenceSnapshot;
}

function getCachedSnapshot(userId: string): UserIntelligenceSnapshot | null {
  const cached = snapshotCache.get(userId);
  if (!cached) {
    return null;
  }

  if (Date.now() >= cached.expiresAt) {
    snapshotCache.delete(userId);
    return null;
  }

  return cloneSnapshot(cached.value);
}

function setCachedSnapshot(userId: string, snapshot: UserIntelligenceSnapshot): void {
  snapshotCache.set(userId, {
    value: cloneSnapshot(snapshot),
    expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS,
  });
}

function createDefaultContext(): IntelligenceContextState {
  return {
    companyId: null,
    roleId: null,
    companyType: null,
    targetRole: null,
    targetCompanies: [],
    recommendedRoles: [],
  };
}

function createDefaultBehaviorProfile(): IntelligenceBehaviorProfile {
  return {
    averageResponseTimeMs: 0,
    averageRetries: 0,
    averageConfidence: 0,
    sessionsTracked: 0,
    lastModule: null,
    lastInteractionAt: null,
  };
}

function sanitizeSkillMap(raw: unknown): Record<string, IntelligenceSkillEntry> {
  if (typeof raw !== "object" || raw === null) {
    return {};
  }

  const entries = Object.entries(raw).map(([key, value]) => {
    if (typeof value !== "object" || value === null) return null;
    const record = value as Record<string, unknown>;
    const normalizedTopic = normalizeTopic(record.skill ?? key);
    if (!normalizedTopic) return null;

    return [
      normalizedTopic,
      {
        skill: normalizedTopic,
        confidence: clampScore(coerceNumber(record.confidence) ?? 50),
        evidenceCount: Math.max(0, Math.round(coerceNumber(record.evidenceCount) ?? 0)),
        source: typeof record.source === "string" ? record.source : "unknown",
        lastUpdated: typeof record.lastUpdated === "string" ? record.lastUpdated : nowIso(),
      } satisfies IntelligenceSkillEntry,
    ] as const;
  });

  const filtered = entries.filter((entry): entry is readonly [string, IntelligenceSkillEntry] => entry !== null);
  filtered.sort(([, a], [, b]) => {
    const byConfidence = b.confidence - a.confidence;
    if (byConfidence !== 0) return byConfidence;
    return b.evidenceCount - a.evidenceCount;
  });

  return Object.fromEntries(filtered.slice(0, MAX_SKILL_ENTRIES));
}

function sanitizeHistory(raw: unknown): IntelligenceHistoryEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const items: IntelligenceHistoryEntry[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;

    const moduleName = normalizeTopic(record.module);
    if (!moduleName) continue;

    const topic = normalizeTopic(record.topic);

    const score = clampScore(coerceNumber(record.score) ?? 0);
    const retries = Math.max(0, Math.round(coerceNumber(record.retries) ?? 0));
    const responseTime = coerceNumber(record.responseTimeMs);
    const confidence = coerceNumber(record.confidence);

    items.push({
      id:
        typeof record.id === "string" && record.id.trim().length > 0
          ? record.id
          : `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      module: moduleName,
          ...(topic ? { topic } : {}),
      score,
      responseTimeMs: responseTime !== null ? Math.max(0, responseTime) : null,
      retries,
      confidence: confidence !== null ? clampScore(confidence) : null,
      createdAt: typeof record.createdAt === "string" ? record.createdAt : nowIso(),
    });
  }

  items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return items.slice(0, MAX_HISTORY_ENTRIES);
}

function sanitizeBehavior(raw: unknown): IntelligenceBehaviorProfile {
  const fallback = createDefaultBehaviorProfile();
  if (typeof raw !== "object" || raw === null) {
    return fallback;
  }

  const record = raw as Record<string, unknown>;

  return {
    averageResponseTimeMs: Math.max(0, Math.round(coerceNumber(record.averageResponseTimeMs) ?? 0)),
    averageRetries: Math.max(0, Number((coerceNumber(record.averageRetries) ?? 0).toFixed(2))),
    averageConfidence: clampScore(coerceNumber(record.averageConfidence) ?? 0),
    sessionsTracked: Math.max(0, Math.round(coerceNumber(record.sessionsTracked) ?? 0)),
    lastModule: normalizeTopic(record.lastModule) || null,
    lastInteractionAt: typeof record.lastInteractionAt === "string" ? record.lastInteractionAt : null,
  };
}

function createDefaultSnapshot(userId: string): UserIntelligenceSnapshot {
  const timestamp = nowIso();

  return {
    userId,
    version: SNAPSHOT_VERSION,
    metrics: {
      interviewReadiness: 0,
      communication: 0,
      technicalDepth: 0,
      problemSolving: 0,
      consistency: 0,
    },
    context: createDefaultContext(),
    skills: {},
    difficultyPreference: "adaptive",
    weakSignals: [],
    strengths: [],
    weakAreas: [],
    strongAreas: [],
    mastery: {},
    history: [],
    behavior: createDefaultBehaviorProfile(),
    recentEvents: [],
    eventStats: {
      totalEvents: 0,
      lastEventAt: null,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function hydrateSnapshot(userId: string, data: Partial<UserIntelligenceSnapshot> | undefined): UserIntelligenceSnapshot {
  const fallback = createDefaultSnapshot(userId);

  if (!data) {
    return fallback;
  }

  return {
    ...fallback,
    ...data,
    userId,
    version: SNAPSHOT_VERSION,
    metrics: {
      ...fallback.metrics,
      ...(data.metrics ?? {}),
    },
    context: {
      ...fallback.context,
      ...(data.context ?? {}),
      targetCompanies: toStringArray(data.context?.targetCompanies),
      recommendedRoles: toStringArray(data.context?.recommendedRoles),
    },
    skills: sanitizeSkillMap(data.skills),
    difficultyPreference: normalizeDifficultyPreference(data.difficultyPreference),
    weakSignals: Array.isArray(data.weakSignals) ? data.weakSignals.slice(0, MAX_WEAK_SIGNALS) : [],
    strengths: Array.isArray(data.strengths) ? data.strengths.slice(0, MAX_STRENGTH_SIGNALS) : [],
    weakAreas: toStringArray(data.weakAreas),
    strongAreas: toStringArray(data.strongAreas),
    mastery: typeof data.mastery === "object" && data.mastery !== null ? data.mastery : {},
    history: sanitizeHistory(data.history),
    behavior: sanitizeBehavior(data.behavior),
    recentEvents: Array.isArray(data.recentEvents) ? data.recentEvents.slice(0, MAX_RECENT_EVENTS) : [],
    eventStats: {
      totalEvents:
        typeof data.eventStats?.totalEvents === "number" && Number.isFinite(data.eventStats.totalEvents)
          ? data.eventStats.totalEvents
          : 0,
      lastEventAt: typeof data.eventStats?.lastEventAt === "string" ? data.eventStats.lastEventAt : null,
    },
    createdAt: typeof data.createdAt === "string" ? data.createdAt : fallback.createdAt,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : fallback.updatedAt,
  };
}

function updateSkillConfidence(
  snapshot: UserIntelligenceSnapshot,
  topicRaw: string,
  delta: number,
  source: string
): void {
  const topic = normalizeTopic(topicRaw);
  if (!topic) return;

  const now = nowIso();
  const existing = snapshot.skills[topic];
  const nextConfidence = existing ? clampScore(existing.confidence + delta) : clampScore(50 + delta);

  snapshot.skills[topic] = {
    skill: topic,
    confidence: Math.round(nextConfidence),
    evidenceCount: (existing?.evidenceCount ?? 0) + 1,
    source,
    lastUpdated: now,
  };

  const sorted = Object.entries(snapshot.skills).sort(([, a], [, b]) => {
    const byConfidence = b.confidence - a.confidence;
    if (byConfidence !== 0) return byConfidence;
    return b.evidenceCount - a.evidenceCount;
  });

  snapshot.skills = Object.fromEntries(sorted.slice(0, MAX_SKILL_ENTRIES));
}

function refreshAreaCaches(snapshot: UserIntelligenceSnapshot): void {
  const weakFromSignals = snapshot.weakSignals.map((signal) => signal.topic);
  const weakFromSkills = Object.values(snapshot.skills)
    .filter((skill) => skill.confidence <= 45)
    .map((skill) => skill.skill);
  const strongFromSignals = snapshot.strengths.map((signal) => signal.topic);
  const strongFromSkills = Object.values(snapshot.skills)
    .filter((skill) => skill.confidence >= 75)
    .map((skill) => skill.skill);

  snapshot.weakAreas = toStringArray([...weakFromSignals, ...weakFromSkills]).slice(0, 14);
  snapshot.strongAreas = toStringArray([...strongFromSignals, ...strongFromSkills]).slice(0, 14);
}

function pushHistory(
  snapshot: UserIntelligenceSnapshot,
  input: {
    module: string;
    topic?: string;
    score?: number;
    responseTimeMs?: number | null;
    retries?: number;
    confidence?: number | null;
  }
): void {
  const moduleName = normalizeTopic(input.module);
  if (!moduleName) return;

  const topic = normalizeTopic(input.topic);

  const entry: IntelligenceHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    module: moduleName,
    ...(topic ? { topic } : {}),
    score: clampScore(input.score ?? 0),
    responseTimeMs:
      typeof input.responseTimeMs === "number" && Number.isFinite(input.responseTimeMs)
        ? Math.max(0, Math.round(input.responseTimeMs))
        : null,
    retries: Math.max(0, Math.round(input.retries ?? 0)),
    confidence:
      typeof input.confidence === "number" && Number.isFinite(input.confidence)
        ? clampScore(input.confidence)
        : null,
    createdAt: nowIso(),
  };

  snapshot.history = [entry, ...snapshot.history]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, MAX_HISTORY_ENTRIES);
}

function updateBehavior(
  snapshot: UserIntelligenceSnapshot,
  input: {
    module?: string;
    responseTimeMs?: number | null;
    retries?: number;
    confidence?: number | null;
  }
): void {
  const behavior = snapshot.behavior;
  const nextCount = behavior.sessionsTracked + 1;

  const responseTimeMs =
    typeof input.responseTimeMs === "number" && Number.isFinite(input.responseTimeMs)
      ? Math.max(0, input.responseTimeMs)
      : null;
  if (responseTimeMs !== null) {
    behavior.averageResponseTimeMs = Math.round(
      (behavior.averageResponseTimeMs * behavior.sessionsTracked + responseTimeMs) / nextCount
    );
  }

  const retries = typeof input.retries === "number" && Number.isFinite(input.retries) ? Math.max(0, input.retries) : 0;
  behavior.averageRetries = Number(
    ((behavior.averageRetries * behavior.sessionsTracked + retries) / nextCount).toFixed(2)
  );

  const confidence =
    typeof input.confidence === "number" && Number.isFinite(input.confidence)
      ? clampScore(input.confidence)
      : null;
  if (confidence !== null) {
    behavior.averageConfidence = Math.round(
      (behavior.averageConfidence * behavior.sessionsTracked + confidence) / nextCount
    );
  }

  behavior.sessionsTracked = nextCount;
  behavior.lastModule = normalizeTopic(input.module) || behavior.lastModule;
  behavior.lastInteractionAt = nowIso();
}

function inferDifficultyPreference(score: number): IntelligenceDifficultyPreference {
  const normalized = clampScore(score);
  if (normalized <= 45) return "easy";
  if (normalized <= 72) return "medium";
  return "hard";
}

function upsertWeakSignals(
  snapshot: UserIntelligenceSnapshot,
  entries: Array<{ topic: string; severity?: IntelligenceSignalSeverity; reason?: string }>,
  source: string
): void {
  const now = nowIso();
  const severityPenalty: Record<IntelligenceSignalSeverity, number> = {
    low: -4,
    medium: -8,
    high: -14,
  };

  for (const entry of entries) {
    const topic = normalizeTopic(entry.topic);
    if (!topic) continue;

    const existingIndex = snapshot.weakSignals.findIndex(
      (signal) => signal.topic.toLowerCase() === topic.toLowerCase()
    );

    if (existingIndex >= 0) {
      const existing = snapshot.weakSignals[existingIndex];
      const severityRank: Record<IntelligenceSignalSeverity, number> = {
        low: 1,
        medium: 2,
        high: 3,
      };

      const incomingSeverity = entry.severity ?? "medium";
      const mergedSeverity =
        severityRank[incomingSeverity] > severityRank[existing.severity] ? incomingSeverity : existing.severity;

      snapshot.weakSignals[existingIndex] = {
        ...existing,
        severity: mergedSeverity,
        reason: entry.reason ?? existing.reason,
        source,
        count: existing.count + 1,
        lastUpdated: now,
      };
      updateSkillConfidence(snapshot, topic, severityPenalty[incomingSeverity], source);
      continue;
    }

    const incomingSeverity = entry.severity ?? "medium";
    snapshot.weakSignals.push({
      topic,
      reason: entry.reason,
      severity: incomingSeverity,
      source,
      count: 1,
      lastUpdated: now,
    });

    updateSkillConfidence(snapshot, topic, severityPenalty[incomingSeverity], source);
  }

  snapshot.weakSignals = snapshot.weakSignals
    .sort((a, b) => {
      const rank: Record<IntelligenceSignalSeverity, number> = { high: 3, medium: 2, low: 1 };
      const bySeverity = rank[b.severity] - rank[a.severity];
      if (bySeverity !== 0) return bySeverity;
      return b.count - a.count;
    })
    .slice(0, MAX_WEAK_SIGNALS);
}

function upsertStrengthSignals(
  snapshot: UserIntelligenceSnapshot,
  topics: string[],
  source: string,
  baseScore = 75
): void {
  const now = nowIso();

  for (const rawTopic of topics) {
    const topic = normalizeTopic(rawTopic);
    if (!topic) continue;

    const existingIndex = snapshot.strengths.findIndex(
      (signal) => signal.topic.toLowerCase() === topic.toLowerCase()
    );

    if (existingIndex >= 0) {
      const existing = snapshot.strengths[existingIndex];
      snapshot.strengths[existingIndex] = {
        ...existing,
        source,
        score: clampScore(blend(existing.score, baseScore, 0.45)),
        lastUpdated: now,
      };
      updateSkillConfidence(snapshot, topic, Math.max(6, Math.round(baseScore / 12)), source);
      continue;
    }

    snapshot.strengths.push({
      topic,
      source,
      score: clampScore(baseScore),
      lastUpdated: now,
    });

    updateSkillConfidence(snapshot, topic, Math.max(6, Math.round(baseScore / 12)), source);
  }

  snapshot.strengths = snapshot.strengths
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_STRENGTH_SIGNALS);
}

function updateMastery(snapshot: UserIntelligenceSnapshot, subject: string, incomingScore: number): void {
  const key = subject.trim();
  if (!key) return;

  const existing: IntelligenceMasteryEntry = snapshot.mastery[key] ?? {
    score: 0,
    attempts: 0,
    lastUpdated: nowIso(),
  };

  const attempts = existing.attempts + 1;
  const score = clampScore((existing.score * existing.attempts + clampScore(incomingScore)) / attempts);

  snapshot.mastery[key] = {
    score: Math.round(score),
    attempts,
    lastUpdated: nowIso(),
  };
}

function summarizeEvent(eventType: IntelligenceEventType, payload: Record<string, unknown>): string {
  if (eventType === "resume.analysis.completed") {
    return "Resume intelligence updated";
  }

  if (eventType === "resume.questions.generated") {
    const count = typeof payload.count === "number" ? Math.round(payload.count) : null;
    return count === null ? "Adaptive question plan generated" : `Adaptive question plan generated (${count} questions)`;
  }

  if (eventType === "interview.analysis.completed") {
    return "Interview weak-signal analysis captured";
  }

  if (eventType === "interview.realtime.signal") {
    const score = typeof payload.readinessScore === "number" ? Math.round(payload.readinessScore) : null;
    return score === null ? "Realtime interview signal captured" : `Realtime interview signal (${score}/100)`;
  }

  if (eventType === "interview.feedback.created") {
    const score = typeof payload.totalScore === "number" ? Math.round(payload.totalScore) : null;
    return score === null ? "Interview feedback recorded" : `Interview feedback recorded (${score}/100)`;
  }

  if (eventType === "interview.answer_scoring.completed") {
    return "Answer quality scoring captured";
  }

  if (eventType === "company.test.submitted") {
    const nested =
      typeof payload.result === "object" && payload.result !== null
        ? (payload.result as Record<string, unknown>)
        : payload;
    const score = typeof nested.score === "number" ? Math.round(nested.score) : null;
    return score === null ? "Company test result captured" : `Company test submitted (${score}/100)`;
  }

  if (eventType === "code.evaluation.completed") {
    const nested =
      typeof payload.evaluation === "object" && payload.evaluation !== null
        ? (payload.evaluation as Record<string, unknown>)
        : payload;
    const score = typeof nested.score === "number" ? Math.round(nested.score) : null;
    return score === null ? "Code evaluation updated" : `Code evaluation updated (${score}/100)`;
  }

  if (eventType === "progress.topic.updated") {
    const topic = typeof payload.topicName === "string" ? payload.topicName : "topic";
    return `Progress updated for ${topic}`;
  }

  if (eventType === "mistakes.review.updated") {
    return "Mistake-memory review updated";
  }

  if (eventType === "context.selection.updated") {
    return "Company/role context updated";
  }

  if (eventType === "company.preference.updated") {
    return "Company preference updated";
  }

  if (eventType === "learning.behavior.tracked") {
    const moduleName = typeof payload.module === "string" ? payload.module : "learning";
    return `Learning behavior tracked (${moduleName})`;
  }

  return "Intelligence event received";
}

function pushRecentEvent(snapshot: UserIntelligenceSnapshot, input: IntelligenceEventInput): void {
  const event: IntelligenceEventRecord = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type: input.eventType,
    source: input.source ?? "unknown",
    summary: summarizeEvent(input.eventType, input.payload),
    createdAt: nowIso(),
  };

  snapshot.recentEvents = [event, ...snapshot.recentEvents].slice(0, MAX_RECENT_EVENTS);
  snapshot.eventStats.totalEvents += 1;
  snapshot.eventStats.lastEventAt = event.createdAt;
}

function deriveWeaknessImpact(entries: Array<{ severity: IntelligenceSignalSeverity }>): number {
  let total = 0;
  for (const entry of entries) {
    if (entry.severity === "high") total += 14;
    else if (entry.severity === "medium") total += 7;
    else total += 3;
  }
  return total;
}

function applyEvent(snapshot: UserIntelligenceSnapshot, input: IntelligenceEventInput): UserIntelligenceSnapshot {
  const next = structuredClone(snapshot) as UserIntelligenceSnapshot;
  const payload = input.payload;

  switch (input.eventType) {
    case "context.selection.updated": {
      if (typeof payload.companyId === "string") next.context.companyId = payload.companyId || null;
      if (typeof payload.roleId === "string") next.context.roleId = payload.roleId || null;
      if (typeof payload.companyType === "string") next.context.companyType = payload.companyType || null;
      if (typeof payload.targetRole === "string") next.context.targetRole = payload.targetRole || null;
      if (Array.isArray(payload.targetCompanies)) next.context.targetCompanies = toStringArray(payload.targetCompanies);
      if (Array.isArray(payload.recommendedRoles)) {
        next.context.recommendedRoles = toStringArray(payload.recommendedRoles).slice(0, 6);
      }
      if (typeof payload.difficultyPreference === "string") {
        next.difficultyPreference = normalizeDifficultyPreference(payload.difficultyPreference);
      }
      break;
    }

    case "company.preference.updated": {
      if (typeof payload.companyType === "string") next.context.companyType = payload.companyType || null;
      if (Array.isArray(payload.targetCompanies)) next.context.targetCompanies = toStringArray(payload.targetCompanies);
      if (typeof payload.difficultyPreference === "string") {
        next.difficultyPreference = normalizeDifficultyPreference(payload.difficultyPreference);
      }
      break;
    }

    case "resume.analysis.completed": {
      if (typeof payload.selectedRole === "string") {
        next.context.targetRole = payload.selectedRole || null;
      }

      const intelligence =
        typeof payload.intelligence === "object" && payload.intelligence !== null
          ? (payload.intelligence as Record<string, unknown>)
          : null;

      if (intelligence) {
        const weaknessesRaw = Array.isArray(intelligence.weaknesses)
          ? intelligence.weaknesses
          : [];
        const weaknessEntries = weaknessesRaw
          .map((item) => {
            if (typeof item !== "object" || item === null) return null;
            const record = item as Record<string, unknown>;
            const topic = normalizeTopic(record.topic);
            if (!topic) return null;
            return {
              topic,
              reason: typeof record.reason === "string" ? record.reason : undefined,
              severity: normalizeSeverity(record.severity),
            };
          })
          .filter((value): value is { topic: string; reason: string | undefined; severity: IntelligenceSignalSeverity } =>
            value !== null
          );

        if (weaknessEntries.length > 0) {
          upsertWeakSignals(next, weaknessEntries, input.source ?? "resume");
          const impact = deriveWeaknessImpact(weaknessEntries);
          const technicalDepth = clampScore(100 - impact);
          const readiness = clampScore(95 - Math.round(impact * 0.85));
          next.metrics.technicalDepth = blend(next.metrics.technicalDepth, technicalDepth, 0.55);
          next.metrics.interviewReadiness = blend(next.metrics.interviewReadiness, readiness, 0.45);
        }

        const skillsRaw = Array.isArray(intelligence.skills) ? intelligence.skills : [];
        for (const skillItem of skillsRaw) {
          if (typeof skillItem !== "object" || skillItem === null) continue;
          const record = skillItem as Record<string, unknown>;
          const skillName = normalizeTopic(record.name);
          if (!skillName) continue;

          const confidence = typeof record.confidence === "string" ? record.confidence.toLowerCase() : "moderate";
          const delta = confidence === "high" ? 12 : confidence === "low" ? -8 : 5;
          updateSkillConfidence(next, skillName, delta, input.source ?? "resume");
        }

        const strengths = toStringArray(intelligence.strengths);
        if (strengths.length > 0) {
          upsertStrengthSignals(next, strengths, input.source ?? "resume", 82);
        }

        const recommendedRoles = toStringArray(intelligence.recommendedRoles);
        if (recommendedRoles.length > 0) {
          next.context.recommendedRoles = recommendedRoles.slice(0, 6);
        }

        const experienceLevel =
          typeof intelligence.experienceLevel === "string" ? intelligence.experienceLevel.toLowerCase() : "";
        if (experienceLevel === "beginner") {
          next.difficultyPreference = "easy";
        } else if (experienceLevel === "intermediate") {
          next.difficultyPreference = "medium";
        } else if (experienceLevel === "advanced") {
          next.difficultyPreference = "hard";
        }
      }

      pushHistory(next, {
        module: "resume-analysis",
        topic: next.context.targetRole ?? undefined,
        score: next.metrics.interviewReadiness,
      });
      updateBehavior(next, {
        module: "resume-analysis",
        confidence: next.metrics.interviewReadiness,
      });
      break;
    }

    case "resume.questions.generated": {
      const focusAreas = toStringArray(payload.focusAreas);
      if (focusAreas.length > 0) {
        upsertWeakSignals(
          next,
          focusAreas.map((topic) => ({ topic, severity: "low" })),
          input.source ?? "resume-questions"
        );
      }

      if (typeof payload.difficultyPreference === "string") {
        next.difficultyPreference = normalizeDifficultyPreference(payload.difficultyPreference);
      }

      if (typeof payload.selectedRole === "string" && payload.selectedRole.trim()) {
        next.context.targetRole = payload.selectedRole.trim();
      }

      const generatedCount = typeof payload.count === "number" ? payload.count : 0;
      const completionScore = clampScore(60 + Math.min(35, generatedCount * 2));
      next.metrics.consistency = blend(next.metrics.consistency, completionScore, 0.28);

      pushHistory(next, {
        module: "resume-pipeline",
        topic: next.context.targetRole ?? undefined,
        score: completionScore,
      });
      updateBehavior(next, {
        module: "resume-pipeline",
        retries: 0,
        confidence: completionScore,
      });
      break;
    }

    case "interview.analysis.completed": {
      const analysis =
        typeof payload.analysis === "object" && payload.analysis !== null
          ? (payload.analysis as Record<string, unknown>)
          : payload;

      const weakTopicsRaw = Array.isArray(analysis.weakTopics) ? analysis.weakTopics : [];
      const weakEntries = weakTopicsRaw
        .map((item) => {
          if (typeof item !== "object" || item === null) return null;
          const record = item as Record<string, unknown>;
          const topic = normalizeTopic(record.topic);
          if (!topic) return null;

          return {
            topic,
            reason: typeof record.reason === "string" ? record.reason : undefined,
            severity: normalizeSeverity(record.severity),
          };
        })
        .filter((value): value is { topic: string; reason: string | undefined; severity: IntelligenceSignalSeverity } =>
          value !== null
        );

      if (weakEntries.length > 0) {
        upsertWeakSignals(next, weakEntries, input.source ?? "interview-analysis");
      }

      const overallReadiness = typeof analysis.overallReadiness === "number" ? analysis.overallReadiness : null;
      if (overallReadiness !== null) {
        next.metrics.interviewReadiness = blend(next.metrics.interviewReadiness, overallReadiness, 0.55);
        next.difficultyPreference = inferDifficultyPreference(overallReadiness);
      }

      const prioritySubject = typeof analysis.prioritySubject === "string" ? analysis.prioritySubject : null;
      if (prioritySubject && overallReadiness !== null) {
        updateMastery(next, prioritySubject, overallReadiness);
      }

      pushHistory(next, {
        module: "interview-analysis",
        topic: prioritySubject ?? undefined,
        score: overallReadiness ?? next.metrics.interviewReadiness,
      });
      updateBehavior(next, {
        module: "interview-analysis",
        confidence: overallReadiness,
      });
      break;
    }

    case "interview.realtime.signal": {
      const confidenceScore = coerceNumber(payload.confidenceScore);
      const clarityScore = coerceNumber(payload.clarityScore);
      const readinessScore = coerceNumber(payload.readinessScore);
      const responseTimeMs = coerceNumber(payload.responseTimeMs);
      const retries = coerceNumber(payload.retries);

      if (confidenceScore !== null) {
        next.metrics.communication = blend(next.metrics.communication, confidenceScore, 0.36);
      }
      if (clarityScore !== null) {
        next.metrics.problemSolving = blend(next.metrics.problemSolving, clarityScore, 0.22);
      }
      if (readinessScore !== null) {
        next.metrics.interviewReadiness = blend(next.metrics.interviewReadiness, readinessScore, 0.3);
        next.difficultyPreference = inferDifficultyPreference(readinessScore);
      }

      const weakHints = toStringArray(payload.weakHints);
      if (weakHints.length > 0) {
        upsertWeakSignals(
          next,
          weakHints.map((topic) => ({ topic, severity: "low" })),
          input.source ?? "interview-realtime"
        );
      }

      pushHistory(next, {
        module: "interview-realtime",
        score: readinessScore ?? next.metrics.interviewReadiness,
        responseTimeMs,
        retries: retries ?? 0,
        confidence: confidenceScore,
      });
      updateBehavior(next, {
        module: "interview-realtime",
        responseTimeMs,
        retries: retries ?? undefined,
        confidence: confidenceScore,
      });
      break;
    }

    case "interview.feedback.created": {
      const totalScore = typeof payload.totalScore === "number" ? payload.totalScore : null;
      if (totalScore !== null) {
        next.metrics.interviewReadiness = blend(next.metrics.interviewReadiness, totalScore, 0.6);
        next.metrics.consistency = blend(next.metrics.consistency, totalScore, 0.35);
        next.difficultyPreference = inferDifficultyPreference(totalScore);
      }

      const categoryScores = Array.isArray(payload.categoryScores) ? payload.categoryScores : [];
      for (const scoreItem of categoryScores) {
        if (typeof scoreItem !== "object" || scoreItem === null) continue;
        const record = scoreItem as Record<string, unknown>;
        const score = typeof record.score === "number" ? record.score : null;
        const name = typeof record.name === "string" ? record.name.toLowerCase() : "";
        if (score === null) continue;

        if (name.includes("communication")) {
          next.metrics.communication = blend(next.metrics.communication, score, 0.65);
        } else if (name.includes("technical")) {
          next.metrics.technicalDepth = blend(next.metrics.technicalDepth, score, 0.65);
        } else if (name.includes("problem")) {
          next.metrics.problemSolving = blend(next.metrics.problemSolving, score, 0.65);
        }
      }

      const strengths = toStringArray(payload.strengths);
      if (strengths.length > 0) {
        upsertStrengthSignals(next, strengths, input.source ?? "feedback", 78);
      }

      const weakAreas = toStringArray(payload.areasForImprovement);
      if (weakAreas.length > 0) {
        upsertWeakSignals(
          next,
          weakAreas.map((topic) => ({ topic, severity: "medium" })),
          input.source ?? "feedback"
        );
      }

      pushHistory(next, {
        module: "interview-feedback",
        score: totalScore ?? next.metrics.interviewReadiness,
        confidence: totalScore,
      });
      updateBehavior(next, {
        module: "interview-feedback",
        confidence: totalScore,
      });
      break;
    }

    case "interview.answer_scoring.completed": {
      const scoring =
        typeof payload.scoring === "object" && payload.scoring !== null
          ? (payload.scoring as Record<string, unknown>)
          : payload;
      const overallStats =
        typeof scoring.overallStats === "object" && scoring.overallStats !== null
          ? (scoring.overallStats as Record<string, unknown>)
          : null;

      if (overallStats) {
        const technical =
          typeof overallStats.avgTechnicalCorrectness === "number"
            ? overallStats.avgTechnicalCorrectness * 10
            : null;
        const terminology =
          typeof overallStats.avgTerminologyUsage === "number"
            ? overallStats.avgTerminologyUsage * 10
            : null;
        const depth =
          typeof overallStats.avgDepthOfExplanation === "number"
            ? overallStats.avgDepthOfExplanation * 10
            : null;
        const readiness =
          typeof overallStats.avgInterviewReadiness === "number"
            ? overallStats.avgInterviewReadiness * 10
            : null;

        if (technical !== null) next.metrics.technicalDepth = blend(next.metrics.technicalDepth, technical, 0.6);
        if (terminology !== null) next.metrics.communication = blend(next.metrics.communication, terminology, 0.5);
        if (depth !== null) next.metrics.problemSolving = blend(next.metrics.problemSolving, depth, 0.35);
        if (readiness !== null) next.metrics.interviewReadiness = blend(next.metrics.interviewReadiness, readiness, 0.55);

        pushHistory(next, {
          module: "interview-answer-scoring",
          score: readiness ?? technical ?? depth ?? next.metrics.interviewReadiness,
          confidence: terminology ?? readiness,
        });
        updateBehavior(next, {
          module: "interview-answer-scoring",
          confidence: readiness ?? terminology,
        });
      }
      break;
    }

    case "company.test.submitted": {
      if (typeof payload.companyId === "string") next.context.companyId = payload.companyId || null;
      if (typeof payload.roleId === "string") next.context.roleId = payload.roleId || null;

      const result =
        typeof payload.result === "object" && payload.result !== null
          ? (payload.result as Record<string, unknown>)
          : payload;

      const score = typeof result.score === "number" ? result.score : null;
      if (score !== null) {
        next.metrics.interviewReadiness = blend(next.metrics.interviewReadiness, score, 0.5);
        next.metrics.problemSolving = blend(next.metrics.problemSolving, score, 0.45);
        updateMastery(next, "Company Prep", score);
        next.difficultyPreference = inferDifficultyPreference(score);
      }

      const weakAreas = toStringArray(result.weakAreas);
      if (weakAreas.length > 0) {
        upsertWeakSignals(
          next,
          weakAreas.map((topic) => ({ topic, severity: "medium" })),
          input.source ?? "company-test"
        );
      }

      pushHistory(next, {
        module: "company-test",
        topic: next.context.roleId ?? next.context.targetRole ?? undefined,
        score: score ?? next.metrics.interviewReadiness,
      });
      updateBehavior(next, {
        module: "company-test",
        confidence: score,
      });
      break;
    }

    case "code.evaluation.completed": {
      const evaluation =
        typeof payload.evaluation === "object" && payload.evaluation !== null
          ? (payload.evaluation as Record<string, unknown>)
          : payload;

      const score = typeof evaluation.score === "number" ? evaluation.score : null;
      if (score !== null) {
        next.metrics.problemSolving = blend(next.metrics.problemSolving, score, 0.65);
        next.metrics.technicalDepth = blend(next.metrics.technicalDepth, score, 0.3);
        updateMastery(next, "Coding", score);
        next.difficultyPreference = inferDifficultyPreference(score);
      }

      const strengths = toStringArray(evaluation.strengths);
      if (strengths.length > 0) {
        upsertStrengthSignals(next, strengths, input.source ?? "code-eval", 80);
      }

      const improvements = toStringArray(evaluation.improvements);
      if (improvements.length > 0) {
        upsertWeakSignals(
          next,
          improvements.map((topic) => ({ topic, severity: "low" })),
          input.source ?? "code-eval"
        );
      }

      pushHistory(next, {
        module: "code-evaluation",
        score: score ?? next.metrics.problemSolving,
      });
      updateBehavior(next, {
        module: "code-evaluation",
        confidence: score,
      });
      break;
    }

    case "mistakes.review.updated": {
      const correct = payload.correct === true;
      const conceptId = typeof payload.conceptId === "string" ? payload.conceptId : "";

      if (conceptId) {
        if (correct) {
          upsertStrengthSignals(next, [conceptId], input.source ?? "mistake-review", 74);
        } else {
          upsertWeakSignals(next, [{ topic: conceptId, severity: "high" }], input.source ?? "mistake-review");
        }

        pushHistory(next, {
          module: "mistake-review",
          topic: conceptId,
          score: correct ? 78 : 34,
        });
        updateBehavior(next, {
          module: "mistake-review",
          confidence: correct ? 78 : 34,
        });
      }
      break;
    }

    case "progress.topic.updated": {
      const subject = typeof payload.subject === "string" ? payload.subject : "General";
      const topic = typeof payload.topicName === "string" ? payload.topicName : "";
      const score = typeof payload.score === "number" ? payload.score : null;
      const responseTimeMs = coerceNumber(payload.responseTimeMs);
      const retries = coerceNumber(payload.retries);

      if (score !== null) {
        updateMastery(next, subject, score);
        next.metrics.consistency = blend(next.metrics.consistency, score, 0.2);
        next.difficultyPreference = inferDifficultyPreference(score);

        if (topic) {
          if (score >= 80) {
            upsertStrengthSignals(next, [topic], input.source ?? "progress", 76);
          } else if (score <= 45) {
            upsertWeakSignals(next, [{ topic, severity: "high" }], input.source ?? "progress");
          }
        }
      }

      pushHistory(next, {
        module: "progress",
        topic: topic || subject,
        score: score ?? next.metrics.consistency,
        responseTimeMs,
        retries: retries ?? 0,
      });
      updateBehavior(next, {
        module: "progress",
        responseTimeMs,
        retries: retries ?? undefined,
        confidence: score,
      });
      break;
    }

    case "learning.behavior.tracked": {
      const moduleName = typeof payload.module === "string" ? payload.module : "learning";
      const topic = typeof payload.topicName === "string" ? payload.topicName : "";
      const score = coerceNumber(payload.score) ?? coerceNumber(payload.accuracy);
      const responseTimeMs = coerceNumber(payload.responseTimeMs);
      const retries = coerceNumber(payload.retries);
      const confidence = coerceNumber(payload.confidence);

      if (score !== null) {
        next.metrics.consistency = blend(next.metrics.consistency, score, 0.26);
        if (moduleName.toLowerCase().includes("coding")) {
          next.metrics.problemSolving = blend(next.metrics.problemSolving, score, 0.28);
        }
        if (moduleName.toLowerCase().includes("interview")) {
          next.metrics.interviewReadiness = blend(next.metrics.interviewReadiness, score, 0.28);
        }

        if (topic) {
          if (score >= 80) {
            upsertStrengthSignals(next, [topic], input.source ?? moduleName, 78);
          } else if (score <= 45) {
            upsertWeakSignals(next, [{ topic, severity: "medium" }], input.source ?? moduleName);
          }
        }

        next.difficultyPreference = inferDifficultyPreference(score);
      }

      if (typeof payload.difficultyPreference === "string") {
        next.difficultyPreference = normalizeDifficultyPreference(payload.difficultyPreference);
      }

      pushHistory(next, {
        module: moduleName,
        topic: topic || undefined,
        score: score ?? next.metrics.consistency,
        responseTimeMs,
        retries: retries ?? 0,
        confidence,
      });
      updateBehavior(next, {
        module: moduleName,
        responseTimeMs,
        retries: retries ?? undefined,
        confidence: confidence ?? score,
      });
      break;
    }

    default:
      break;
  }

  refreshAreaCaches(next);
  pushRecentEvent(next, input);
  next.updatedAt = nowIso();

  return next;
}

export async function getIntelligenceSnapshot(
  userId: string,
  options?: { bypassCache?: boolean }
): Promise<UserIntelligenceSnapshot> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error("userId is required");
  }

  const bypassCache = options?.bypassCache === true;

  if (!bypassCache) {
    const cached = getCachedSnapshot(normalizedUserId);
    if (cached) {
      return cached;
    }

    const inflight = inflightSnapshotReads.get(normalizedUserId);
    if (inflight) {
      const snapshot = await inflight;
      return cloneSnapshot(snapshot);
    }
  }

  const loader = async (): Promise<UserIntelligenceSnapshot> => {
    const ref = db.collection(COLLECTION_NAME).doc(normalizedUserId);
    const snapshotDoc = await ref.get();

    if (!snapshotDoc.exists) {
      const empty = createDefaultSnapshot(normalizedUserId);
      await ref.set(empty, { merge: true });
      setCachedSnapshot(normalizedUserId, empty);
      return cloneSnapshot(empty);
    }

    const hydrated = hydrateSnapshot(normalizedUserId, snapshotDoc.data() as Partial<UserIntelligenceSnapshot>);
    setCachedSnapshot(normalizedUserId, hydrated);
    return cloneSnapshot(hydrated);
  };

  if (bypassCache) {
    return loader();
  }

  const inflightRead = loader().finally(() => {
    inflightSnapshotReads.delete(normalizedUserId);
  });

  inflightSnapshotReads.set(normalizedUserId, inflightRead);
  const snapshot = await inflightRead;
  return cloneSnapshot(snapshot);
}

export async function ingestIntelligenceEvent(
  input: IntelligenceEventInput,
  options?: {
    bypassSnapshotReadCache?: boolean;
    recordEventLog?: boolean;
  }
): Promise<UserIntelligenceSnapshot> {
  const normalizedInput: IntelligenceEventInput = {
    ...input,
    userId: input.userId.trim(),
    source: input.source ?? "unknown",
    eventType: input.eventType ?? "unknown",
  };

  if (!normalizedInput.userId) {
    throw new Error("userId is required to ingest intelligence event");
  }

  const bypassSnapshotReadCache = options?.bypassSnapshotReadCache ?? true;
  const recordEventLog = options?.recordEventLog ?? true;

  const current = await getIntelligenceSnapshot(normalizedInput.userId, {
    bypassCache: bypassSnapshotReadCache,
  });
  const next = applyEvent(current, normalizedInput);

  const ref = db.collection(COLLECTION_NAME).doc(normalizedInput.userId);
  const eventRecord = stripUndefinedDeep({
    type: normalizedInput.eventType,
    source: normalizedInput.source,
    payload: normalizedInput.payload,
    createdAt: nowIso(),
  });

  const batch = db.batch();
  batch.set(ref, stripUndefinedDeep(next), { merge: true });
  if (recordEventLog) {
    const eventRef = ref.collection("events").doc();
    batch.set(eventRef, eventRecord);
  }
  await batch.commit();

  setCachedSnapshot(normalizedInput.userId, next);

  return next;
}

export function isKnownIntelligenceEventType(value: string): value is IntelligenceEventType {
  const knownTypes: IntelligenceEventType[] = [
    "resume.analysis.completed",
    "resume.questions.generated",
    "interview.analysis.completed",
    "interview.answer_scoring.completed",
    "interview.realtime.signal",
    "interview.feedback.created",
    "company.test.submitted",
    "code.evaluation.completed",
    "mistakes.review.updated",
    "progress.topic.updated",
    "learning.behavior.tracked",
    "context.selection.updated",
    "company.preference.updated",
    "unknown",
  ];

  return knownTypes.includes(value as IntelligenceEventType);
}
