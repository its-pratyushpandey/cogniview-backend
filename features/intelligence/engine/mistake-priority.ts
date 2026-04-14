import { db } from "@/firebase/admin";

export const MISTAKE_PRIORITY_THRESHOLD = 0.62;

const CACHE_TTL_MS = 1000 * 60 * 5;
const DAY_IN_MS = 1000 * 60 * 60 * 24;

const STOP_WORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "topic",
  "subject",
  "question",
  "concept",
  "about",
  "into",
  "over",
  "under",
]);

interface MistakeAttemptRecord {
  date?: string;
  correct?: boolean;
}

interface MistakeEntryRecord {
  subject?: string;
  topic?: string;
  conceptId?: string;
  attemptDate?: string;
  masteryLevel?: number;
  attempts?: MistakeAttemptRecord[];
}

interface CacheRecord {
  expiresAt: number;
  context: MistakePriorityContext;
}

interface AggregatedSignal {
  tag: string;
  frequencyRaw: number;
  lowSkillTotal: number;
  sampleSize: number;
  lastMistakeAtMs: number;
  labelCounts: Map<string, number>;
  topics: Set<string>;
  subjects: Set<string>;
}

const sessionCache = new Map<string, CacheRecord>();

export interface MistakePrioritySignal {
  tag: string;
  displayTag: string;
  mistakeFrequency: number;
  recencyWeight: number;
  lowSkillScore: number;
  priorityScore: number;
  lastMistakeAt: string;
  sampleSize: number;
  topics: string[];
  subjects: string[];
}

export interface MistakePriorityContext {
  userId: string;
  sessionKey: string;
  loadedAt: string;
  signals: MistakePrioritySignal[];
  topSignal: MistakePrioritySignal | null;
}

export interface MistakePriorityCandidate {
  tags?: string[];
  topic?: string;
  subject?: string;
  text?: string;
}

export interface MistakePriorityQuestionMetadata {
  targetedWeakArea: boolean;
  priorityScore: number;
  threshold: number;
  matchedTag: string | null;
  reason: string;
}

export interface MistakePriorityOverrideResult {
  overrideApplied: boolean;
  threshold: number;
  selectedTopic: string;
  metadata: MistakePriorityQuestionMetadata | null;
  context: MistakePriorityContext;
}

function normalizeTag(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function denormalizeTag(value: string): string {
  return value.replace(/-/g, " ").trim();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function parseDateMs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFrequency(rawFrequency: number): number {
  return clamp01(rawFrequency / 5);
}

function recencyWeight(lastMistakeAtMs: number, nowMs: number): number {
  const daysAgo = Math.max(0, (nowMs - lastMistakeAtMs) / DAY_IN_MS);
  return clamp01(1 / (1 + daysAgo / 7));
}

function computePriorityScore(input: {
  mistakeFrequency: number;
  recencyWeightValue: number;
  lowSkillScore: number;
}): number {
  const { mistakeFrequency, recencyWeightValue, lowSkillScore } = input;

  return round4(mistakeFrequency * 0.5 + recencyWeightValue * 0.3 + lowSkillScore * 0.2);
}

function getCacheKey(userId: string, sessionKey?: string): string {
  return `${userId.trim()}::${(sessionKey ?? "default").trim() || "default"}`;
}

function toUniqueStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }

  return out;
}

function expandTags(labels: string[]): Array<{ tag: string; label: string }> {
  const expanded: Array<{ tag: string; label: string }> = [];
  const seen = new Set<string>();

  for (const labelRaw of labels) {
    const label = labelRaw.trim();
    if (!label) continue;

    const primaryTag = normalizeTag(label);
    if (primaryTag && !seen.has(primaryTag)) {
      seen.add(primaryTag);
      expanded.push({ tag: primaryTag, label });
    }

    const tokens = primaryTag
      .split("-")
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

    for (const token of tokens) {
      if (seen.has(token)) continue;
      seen.add(token);
      expanded.push({ tag: token, label });
    }
  }

  return expanded;
}

function getBestLabel(labelCounts: Map<string, number>, fallbackTag: string): string {
  let bestLabel = "";
  let bestCount = -1;

  for (const [label, count] of labelCounts.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestLabel = label;
    }
  }

  return bestLabel || denormalizeTag(fallbackTag);
}

function signalMatchesTag(signalTag: string, candidateTag: string): boolean {
  return (
    signalTag === candidateTag ||
    signalTag.includes(candidateTag) ||
    candidateTag.includes(signalTag)
  );
}

