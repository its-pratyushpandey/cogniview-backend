import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { APP_NAV } from "@/components/shell/nav";
import type { Company, CompanyQuestion, Role } from "@/features/company-prep/types";
import {
  FALLBACK_COMPANIES,
  FALLBACK_QUESTIONS,
  FALLBACK_ROLES,
} from "@/features/company-prep/utils/mock-data";
import type { UserIntelligenceSnapshot } from "@/features/intelligence/types";
import type {
  SearchResponsePayload,
  SearchResultItem,
} from "@/lib/search/types";

const RESPONSE_CACHE_TTL_MS = 45_000;
const INDEX_CACHE_TTL_MS = 4 * 60_000;
const MAX_RESULTS_PER_CATEGORY = 7;

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
  "dsa",
] as const;

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
] as const;

const COMMUNICATION_KEYWORDS = [
  "communication",
  "confidence",
  "fluency",
  "conciseness",
  "answer structure",
  "storytelling",
  "behavioral",
  "presentation",
  "interview",
] as const;

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
] as const;

const ALWAYS_AVAILABLE_TOPICS = ["OS", "DBMS", "OOPS", "CN", "DSA"] as const;

const querySchema = z.object({
  q: z.string().trim().min(1, "q is required").max(120, "q is too long"),
  userId: z.string().trim().min(1).optional(),
});

type SearchIndexEntry = Omit<SearchResultItem, "score"> & {
  keywords: string[];
};

type BaseSearchIndex = {
  questions: SearchIndexEntry[];
  topics: SearchIndexEntry[];
  navigation: SearchIndexEntry[];
};

type PersonalizationContext = {
  weakAreas: string[];
  recentActivity: string[];
  weakTerms: string[];
  recentTerms: string[];
};

type SearchCacheEntry = {
  expiresAt: number;
  payload: SearchResponsePayload;
};

type IndexCacheEntry = {
  expiresAt: number;
  value: BaseSearchIndex;
};

const responseCache = new Map<string, SearchCacheEntry>();
let indexCache: IndexCacheEntry | null = null;

const EMPTY_PERSONALIZATION: PersonalizationContext = {
  weakAreas: [],
  recentActivity: [],
  weakTerms: [],
  recentTerms: [],
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function toStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    out.push(value.trim());
  }

  return out;
}

function dedupeBy<T>(items: T[], keySelector: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const item of items) {
    const key = normalizeText(keySelector(item));
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(item);
  }

  return out;
}

