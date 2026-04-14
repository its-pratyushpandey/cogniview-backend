import { db } from "@/firebase/admin";
import { getOrSetCachedValue, invalidateCacheByPrefix } from "@/features/company-prep/services/cache";
import {
  AdaptiveContext,
  Company,
  CompanyListResponse,
  CompanyMockResponse,
  CompanyPrepProgressNode,
  CompanyPrepStats,
  CompanyQuestion,
  CompanyQuestionsResponse,
  CompanyRolesResponse,
  CompanyTest,
  CompanyTestResponse,
  Difficulty,
  MockInterview,
  Role,
  TestSection,
  TestSubmissionInput,
  TestSubmissionResult,
  UserProgressDoc,
} from "@/features/company-prep/types";
import {
  FALLBACK_COMPANIES,
  FALLBACK_MOCK_INTERVIEWS,
  FALLBACK_QUESTIONS,
  FALLBACK_ROLES,
  FALLBACK_TESTS,
} from "@/features/company-prep/utils/mock-data";
import {
  createAdaptiveContext,
  deriveRecommendedDifficulty,
  normalizeTag,
  rankQuestionsByAdaptation,
  uniqueNormalized,
} from "@/features/company-prep/utils/adaptive";
import {
  MISTAKE_PRIORITY_THRESHOLD,
  annotateCandidatesWithMistakePriority,
  getMistakePriorityContext,
  type MistakePriorityContext,
} from "@/features/intelligence/engine/mistake-priority";

const CACHE_TTL = {
  COMPANIES: 1000 * 60 * 10,
  ROLES: 1000 * 60 * 10,
  QUESTIONS: 1000 * 60 * 5,
  MOCK: 1000 * 60 * 5,
  TEST: 1000 * 60 * 5,
  PROGRESS: 1000 * 30,
  SUGGESTIONS: 1000 * 60 * 5,
};

function toStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function toCompany(id: string, raw: Record<string, unknown>): Company {
  return {
    id,
    name: toStringValue(raw.name) ?? id,
    roles: toStringArray(raw.roles),
    frequentTopics: toStringArray(raw.frequentTopics),
    logoUrl: toStringValue(raw.logoUrl) ?? undefined,
    description: toStringValue(raw.description) ?? undefined,
  };
}

function toRole(id: string, raw: Record<string, unknown>): Role {
  return {
    id,
    name: toStringValue(raw.name) ?? id,
    skills: toStringArray(raw.skills),
  };
}

function toDifficulty(value: unknown): Difficulty {
  if (value === "easy" || value === "medium" || value === "hard") {
    return value;
  }

  return "medium";
}

function toQuestion(id: string, raw: Record<string, unknown>): CompanyQuestion {
  const type = raw.type;

  return {
    id,
    companyId: toStringValue(raw.companyId) ?? "",
    roleId: toStringValue(raw.roleId) ?? "",
    type: type === "coding" || type === "mcq" || type === "theory" ? type : "theory",
    difficulty: toDifficulty(raw.difficulty),
    tags: toStringArray(raw.tags),
    question: toStringValue(raw.question) ?? "",
    answer: toStringValue(raw.answer) ?? "",
    explanation: toStringValue(raw.explanation) ?? "",
  };
}