function getCandidateTags(candidate: MistakePriorityCandidate): string[] {
  const fromTags = Array.isArray(candidate.tags) ? candidate.tags : [];
  const fromTopic = typeof candidate.topic === "string" ? [candidate.topic] : [];
  const fromSubject = typeof candidate.subject === "string" ? [candidate.subject] : [];
  const fromText =
    typeof candidate.text === "string"
      ? candidate.text
          .split(/\s+/)
          .slice(0, 10)
          .map((token) => token.trim())
      : [];

  return toUniqueStrings([...fromTags, ...fromTopic, ...fromSubject, ...fromText])
    .map(normalizeTag)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function chooseBestSignal(context: MistakePriorityContext, candidateTags: string[]): MistakePrioritySignal | null {
  if (context.signals.length === 0) {
    return null;
  }

  if (candidateTags.length === 0) {
    return context.topSignal;
  }

  let bestMatch: MistakePrioritySignal | null = null;

  for (const signal of context.signals) {
    const matched = candidateTags.some((tag) => signalMatchesTag(signal.tag, tag));
    if (!matched) continue;

    if (!bestMatch || signal.priorityScore > bestMatch.priorityScore) {
      bestMatch = signal;
    }
  }

  return bestMatch ?? context.topSignal;
}

function buildReason(signal: MistakePrioritySignal): string {
  const topic = signal.topics[0] ?? signal.displayTag;
  return `You struggled with ${topic.toLowerCase()} recently`;
}

function buildMetadata(
  signal: MistakePrioritySignal | null,
  threshold: number
): MistakePriorityQuestionMetadata {
  if (!signal) {
    return {
      targetedWeakArea: false,
      priorityScore: 0,
      threshold,
      matchedTag: null,
      reason: "",
    };
  }

  return {
    targetedWeakArea: signal.priorityScore >= threshold,
    priorityScore: signal.priorityScore,
    threshold,
    matchedTag: signal.tag,
    reason: buildReason(signal),
  };
}

async function loadSignalsFromFirestore(userId: string): Promise<MistakePrioritySignal[]> {
  const doc = await db.collection("mistakeMemory").doc(userId).get();
  const rawMistakes = (doc.data()?.mistakes as MistakeEntryRecord[] | undefined) ?? [];

  if (!Array.isArray(rawMistakes) || rawMistakes.length === 0) {
    return [];
  }

  const nowMs = Date.now();
  const aggregation = new Map<string, AggregatedSignal>();

  for (const entry of rawMistakes) {
    if (!entry || typeof entry !== "object") continue;

    const subject = typeof entry.subject === "string" ? entry.subject.trim() : "";
    const topic = typeof entry.topic === "string" ? entry.topic.trim() : "";

    const attempts = Array.isArray(entry.attempts) ? entry.attempts : [];
    const wrongAttempts = attempts.filter((attempt) => attempt?.correct === false).length;
    const frequencyRaw = Math.max(1, wrongAttempts || 1);

    let latestMistakeMs = parseDateMs(entry.attemptDate) ?? nowMs;
    for (const attempt of attempts) {
      const dateMs = parseDateMs(attempt?.date);
      if (dateMs !== null) {
        latestMistakeMs = Math.max(latestMistakeMs, dateMs);
      }
    }

    const masteryLevel =
      typeof entry.masteryLevel === "number" && Number.isFinite(entry.masteryLevel)
        ? entry.masteryLevel
        : 0;
    const lowSkillScore = clamp01((100 - masteryLevel) / 100);

    const tagsToExpand = toUniqueStrings([topic, subject]);
    const expandedTags = expandTags(tagsToExpand);

    for (const expandedTag of expandedTags) {
      const existing = aggregation.get(expandedTag.tag);

      if (!existing) {
        const created: AggregatedSignal = {
          tag: expandedTag.tag,
          frequencyRaw,
          lowSkillTotal: lowSkillScore,
          sampleSize: 1,
          lastMistakeAtMs: latestMistakeMs,
          labelCounts: new Map([[expandedTag.label, 1]]),
          topics: topic ? new Set([topic]) : new Set<string>(),
          subjects: subject ? new Set([subject]) : new Set<string>(),
        };
        aggregation.set(expandedTag.tag, created);
        continue;
      }

      existing.frequencyRaw += frequencyRaw;
      existing.lowSkillTotal += lowSkillScore;
      existing.sampleSize += 1;
      existing.lastMistakeAtMs = Math.max(existing.lastMistakeAtMs, latestMistakeMs);
      existing.labelCounts.set(expandedTag.label, (existing.labelCounts.get(expandedTag.label) ?? 0) + 1);

      if (topic) existing.topics.add(topic);
      if (subject) existing.subjects.add(subject);
    }
  }

  const signals: MistakePrioritySignal[] = [];

  for (const signal of aggregation.values()) {
    const frequency = round4(normalizeFrequency(signal.frequencyRaw));
    const recency = round4(recencyWeight(signal.lastMistakeAtMs, nowMs));
    const lowSkill = round4(clamp01(signal.lowSkillTotal / Math.max(1, signal.sampleSize)));
    const priorityScore = computePriorityScore({
      mistakeFrequency: frequency,
      recencyWeightValue: recency,
      lowSkillScore: lowSkill,
    });

    signals.push({
      tag: signal.tag,
      displayTag: getBestLabel(signal.labelCounts, signal.tag),
      mistakeFrequency: frequency,
      recencyWeight: recency,
      lowSkillScore: lowSkill,
      priorityScore,
      lastMistakeAt: new Date(signal.lastMistakeAtMs).toISOString(),
      sampleSize: signal.sampleSize,
      topics: Array.from(signal.topics),
      subjects: Array.from(signal.subjects),
    });
  }

  return signals.sort((a, b) => {
    const byPriority = b.priorityScore - a.priorityScore;
    if (byPriority !== 0) return byPriority;

    const byRecency = b.recencyWeight - a.recencyWeight;
    if (byRecency !== 0) return byRecency;

    return b.mistakeFrequency - a.mistakeFrequency;
  });
}

export function invalidateMistakePriorityCache(userId?: string): void {
  if (!userId || !userId.trim()) {
    sessionCache.clear();
    return;
  }

  const userPrefix = `${userId.trim()}::`;

  for (const key of sessionCache.keys()) {
    if (key.startsWith(userPrefix)) {
      sessionCache.delete(key);
    }
  }
}

export async function getMistakePriorityContext(input: {
  userId: string;
  sessionKey?: string;
  forceRefresh?: boolean;
  cacheTtlMs?: number;
}): Promise<MistakePriorityContext> {
  const userId = input.userId.trim();
  const sessionKey = (input.sessionKey ?? "default").trim() || "default";

  if (!userId) {
    return {
      userId: "",
      sessionKey,
      loadedAt: new Date().toISOString(),
      signals: [],
      topSignal: null,
    };
  }

  const cacheKey = getCacheKey(userId, sessionKey);
  const nowMs = Date.now();
  const cacheTtlMs = input.cacheTtlMs ?? CACHE_TTL_MS;

  const cached = sessionCache.get(cacheKey);
  if (!input.forceRefresh && cached && cached.expiresAt > nowMs) {
    return cached.context;
  }

  let signals: MistakePrioritySignal[] = [];

  try {
    signals = await loadSignalsFromFirestore(userId);
  } catch (error) {
    console.error("[mistake-priority] Failed to load mistake memory", error);
  }

  const context: MistakePriorityContext = {
    userId,
    sessionKey,
    loadedAt: new Date().toISOString(),
    signals,
    topSignal: signals[0] ?? null,
  };

  sessionCache.set(cacheKey, {
    context,
    expiresAt: nowMs + cacheTtlMs,
  });

  return context;
}

export function getMistakePriorityMetadataForCandidate(input: {
  context: MistakePriorityContext;
  candidate: MistakePriorityCandidate;
  threshold?: number;
}): MistakePriorityQuestionMetadata {
  const threshold = input.threshold ?? MISTAKE_PRIORITY_THRESHOLD;
  const candidateTags = getCandidateTags(input.candidate);
  const bestSignal = chooseBestSignal(input.context, candidateTags);

  return buildMetadata(bestSignal, threshold);
}

export function annotateCandidatesWithMistakePriority<T extends MistakePriorityCandidate>(input: {
  context: MistakePriorityContext;
  candidates: T[];
  threshold?: number;
}): Array<{ candidate: T; metadata: MistakePriorityQuestionMetadata }> {
  const threshold = input.threshold ?? MISTAKE_PRIORITY_THRESHOLD;

  return input.candidates.map((candidate) => ({
    candidate,
    metadata: getMistakePriorityMetadataForCandidate({
      context: input.context,
      candidate,
      threshold,
    }),
  }));
}

export async function resolveMistakePriorityTopicOverride(input: {
  userId: string;
  selectedTopic: string;
  subject?: string;
  threshold?: number;
  sessionKey?: string;
}): Promise<MistakePriorityOverrideResult> {
  const threshold = input.threshold ?? MISTAKE_PRIORITY_THRESHOLD;
  const context = await getMistakePriorityContext({
    userId: input.userId,
    sessionKey: input.sessionKey,
  });

  const metadata = getMistakePriorityMetadataForCandidate({
    context,
    candidate: {
      topic: input.selectedTopic,
      subject: input.subject,
    },
    threshold,
  });

  const selectedSignal = chooseBestSignal(
    context,
    getCandidateTags({ topic: input.selectedTopic, subject: input.subject })
  );

  const overrideApplied = Boolean(metadata.targetedWeakArea && selectedSignal);
  const selectedTopic =
    overrideApplied && selectedSignal
      ? selectedSignal.topics[0] ?? selectedSignal.displayTag
      : input.selectedTopic;

  return {
    overrideApplied,
    threshold,
    selectedTopic,
    metadata: selectedSignal ? metadata : null,
    context,
  };
}