function isTopicKeywordHit(topic: string, keywords: readonly string[]): boolean {
  const normalized = normalizeText(topic);
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

function routeForTopic(topic: string): string {
  if (isTopicKeywordHit(topic, CODING_TOPIC_KEYWORDS)) {
    return "/code-playground";
  }

  if (isTopicKeywordHit(topic, CS_REVISION_KEYWORDS)) {
    return "/revision";
  }

  if (isTopicKeywordHit(topic, COMMUNICATION_KEYWORDS)) {
    return "/interview";
  }

  if (isTopicKeywordHit(topic, APTITUDE_KEYWORDS)) {
    return "/aptitude";
  }

  return `/tutor?topic=${encodeURIComponent(topic)}`;
}

function formatTopicLabel(value: string): string {
  const upperTokens = new Set(["os", "dbms", "oops", "cn", "dsa", "sql", "api", "http", "https", "ui", "ux"]);

  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const lower = token.toLowerCase();
      if (upperTokens.has(lower)) {
        return lower.toUpperCase();
      }

      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function subsequenceScore(query: string, target: string): number {
  let queryIndex = 0;
  let targetIndex = 0;
  let streak = 0;
  let score = 0;

  while (queryIndex < query.length && targetIndex < target.length) {
    if (query[queryIndex] === target[targetIndex]) {
      score += streak > 0 ? 3 : 2;
      streak += 1;
      queryIndex += 1;
    } else {
      streak = 0;
    }

    targetIndex += 1;
  }

  return queryIndex === query.length ? score : 0;
}

function fuzzyScore(query: string, title: string, subtitle: string, keywords: string[]): number {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return 0;
  }

  const target = normalizeText(`${title} ${subtitle} ${keywords.join(" ")}`);
  if (!target) {
    return 0;
  }

  if (target === normalizedQuery) {
    return 200;
  }

  let score = 0;

  if (target.startsWith(normalizedQuery)) {
    score += 120;
  } else if (target.includes(normalizedQuery)) {
    score += 85;
  }

  const queryTokens = tokenize(normalizedQuery);
  const targetTokens = tokenize(target);

  let tokenMatches = 0;

  for (const token of queryTokens) {
    if (targetTokens.includes(token)) {
      score += 24;
      tokenMatches += 1;
      continue;
    }

    if (targetTokens.some((targetToken) => targetToken.startsWith(token))) {
      score += 16;
      tokenMatches += 1;
      continue;
    }

    if (targetTokens.some((targetToken) => targetToken.includes(token))) {
      score += 10;
    }
  }

  if (queryTokens.length > 1 && tokenMatches === queryTokens.length) {
    score += 26;
  }

  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const compactTarget = target.replace(/\s+/g, "");
  score += Math.min(28, subsequenceScore(compactQuery, compactTarget));

  return score;
}

function countTermHits(blob: string, terms: string[]): number {
  let hits = 0;

  for (const term of terms) {
    if (term.length < 3) {
      continue;
    }

    if (blob.includes(term)) {
      hits += 1;
    }
  }

  return hits;
}

function computeRankScore(query: string, entry: SearchIndexEntry, personalization: PersonalizationContext): number {
  const base = fuzzyScore(query, entry.title, entry.subtitle, entry.keywords);
  if (base <= 0) {
    return 0;
  }

  const blob = normalizeText(`${entry.title} ${entry.subtitle} ${entry.keywords.join(" ")}`);
  const weakHits = countTermHits(blob, personalization.weakTerms);
  const recentHits = countTermHits(blob, personalization.recentTerms);

  return base + weakHits * 14 + recentHits * 10;
}

function minScoreForQuery(query: string): number {
  const normalized = normalizeText(query);
  if (normalized.length <= 2) {
    return 72;
  }

  if (normalized.length <= 4) {
    return 54;
  }

  return 40;
}

function rankCategory(
  entries: SearchIndexEntry[],
  query: string,
  personalization: PersonalizationContext
): SearchResultItem[] {
  const minimumScore = minScoreForQuery(query);

  return entries
    .map((entry) => {
      const score = computeRankScore(query, entry, personalization);
      return {
        id: entry.id,
        category: entry.category,
        kind: entry.kind,
        title: entry.title,
        subtitle: entry.subtitle,
        href: entry.href,
        badge: entry.badge,
        score,
      } satisfies SearchResultItem;
    })
    .filter((entry) => entry.score >= minimumScore)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return left.title.length - right.title.length;
    })
    .slice(0, MAX_RESULTS_PER_CATEGORY);
}

function parseCompanyFromDb(id: string, raw: Record<string, unknown>): Company | null {
  const name = toStringValue(raw.name) ?? id;
  const roles = toStringArray(raw.roles);
  const frequentTopics = toStringArray(raw.frequentTopics);

  if (roles.length === 0) {
    return null;
  }

  return {
    id,
    name,
    roles,
    frequentTopics,
    description: toStringValue(raw.description) ?? undefined,
    logoUrl: toStringValue(raw.logoUrl) ?? undefined,
  };
}

function parseRoleFromDb(id: string, raw: Record<string, unknown>): Role | null {
  const name = toStringValue(raw.name) ?? id;
  const skills = toStringArray(raw.skills);

  if (!name) {
    return null;
  }

  return {
    id,
    name,
    skills,
  };
}