function toMockInterview(id: string, raw: Record<string, unknown>): MockInterview {
  const evaluationSchemaRaw =
    typeof raw.evaluationSchema === "object" && raw.evaluationSchema !== null
      ? (raw.evaluationSchema as Record<string, unknown>)
      : {};

  const toWeight = (key: string, fallback: number): number => {
    const value = evaluationSchemaRaw[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };

  return {
    id,
    companyId: toStringValue(raw.companyId) ?? "",
    roleId: toStringValue(raw.roleId) ?? "",
    questions: toStringArray(raw.questions),
    durationMinutes:
      typeof raw.durationMinutes === "number" && Number.isFinite(raw.durationMinutes)
        ? raw.durationMinutes
        : 30,
    evaluationSchema: {
      communicationWeight: toWeight("communicationWeight", 25),
      technicalWeight: toWeight("technicalWeight", 35),
      problemSolvingWeight: toWeight("problemSolvingWeight", 30),
      confidenceWeight: toWeight("confidenceWeight", 10),
    },
  };
}

function toTestSection(section: unknown): TestSection | null {
  if (typeof section !== "object" || section === null) {
    return null;
  }

  const raw = section as Record<string, unknown>;
  const type = raw.type;

  if (type !== "aptitude" && type !== "coding" && type !== "cs") {
    return null;
  }

  const questionList = Array.isArray(raw.questions)
    ? raw.questions
        .map((q) => {
          if (typeof q !== "object" || q === null) return null;
          const questionRaw = q as Record<string, unknown>;
          const id = toStringValue(questionRaw.id) ?? `inline-${Math.random().toString(36).slice(2, 8)}`;
          return toQuestion(id, questionRaw);
        })
        .filter((q): q is CompanyQuestion => q !== null)
    : [];

  return {
    id: toStringValue(raw.id) ?? `${type}-section`,
    type,
    title: toStringValue(raw.title) ?? type.toUpperCase(),
    durationMinutes:
      typeof raw.durationMinutes === "number" && Number.isFinite(raw.durationMinutes)
        ? raw.durationMinutes
        : 20,
    questions: questionList,
  };
}

function toCompanyTest(id: string, raw: Record<string, unknown>): CompanyTest {
  const sections = Array.isArray(raw.sections)
    ? raw.sections
        .map((section) => toTestSection(section))
        .filter((section): section is TestSection => section !== null)
    : [];

  return {
    id,
    companyId: toStringValue(raw.companyId) ?? "",
    roleId: toStringValue(raw.roleId) ?? "",
    duration: typeof raw.duration === "number" && Number.isFinite(raw.duration) ? raw.duration : 75,
    sections,
  };
}

function makeDefaultStats(): CompanyPrepStats {
  return {
    attempted: 0,
    correct: 0,
    averageScore: 0,
    lastScore: 0,
    mockCompleted: 0,
    testsCompleted: 0,
  };
}

function makeDefaultProgressNode(): CompanyPrepProgressNode {
  return {
    stats: makeDefaultStats(),
    weakAreas: [],
    scores: [],
    lastUpdated: new Date().toISOString(),
    lastDifficulty: "medium",
  };
}

function parseProgressNode(raw: unknown): CompanyPrepProgressNode {
  if (typeof raw !== "object" || raw === null) {
    return makeDefaultProgressNode();
  }

  const source = raw as Record<string, unknown>;
  const statsRaw =
    typeof source.stats === "object" && source.stats !== null
      ? (source.stats as Record<string, unknown>)
      : {};

  const toNumeric = (value: unknown, fallback: number): number => {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };

  return {
    stats: {
      attempted: toNumeric(statsRaw.attempted, 0),
      correct: toNumeric(statsRaw.correct, 0),
      averageScore: toNumeric(statsRaw.averageScore, 0),
      lastScore: toNumeric(statsRaw.lastScore, 0),
      mockCompleted: toNumeric(statsRaw.mockCompleted, 0),
      testsCompleted: toNumeric(statsRaw.testsCompleted, 0),
    },
    weakAreas: toStringArray(source.weakAreas),
    scores: Array.isArray(source.scores)
      ? source.scores.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      : [],
    lastUpdated: toStringValue(source.lastUpdated) ?? new Date().toISOString(),
    lastDifficulty:
      source.lastDifficulty === "easy" || source.lastDifficulty === "medium" || source.lastDifficulty === "hard"
        ? source.lastDifficulty
        : "medium",
  };
}

function emptyUserProgress(userId: string): UserProgressDoc {
  return {
    userId,
    companyPrep: {},
    updatedAt: new Date().toISOString(),
  };
}

async function readCompaniesFromDb(): Promise<Company[]> {
  try {
    const snapshot = await db.collection("companies").limit(200).get();
    if (snapshot.empty) {
      return FALLBACK_COMPANIES;
    }

    const companies = snapshot.docs
      .map((doc) => toCompany(doc.id, doc.data() as Record<string, unknown>))
      .filter((company) => company.roles.length > 0);

    return companies.length > 0 ? companies : FALLBACK_COMPANIES;
  } catch (error) {
    console.error("[company-prep] readCompaniesFromDb failed", error);
    return FALLBACK_COMPANIES;
  }
}

async function readRolesFromDb(): Promise<Role[]> {
  try {
    const snapshot = await db.collection("roles").limit(300).get();
    if (snapshot.empty) {
      return FALLBACK_ROLES;
    }

    const roles = snapshot.docs.map((doc) => toRole(doc.id, doc.data() as Record<string, unknown>));
    return roles.length > 0 ? roles : FALLBACK_ROLES;
  } catch (error) {
    console.error("[company-prep] readRolesFromDb failed", error);
    return FALLBACK_ROLES;
  }
}

async function readUserProgress(userId: string): Promise<UserProgressDoc> {
  return getOrSetCachedValue(`company-prep:progress:${userId}`, CACHE_TTL.PROGRESS, async () => {
    try {
      const progressDoc = await db.collection("user_progress").doc(userId).get();

      if (!progressDoc.exists) {
        return emptyUserProgress(userId);
      }

      const data = progressDoc.data() as Record<string, unknown>;
      const companyPrepRaw =
        typeof data.companyPrep === "object" && data.companyPrep !== null
          ? (data.companyPrep as Record<string, unknown>)
          : {};

      const companyPrep = Object.fromEntries(
        Object.entries(companyPrepRaw).map(([companyId, roleMap]) => {
          const roleObj =
            typeof roleMap === "object" && roleMap !== null
              ? (roleMap as Record<string, unknown>)
              : {};

          const parsedRoles = Object.fromEntries(
            Object.entries(roleObj).map(([roleId, node]) => [roleId, parseProgressNode(node)])
          );

          return [companyId, parsedRoles];
        })
      ) as Record<string, Record<string, CompanyPrepProgressNode>>;

      return {
        userId,
        companyPrep,
        updatedAt: toStringValue(data.updatedAt) ?? new Date().toISOString(),
      };
    } catch (error) {
      console.error("[company-prep] readUserProgress failed", error);
      return emptyUserProgress(userId);
    }
  });
}

async function writeUserProgress(userId: string, progress: UserProgressDoc): Promise<void> {
  await db.collection("user_progress").doc(userId).set(
    {
      ...progress,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  invalidateCacheByPrefix(`company-prep:progress:${userId}`);
}

function getProgressNode(
  progress: UserProgressDoc,
  companyId: string,
  roleId: string
): CompanyPrepProgressNode {
  const existing = progress.companyPrep[companyId]?.[roleId];
  return existing ? parseProgressNode(existing) : makeDefaultProgressNode();
}

async function readQuestionBank(input: {
  companyId: string;
  roleId: string;
  difficulty?: Difficulty;
}): Promise<CompanyQuestion[]> {
  const { companyId, roleId, difficulty } = input;
  const cacheKey = `company-prep:questions:${companyId}:${roleId}:${difficulty ?? "all"}`;

  return getOrSetCachedValue(cacheKey, CACHE_TTL.QUESTIONS, async () => {
    try {
      const baseQuery = db
        .collection("questions")
        .where("companyId", "==", companyId)
        .where("roleId", "==", roleId);

      let docs;

      if (difficulty) {
        try {
          docs = await baseQuery.where("difficulty", "==", difficulty).limit(180).get();
        } catch {
          docs = await baseQuery.limit(180).get();
        }
      } else {
        docs = await baseQuery.limit(180).get();
      }

      const fromDb = docs.docs
        .map((doc) => toQuestion(doc.id, doc.data() as Record<string, unknown>))
        .filter((question) => question.question && question.answer);

      if (fromDb.length > 0) {
        return fromDb;
      }
    } catch (error) {
      console.error("[company-prep] readQuestionBank failed", error);
    }

    return FALLBACK_QUESTIONS.filter(
      (question) =>
        question.companyId === companyId &&
        question.roleId === roleId &&
        (!difficulty || question.difficulty === difficulty)
    );
  });
}

async function readMockConfig(companyId: string, roleId: string): Promise<MockInterview> {
  const cacheKey = `company-prep:mock:${companyId}:${roleId}`;

  return getOrSetCachedValue(cacheKey, CACHE_TTL.MOCK, async () => {
    try {
      const snapshot = await db
        .collection("mock_interviews")
        .where("companyId", "==", companyId)
        .where("roleId", "==", roleId)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const parsed = toMockInterview(doc.id, doc.data() as Record<string, unknown>);
        if (parsed.questions.length > 0) {
          return parsed;
        }
      }
    } catch (error) {
      console.error("[company-prep] readMockConfig failed", error);
    }

    return (
      FALLBACK_MOCK_INTERVIEWS.find(
        (mock) => mock.companyId === companyId && mock.roleId === roleId
      ) ?? FALLBACK_MOCK_INTERVIEWS.find((mock) => mock.id === "mock-default")!
    );
  });
}

async function readTestConfig(companyId: string, roleId: string): Promise<CompanyTest> {
  const cacheKey = `company-prep:test:${companyId}:${roleId}`;

  return getOrSetCachedValue(cacheKey, CACHE_TTL.TEST, async () => {
    try {
      const snapshot = await db
        .collection("tests")
        .where("companyId", "==", companyId)
        .where("roleId", "==", roleId)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return toCompanyTest(doc.id, doc.data() as Record<string, unknown>);
      }
    } catch (error) {
      console.error("[company-prep] readTestConfig failed", error);
    }

    const fallback = FALLBACK_TESTS.find(
      (test) => test.companyId === companyId && test.roleId === roleId
    );

    return fallback ?? FALLBACK_TESTS[0];
  });
}

async function getResumeDrivenSuggestions(userId?: string): Promise<{
  companyIds: string[];
  roleIds: string[];
  reason?: string;
}> {
  if (!userId) {
    return { companyIds: [], roleIds: [] };
  }

  return getOrSetCachedValue(`company-prep:suggestions:${userId}`, CACHE_TTL.SUGGESTIONS, async () => {
    const inferFromTokens = (profileTokens: string[]) => {
      const roleIds: string[] = [];
      if (profileTokens.some((token) => ["react", "next.js", "frontend", "css", "typescript"].includes(token))) {
        roleIds.push("frontend");
      }
      if (profileTokens.some((token) => ["api", "node", "java", "spring", "system design", "system-design", "dbms"].includes(token))) {
        roleIds.push("backend");
      }
      if (profileTokens.some((token) => ["sql", "statistics", "pandas", "analytics", "tableau"].includes(token))) {
        roleIds.push("data-analyst");
      }
      if (profileTokens.some((token) => ["dsa", "algorithms", "cn", "os", "oops"].includes(token))) {
        roleIds.push("sde");
      }

      const companyIds: string[] = [];
      if (
        profileTokens.some((token) => ["distributed systems", "distributed-systems", "kubernetes", "scalability", "system design", "system-design"].includes(token))
      ) {
        companyIds.push("google", "amazon", "microsoft");
      }
      if (profileTokens.some((token) => ["java", "sql", "communication", "oops"].includes(token))) {
        companyIds.push("tcs", "infosys");
      }

      return {
        companyIds: uniqueNormalized(companyIds),
        roleIds: uniqueNormalized(roleIds),
      };
    };

    try {
      const userAnalysisDoc = await db.collection("user_analysis").doc(userId).get();
      if (userAnalysisDoc.exists) {
        const data = userAnalysisDoc.data() as Record<string, unknown>;
        const intelligence =
          typeof data.intelligence === "object" && data.intelligence !== null
            ? (data.intelligence as Record<string, unknown>)
            : {};

        const skillsRaw = Array.isArray(intelligence.skills) ? intelligence.skills : [];
        const weaknessRaw = Array.isArray(intelligence.weaknesses) ? intelligence.weaknesses : [];
        const missingRaw = Array.isArray(intelligence.missingKeySkills) ? intelligence.missingKeySkills : [];

        const tokenSource = [
          ...skillsRaw
            .map((item) => {
              if (typeof item === "object" && item !== null && typeof (item as Record<string, unknown>).name === "string") {
                return (item as Record<string, unknown>).name as string;
              }
              return "";
            })
            .filter(Boolean),
          ...weaknessRaw
            .map((item) => {
              if (typeof item === "object" && item !== null && typeof (item as Record<string, unknown>).topic === "string") {
                return (item as Record<string, unknown>).topic as string;
              }
              return "";
            })
            .filter(Boolean),
          ...missingRaw.filter((item): item is string => typeof item === "string"),
        ];

        const profileTokens = uniqueNormalized(tokenSource);
        if (profileTokens.length > 0) {
          const inferred = inferFromTokens(profileTokens);
          return {
            ...inferred,
            reason:
              inferred.roleIds.length > 0 || inferred.companyIds.length > 0
                ? "Suggestions are inferred from your latest resume intelligence analysis."
                : undefined,
          };
        }
      }

      const snapshot = await db.collection("resumeAnalyses").where("userId", "==", userId).limit(5).get();
      if (snapshot.empty) {
        return { companyIds: [], roleIds: [] };
      }

      const latestDoc = snapshot.docs
        .map((doc) => {
          const data = doc.data() as Record<string, unknown>;
          return {
            createdAt: toStringValue(data.createdAt) ?? "",
            detectedSkills: toStringArray(data.detectedSkills),
            detectedFrameworks: toStringArray(data.detectedFrameworks),
            detectedLanguages: toStringArray(data.detectedLanguages),
            detectedTools: toStringArray(data.detectedTools),
            detectedSubjects: toStringArray(data.detectedSubjects),
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

      if (!latestDoc) {
        return { companyIds: [], roleIds: [] };
      }

      const profileTokens = uniqueNormalized([
        ...latestDoc.detectedSkills,
        ...latestDoc.detectedFrameworks,
        ...latestDoc.detectedLanguages,
        ...latestDoc.detectedTools,
        ...latestDoc.detectedSubjects,
      ]);

      const inferred = inferFromTokens(profileTokens);

      return {
        ...inferred,
        reason:
          inferred.roleIds.length > 0 || inferred.companyIds.length > 0
            ? "Suggestions are inferred from your latest resume analysis."
            : undefined,
      };
    } catch (error) {
      console.error("[company-prep] getResumeDrivenSuggestions failed", error);
      return { companyIds: [], roleIds: [] };
    }
  });
}

function filterBySearch<T extends { name: string }>(items: T[], search?: string): T[] {
  if (!search?.trim()) {
    return items;
  }

  const needle = search.trim().toLowerCase();
  return items.filter((item) => item.name.toLowerCase().includes(needle));
}

function matchDifficulty(question: CompanyQuestion, difficulty?: Difficulty): boolean {
  return !difficulty || question.difficulty === difficulty;
}

function buildAdaptiveForSelection(input: {
  userProgress: UserProgressDoc;
  company: Company | undefined;
  companyId: string;
  roleId: string;
}): AdaptiveContext {
  const { userProgress, companyId, roleId, company } = input;
  const progressNode = getProgressNode(userProgress, companyId, roleId);

  return createAdaptiveContext({
    progress: progressNode,
    company,
  });
}

function applyMistakePriorityToQuestions(input: {
  questions: CompanyQuestion[];
  mistakeContext: MistakePriorityContext | null;
  threshold?: number;
}): CompanyQuestion[] {
  const { questions, mistakeContext } = input;
  const threshold = input.threshold ?? MISTAKE_PRIORITY_THRESHOLD;

  if (!mistakeContext?.topSignal || mistakeContext.topSignal.priorityScore < threshold) {
    return questions;
  }

  const annotated = annotateCandidatesWithMistakePriority({
    context: mistakeContext,
    candidates: questions.map((question) => ({
      tags: question.tags,
      topic: question.tags[0],
      text: question.question,
    })),
    threshold,
  });

  const rows = questions.map((question, index) => ({
    question,
    index,
    metadata: annotated[index]?.metadata,
  }));

  const hasTargetedQuestion = rows.some((row) => row.metadata?.targetedWeakArea);
  if (!hasTargetedQuestion) {
    return questions;
  }

  return rows
    .sort((left, right) => {
      const leftTargeted = left.metadata?.targetedWeakArea ? 1 : 0;
      const rightTargeted = right.metadata?.targetedWeakArea ? 1 : 0;
      if (leftTargeted !== rightTargeted) {
        return rightTargeted - leftTargeted;
      }

      const leftScore = left.metadata?.priorityScore ?? 0;
      const rightScore = right.metadata?.priorityScore ?? 0;
      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return left.index - right.index;
    })
    .map((row) => {
      if (!row.metadata?.targetedWeakArea) {
        return row.question;
      }

      return {
        ...row.question,
        mistakePriority: row.metadata,
      };
    });
}

function selectQuestionsForSection(input: {
  pool: CompanyQuestion[];
  adaptive: AdaptiveContext;
  mistakeContext: MistakePriorityContext | null;
  sectionType: TestSection["type"];
  limit: number;
}): CompanyQuestion[] {
  const { pool, adaptive, sectionType, limit, mistakeContext } = input;

  const sectionFilter = (question: CompanyQuestion): boolean => {
    if (sectionType === "coding") {
      return question.type === "coding";
    }

    if (sectionType === "aptitude") {
      return (
        question.type === "mcq" ||
        question.tags.some((tag) => ["aptitude", "reasoning", "probability", "quant"].includes(normalizeTag(tag)))
      );
    }

    return question.type === "theory" || question.type === "mcq";
  };

  const filtered = pool.filter(sectionFilter);
  if (filtered.length === 0) {
    const ranked = rankQuestionsByAdaptation({ questions: pool, adaptive });
    return applyMistakePriorityToQuestions({
      questions: ranked,
      mistakeContext,
    }).slice(0, limit);
  }

  const ranked = rankQuestionsByAdaptation({ questions: filtered, adaptive });
  return applyMistakePriorityToQuestions({
    questions: ranked,
    mistakeContext,
  }).slice(0, limit);
}

export async function listCompanies(params: {
  search?: string;
  userId?: string;
}): Promise<CompanyListResponse> {
  const [companies, suggestions] = await Promise.all([
    getOrSetCachedValue("company-prep:companies", CACHE_TTL.COMPANIES, readCompaniesFromDb),
    getResumeDrivenSuggestions(params.userId),
  ]);

  return {
    companies: filterBySearch(companies, params.search),
    suggestions,
  };
}

export async function listRoles(params: {
  companyId: string;
  search?: string;
}): Promise<CompanyRolesResponse> {
  const [companies, roles] = await Promise.all([
    getOrSetCachedValue("company-prep:companies", CACHE_TTL.COMPANIES, readCompaniesFromDb),
    getOrSetCachedValue("company-prep:roles", CACHE_TTL.ROLES, readRolesFromDb),
  ]);

  const company = companies.find((item) => item.id === params.companyId);
  const fallbackRoleIds = FALLBACK_COMPANIES.find((item) => item.id === params.companyId)?.roles ?? [];
  const roleIds = company?.roles.length ? company.roles : fallbackRoleIds;

  const mappedRoles = roles.filter((role) => roleIds.includes(role.id));

  return {
    companyId: params.companyId,
    roles: filterBySearch(mappedRoles, params.search),
  };
}

export async function listQuestions(params: {
  companyId: string;
  roleId: string;
  userId?: string;
  difficulty?: Difficulty;
  type?: CompanyQuestion["type"];
  limit?: number;
}): Promise<CompanyQuestionsResponse> {
  const [companies, progress, mistakeContext] = await Promise.all([
    getOrSetCachedValue("company-prep:companies", CACHE_TTL.COMPANIES, readCompaniesFromDb),
    params.userId ? readUserProgress(params.userId) : Promise.resolve(emptyUserProgress("guest")),
    params.userId
      ? getMistakePriorityContext({
          userId: params.userId,
          sessionKey: `company-prep:questions:${params.userId}:${params.companyId}:${params.roleId}`,
        })
      : Promise.resolve(null),
  ]);

  const company = companies.find((item) => item.id === params.companyId);
  const progressNode = getProgressNode(progress, params.companyId, params.roleId);
  const adaptive = buildAdaptiveForSelection({
    userProgress: progress,
    company,
    companyId: params.companyId,
    roleId: params.roleId,
  });

  const targetDifficulty = params.difficulty ?? adaptive.recommendedDifficulty;

  const rawQuestions = await readQuestionBank({
    companyId: params.companyId,
    roleId: params.roleId,
  });

  const filteredQuestions = rawQuestions.filter((question) => {
    const typeMatch = !params.type || question.type === params.type;
    return typeMatch && matchDifficulty(question, targetDifficulty);
  });

  const fallbackIfEmpty = filteredQuestions.length > 0 ? filteredQuestions : rawQuestions;
  const ranked = rankQuestionsByAdaptation({ questions: fallbackIfEmpty, adaptive });
  const rankedWithMistakes = applyMistakePriorityToQuestions({
    questions: ranked,
    mistakeContext,
  });

  const limit = params.limit ?? 12;

  return {
    companyId: params.companyId,
    roleId: params.roleId,
    adaptive,
    progress: progressNode,
    questions: rankedWithMistakes.slice(0, limit),
  };
}

export async function getMockInterview(params: {
  companyId: string;
  roleId: string;
  userId?: string;
}): Promise<CompanyMockResponse> {
  const [companies, progress, mockConfig, topQuestions] = await Promise.all([
    getOrSetCachedValue("company-prep:companies", CACHE_TTL.COMPANIES, readCompaniesFromDb),
    params.userId ? readUserProgress(params.userId) : Promise.resolve(emptyUserProgress("guest")),
    readMockConfig(params.companyId, params.roleId),
    listQuestions({
      companyId: params.companyId,
      roleId: params.roleId,
      userId: params.userId,
      limit: 6,
    }),
  ]);

  const company = companies.find((item) => item.id === params.companyId);
  const progressNode = getProgressNode(progress, params.companyId, params.roleId);
  const adaptive = buildAdaptiveForSelection({
    userProgress: progress,
    company,
    companyId: params.companyId,
    roleId: params.roleId,
  });

  const dedupe = new Set<string>();
  const enrichedQuestionSet = [...topQuestions.questions.map((question) => question.question), ...mockConfig.questions]
    .map((value) => value.trim())
    .filter((value) => {
      const normalized = normalizeTag(value);
      if (!normalized || dedupe.has(normalized)) {
        return false;
      }
      dedupe.add(normalized);
      return true;
    });

  return {
    companyId: params.companyId,
    roleId: params.roleId,
    adaptive,
    progress: progressNode,
    mock: {
      ...mockConfig,
      questions: enrichedQuestionSet.slice(0, 8),
    },
  };
}

export async function createInterviewFromMock(params: {
  companyId: string;
  roleId: string;
  userId: string;
}): Promise<{ interviewId: string; questions: string[] }> {
  const [mock, companies, roles, progress] = await Promise.all([
    getMockInterview(params),
    getOrSetCachedValue("company-prep:companies", CACHE_TTL.COMPANIES, readCompaniesFromDb),
    getOrSetCachedValue("company-prep:roles", CACHE_TTL.ROLES, readRolesFromDb),
    readUserProgress(params.userId),
  ]);

  const company = companies.find((item) => item.id === params.companyId);
  const role = roles.find((item) => item.id === params.roleId);

  const interviewRef = await db.collection("interviews").add({
    role: `${company?.name ?? "Company"} ${role?.name ?? "Role"}`,
    type: "company-mock",
    level: deriveRecommendedDifficulty(getProgressNode(progress, params.companyId, params.roleId)),
    techstack: role?.skills ?? [],
    questions: mock.mock.questions,
    userId: params.userId,
    finalized: true,
    createdAt: new Date().toISOString(),
  });

  const existingNode = getProgressNode(progress, params.companyId, params.roleId);
  const nextNode: CompanyPrepProgressNode = {
    ...existingNode,
    stats: {
      ...existingNode.stats,
      mockCompleted: existingNode.stats.mockCompleted + 1,
    },
    lastUpdated: new Date().toISOString(),
  };

  const nextProgress: UserProgressDoc = {
    ...progress,
    companyPrep: {
      ...progress.companyPrep,
      [params.companyId]: {
        ...(progress.companyPrep[params.companyId] ?? {}),
        [params.roleId]: nextNode,
      },
    },
    updatedAt: new Date().toISOString(),
  };

  await writeUserProgress(params.userId, nextProgress);

  return {
    interviewId: interviewRef.id,
    questions: mock.mock.questions,
  };
}

export async function getCompanyTest(params: {
  companyId: string;
  roleId: string;
  userId?: string;
}): Promise<CompanyTestResponse> {
  const [companies, progress, testConfig, allQuestions, mistakeContext] = await Promise.all([
    getOrSetCachedValue("company-prep:companies", CACHE_TTL.COMPANIES, readCompaniesFromDb),
    params.userId ? readUserProgress(params.userId) : Promise.resolve(emptyUserProgress("guest")),
    readTestConfig(params.companyId, params.roleId),
    readQuestionBank({ companyId: params.companyId, roleId: params.roleId }),
    params.userId
      ? getMistakePriorityContext({
          userId: params.userId,
          sessionKey: `company-prep:test:${params.userId}:${params.companyId}:${params.roleId}`,
        })
      : Promise.resolve(null),
  ]);

  const company = companies.find((item) => item.id === params.companyId);
  const progressNode = getProgressNode(progress, params.companyId, params.roleId);
  const adaptive = buildAdaptiveForSelection({
    userProgress: progress,
    company,
    companyId: params.companyId,
    roleId: params.roleId,
  });

  const sections = testConfig.sections.map((section) => ({
    ...section,
    questions:
      section.questions.length > 0
        ? applyMistakePriorityToQuestions({
            questions: section.questions,
            mistakeContext,
          })
        : selectQuestionsForSection({
            pool: allQuestions,
            adaptive,
            mistakeContext,
            sectionType: section.type,
            limit: 5,
          }),
  }));

  return {
    companyId: params.companyId,
    roleId: params.roleId,
    adaptive,
    progress: progressNode,
    test: {
      ...testConfig,
      sections,
    },
  };
}

export async function submitTest(input: TestSubmissionInput): Promise<TestSubmissionResult> {
  const { userId, companyId, roleId, answers } = input;

  const [testData, progress] = await Promise.all([
    getCompanyTest({ companyId, roleId, userId }),
    readUserProgress(userId),
  ]);

  const allQuestions = testData.test.sections.flatMap((section) => section.questions);
  const answerEntries = Object.entries(answers);

  const byId = new Map(allQuestions.map((question) => [question.id, question]));
  let correctAnswers = 0;
  const weakTags: string[] = [];

  for (const [questionId, submitted] of answerEntries) {
    const question = byId.get(questionId);
    if (!question) {
      continue;
    }

    const expected = normalizeTag(question.answer);
    const submittedValue = normalizeTag(String(submitted));

    if (submittedValue && submittedValue === expected) {
      correctAnswers += 1;
    } else {
      weakTags.push(...question.tags.map(normalizeTag));
    }
  }

  const totalQuestions = allQuestions.length;
  const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  const weakAreas = uniqueNormalized(weakTags).slice(0, 8);
  const node = getProgressNode(progress, companyId, roleId);
  const nextScores = [...node.scores, score].slice(-20);
  const averageScore =
    nextScores.length > 0
      ? Math.round(nextScores.reduce((sum, value) => sum + value, 0) / nextScores.length)
      : 0;

  const updatedNode: CompanyPrepProgressNode = {
    ...node,
    stats: {
      attempted: node.stats.attempted + totalQuestions,
      correct: node.stats.correct + correctAnswers,
      averageScore,
      lastScore: score,
      mockCompleted: node.stats.mockCompleted,
      testsCompleted: node.stats.testsCompleted + 1,
    },
    weakAreas: uniqueNormalized([...weakAreas, ...node.weakAreas]).slice(0, 10),
    scores: nextScores,
    lastDifficulty: deriveRecommendedDifficulty({
      ...node,
      stats: {
        ...node.stats,
        averageScore,
      },
      scores: nextScores,
    }),
    lastUpdated: new Date().toISOString(),
  };

  const nextProgress: UserProgressDoc = {
    ...progress,
    companyPrep: {
      ...progress.companyPrep,
      [companyId]: {
        ...(progress.companyPrep[companyId] ?? {}),
        [roleId]: updatedNode,
      },
    },
    updatedAt: new Date().toISOString(),
  };

  await writeUserProgress(userId, nextProgress);

  return {
    score,
    totalQuestions,
    correctAnswers,
    weakAreas,
    updatedProgress: updatedNode,
  };
}

export async function getCompanyPrepProgress(params: {
  userId: string;
  companyId: string;
  roleId: string;
}): Promise<CompanyPrepProgressNode> {
  const progress = await readUserProgress(params.userId);
  return getProgressNode(progress, params.companyId, params.roleId);
}