function parseQuestionFromDb(id: string, raw: Record<string, unknown>): CompanyQuestion | null {
  const companyId = toStringValue(raw.companyId);
  const roleId = toStringValue(raw.roleId);
  const questionText = toStringValue(raw.question);
  const answer = toStringValue(raw.answer);

  if (!companyId || !roleId || !questionText || !answer) {
    return null;
  }

  const type = raw.type;
  const difficulty = raw.difficulty;

  return {
    id,
    companyId,
    roleId,
    question: questionText,
    answer,
    explanation: toStringValue(raw.explanation) ?? "",
    tags: toStringArray(raw.tags),
    type: type === "coding" || type === "mcq" || type === "theory" ? type : "theory",
    difficulty: difficulty === "easy" || difficulty === "medium" || difficulty === "hard" ? difficulty : "medium",
  };
}

async function loadCompaniesFromDatabase(): Promise<Company[]> {
  try {
    const { db } = await import("@/firebase/admin");
    const snapshot = await db.collection("companies").limit(250).get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs
      .map((doc) => parseCompanyFromDb(doc.id, doc.data() as Record<string, unknown>))
      .filter((company): company is Company => company !== null);
  } catch {
    return [];
  }
}

async function loadRolesFromDatabase(): Promise<Role[]> {
  try {
    const { db } = await import("@/firebase/admin");
    const snapshot = await db.collection("roles").limit(350).get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs
      .map((doc) => parseRoleFromDb(doc.id, doc.data() as Record<string, unknown>))
      .filter((role): role is Role => role !== null);
  } catch {
    return [];
  }
}

async function loadQuestionsFromDatabase(): Promise<CompanyQuestion[]> {
  try {
    const { db } = await import("@/firebase/admin");
    const snapshot = await db.collection("questions").limit(260).get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs
      .map((doc) => parseQuestionFromDb(doc.id, doc.data() as Record<string, unknown>))
      .filter((question): question is CompanyQuestion => question !== null);
  } catch {
    return [];
  }
}

function buildPriorityTerms(values: string[]): string[] {
  const terms = new Set<string>();

  for (const raw of values) {
    const normalizedValue = normalizeText(raw);
    if (!normalizedValue) {
      continue;
    }

    terms.add(normalizedValue);

    for (const token of normalizedValue.split(" ")) {
      if (token.length >= 3) {
        terms.add(token);
      }
    }
  }

  return Array.from(terms).slice(0, 40);
}

async function loadPersonalization(userId?: string): Promise<PersonalizationContext> {
  if (!userId) {
    return EMPTY_PERSONALIZATION;
  }

  try {
    const { getIntelligenceSnapshot } = await import("@/features/intelligence/services/intelligence.server");
    const snapshot = await getIntelligenceSnapshot(userId);

    return buildPersonalizationContext(snapshot);
  } catch {
    return EMPTY_PERSONALIZATION;
  }
}

function buildPersonalizationContext(snapshot: UserIntelligenceSnapshot): PersonalizationContext {
  const weakAreas = dedupeStrings([
    ...snapshot.weakAreas,
    ...snapshot.weakSignals.map((signal) => signal.topic),
  ]).slice(0, 14);

  const recentActivity = dedupeStrings([
    ...snapshot.recentEvents.map((event) => event.summary),
    ...snapshot.recentEvents.map((event) => event.type),
    ...snapshot.history.slice(0, 12).map((entry) => entry.module),
    ...snapshot.history.slice(0, 12).map((entry) => entry.topic ?? ""),
    ...snapshot.context.targetCompanies,
    snapshot.context.targetRole ?? "",
    snapshot.context.companyType ?? "",
  ]).slice(0, 20);

  return {
    weakAreas,
    recentActivity,
    weakTerms: buildPriorityTerms(weakAreas),
    recentTerms: buildPriorityTerms(recentActivity),
  };
}

function buildPersonalizedTopicEntries(personalization: PersonalizationContext): SearchIndexEntry[] {
  const weakEntries = personalization.weakAreas.map((topic) => {
    const label = formatTopicLabel(topic);

    return {
      id: `topic:weak:${normalizeText(topic)}`,
      category: "topics",
      kind: "topic",
      title: label,
      subtitle: "From your weak areas",
      href: routeForTopic(topic),
      keywords: [topic, label, "weak areas", "priority"],
      badge: "Weak",
    } satisfies SearchIndexEntry;
  });

  const recentEntries = personalization.recentActivity.slice(0, 10).map((topic) => {
    const label = formatTopicLabel(topic);

    return {
      id: `topic:recent:${normalizeText(topic)}`,
      category: "topics",
      kind: "topic",
      title: label,
      subtitle: "From your recent activity",
      href: routeForTopic(topic),
      keywords: [topic, label, "recent", "activity"],
      badge: "Recent",
    } satisfies SearchIndexEntry;
  });

  return dedupeBy([...weakEntries, ...recentEntries], (entry) => entry.id);
}

function pruneResponseCache(): void {
  const now = Date.now();

  for (const [key, value] of responseCache.entries()) {
    if (value.expiresAt <= now) {
      responseCache.delete(key);
    }
  }

  if (responseCache.size <= 140) {
    return;
  }

  const sorted = Array.from(responseCache.entries()).sort((left, right) => left[1].expiresAt - right[1].expiresAt);
  const removeCount = responseCache.size - 120;

  for (let i = 0; i < removeCount; i += 1) {
    const key = sorted[i]?.[0];
    if (key) {
      responseCache.delete(key);
    }
  }
}

function withCacheHit(payload: SearchResponsePayload, cacheHit: boolean): SearchResponsePayload {
  return {
    ...payload,
    meta: {
      ...payload.meta,
      cacheHit,
    },
  };
}

async function loadBaseIndex(): Promise<BaseSearchIndex> {
  const now = Date.now();

  if (indexCache && indexCache.expiresAt > now) {
    return indexCache.value;
  }

  const [dbCompanies, dbRoles, dbQuestions] = await Promise.all([
    loadCompaniesFromDatabase(),
    loadRolesFromDatabase(),
    loadQuestionsFromDatabase(),
  ]);

  const companies = dedupeBy([...dbCompanies, ...FALLBACK_COMPANIES], (company) => company.id);
  const roles = dedupeBy([...dbRoles, ...FALLBACK_ROLES], (role) => role.id);
  const questions = dedupeBy([...dbQuestions, ...FALLBACK_QUESTIONS], (question) => {
    return `${question.companyId}:${question.roleId}:${question.question}`;
  });

  const companyNameMap = new Map(companies.map((company) => [company.id, company.name]));
  const roleNameMap = new Map(roles.map((role) => [role.id, role.name]));

  const questionEntries: SearchIndexEntry[] = questions.map((question) => {
    const companyName = companyNameMap.get(question.companyId) ?? formatTopicLabel(question.companyId);
    const roleName = roleNameMap.get(question.roleId) ?? formatTopicLabel(question.roleId);

    return {
      id: `question:${question.companyId}:${question.roleId}:${question.id}`,
      category: "questions",
      kind: "question",
      title: question.question,
      subtitle: `${companyName} | ${roleName} | ${question.difficulty.toUpperCase()} ${question.type.toUpperCase()}`,
      href: `/company-prep?companyId=${encodeURIComponent(question.companyId)}&roleId=${encodeURIComponent(question.roleId)}`,
      keywords: [
        ...question.tags,
        companyName,
        roleName,
        question.difficulty,
        question.type,
        question.explanation,
      ],
      badge: question.difficulty,
    };
  });

  const topicSeed = new Map<
    string,
    {
      label: string;
      keywords: Set<string>;
      sourceLabel: string;
    }
  >();

  const upsertTopic = (rawTopic: string, sourceLabel: string, keywords: string[]) => {
    const normalized = normalizeText(rawTopic);
    if (!normalized) {
      return;
    }

    const label = formatTopicLabel(rawTopic);
    const existing = topicSeed.get(normalized);

    if (existing) {
      existing.keywords.add(rawTopic);
      existing.keywords.add(label);
      for (const keyword of keywords) {
        if (keyword.trim()) {
          existing.keywords.add(keyword.trim());
        }
      }
      return;
    }

    const keywordSet = new Set<string>([rawTopic, label, ...keywords.filter(Boolean)]);
    topicSeed.set(normalized, {
      label,
      keywords: keywordSet,
      sourceLabel,
    });
  };

  for (const topic of ALWAYS_AVAILABLE_TOPICS) {
    upsertTopic(topic, "Core interview topic", ["core", "fundamentals", "tutor"]);
  }

  for (const company of companies) {
    for (const topic of company.frequentTopics) {
      upsertTopic(topic, "Frequent company topic", [company.name, "company prep"]);
    }
  }

  for (const role of roles) {
    for (const skill of role.skills) {
      upsertTopic(skill, "Role skill", [role.name, "role skill"]);
    }
  }

  for (const question of questions) {
    for (const tag of question.tags) {
      upsertTopic(tag, "Question tag", [question.type, question.difficulty]);
    }
  }

  const topicEntries: SearchIndexEntry[] = Array.from(topicSeed.entries()).map(([normalized, topic]) => {
    return {
      id: `topic:${normalized}`,
      category: "topics",
      kind: "topic",
      title: topic.label,
      subtitle: topic.sourceLabel,
      href: routeForTopic(topic.label),
      keywords: Array.from(topic.keywords),
      badge: "Topic",
    };
  });

  const featureEntries: SearchIndexEntry[] = APP_NAV.flatMap((section) => {
    return section.items.map((item) => {
      const keywords = [
        section.title,
        item.title,
        item.description ?? "",
        item.href,
        "feature",
        "navigation",
      ];

      return {
        id: `feature:${item.href}:${normalizeText(item.title)}`,
        category: "navigation",
        kind: "feature",
        title: item.title,
        subtitle: item.description ?? `${section.title} feature`,
        href: item.href,
        keywords,
        badge: item.badge,
      };
    });
  });

  const companyNavigationEntries: SearchIndexEntry[] = companies.map((company) => {
    return {
      id: `company:${company.id}`,
      category: "navigation",
      kind: "company",
      title: `${company.name} Prep`,
      subtitle: company.description ?? "Company-specific preparation workspace",
      href: "/company-prep",
      keywords: [
        company.id,
        company.name,
        ...company.frequentTopics,
        "company",
        "prep",
        "questions",
        "mock",
      ],
      badge: "Company",
    };
  });

  const navigationEntries = dedupeBy([...featureEntries, ...companyNavigationEntries], (entry) => entry.id);

  const builtIndex: BaseSearchIndex = {
    questions: questionEntries,
    topics: topicEntries,
    navigation: navigationEntries,
  };

  indexCache = {
    expiresAt: now + INDEX_CACHE_TTL_MS,
    value: builtIndex,
  };

  return builtIndex;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const parsed = querySchema.safeParse({
      q: request.nextUrl.searchParams.get("q"),
      userId: request.nextUrl.searchParams.get("userId") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid query params",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const query = parsed.data.q;
    const userId = parsed.data.userId;
    const cacheKey = `${normalizeText(userId ?? "guest")}:${normalizeText(query)}`;

    pruneResponseCache();
    const cached = responseCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(withCacheHit(cached.payload, true));
    }

    const [baseIndex, personalization] = await Promise.all([loadBaseIndex(), loadPersonalization(userId)]);

    const personalizedTopics = buildPersonalizedTopicEntries(personalization);
    const topics = dedupeBy([...personalizedTopics, ...baseIndex.topics], (entry) => {
      return `${entry.category}:${entry.title}`;
    });

    const questions = rankCategory(baseIndex.questions, query, personalization);
    const topicResults = rankCategory(topics, query, personalization);
    const navigation = rankCategory(baseIndex.navigation, query, personalization);

    const payload: SearchResponsePayload = {
      query,
      categories: {
        questions,
        topics: topicResults,
        navigation,
      },
      meta: {
        tookMs: Date.now() - startedAt,
        weakAreas: personalization.weakAreas.slice(0, 8),
        recentActivity: personalization.recentActivity.slice(0, 8),
        cacheHit: false,
      },
    };

    responseCache.set(cacheKey, {
      expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
      payload,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[api/search] failed", error);
    return NextResponse.json(
      {
        error: "Failed to perform search",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
