import { z } from "zod";

import { db } from "@/firebase/admin";
import { callGeminiAPI, parseGeminiJSON } from "@/lib/gemini-utils";
import type {
  AdaptiveQuestion,
  ExperienceLevel,
  QuestionGenerationMode,
  ResumeIntelligence,
} from "@/features/resume-analysis/types";
import { buildFallbackQuestions } from "@/features/resume-analysis/utils/question-fallbacks";
import {
  computeAnalysisHash,
  getWeaknessTopics,
  sanitizeRole,
} from "@/features/resume-analysis/utils/resume-intelligence";
import { getLatestUserResumeAnalysis } from "@/features/resume-analysis/services/resume-analysis.server";

const QUESTION_CACHE_TTL_MS = 1000 * 60 * 10;
const questionMemoryCache = new Map<string, { expiresAt: number; payload: GenerateAdaptiveQuestionsOutput }>();

const llmQuestionSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string().optional(),
      type: z.string(),
      topic: z.string().min(1),
      difficulty: z.string(),
      questionText: z.string().min(1),
      options: z.array(z.string().min(1)).optional(),
      answerSnippet: z.string().optional(),
      explanation: z.string().min(1),
      source: z.string().optional(),
    })
  ),
});

interface AnalysisEnvelope {
  analysisId: string;
  intelligence: ResumeIntelligence;
}

export interface GenerateAdaptiveQuestionsInput {
  userId: string;
  analysisId?: string;
  mode?: QuestionGenerationMode;
  selectedRole?: string;
  customTopics?: string[];
  count?: number;
  difficulty?: ExperienceLevel;
}

export interface GenerateAdaptiveQuestionsOutput {
  planId: string;
  cached: boolean;
  mode: QuestionGenerationMode;
  focusAreas: string[];
  questions: AdaptiveQuestion[];
  intelligence: ResumeIntelligence;
}

interface StoredQuestionCache {
  key?: string;
  generatedAt?: string;
  mode?: QuestionGenerationMode;
  focusAreas?: string[];
  questions?: AdaptiveQuestion[];
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = value.toLowerCase().trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(value.trim());
  }

  return output;
}

function resolveTopics(input: {
  intelligence: ResumeIntelligence;
  mode: QuestionGenerationMode;
  customTopics: string[];
}): string[] {
  const { intelligence, mode, customTopics } = input;

  if (mode === "custom") {
    return unique(customTopics);
  }

  if (mode === "all-skills") {
    return unique(intelligence.skills.map((skill) => skill.name));
  }

  return unique(getWeaknessTopics(intelligence));
}

function buildQuestionPrompt(input: {
  mode: QuestionGenerationMode;
  topics: string[];
  selectedRole: string;
  difficulty: ExperienceLevel;
  intelligence: ResumeIntelligence;
  count: number;
}): string {
  const sourceLabel =
    input.mode === "custom"
      ? "custom topics"
      : input.mode === "all-skills"
        ? "all extracted skills"
        : "identified weakness areas";

  return `Generate interview questions for ${input.selectedRole}.

Use ${sourceLabel} as primary context.
Topics: ${input.topics.join(", ")}
Difficulty level: ${input.difficulty}
Question count: exactly ${input.count}

Candidate signals:
- Strengths: ${input.intelligence.strengths.join(", ") || "None"}
- Weaknesses: ${input.intelligence.weaknesses.map((item) => item.topic).join(", ") || "None"}
- Recommended roles: ${input.intelligence.recommendedRoles.join(", ") || "Software Engineer"}

Return JSON ONLY. Do NOT wrap in markdown or add commentary. Format exactly like this:
{
  "questions": [
    {
      "id": "string",
      "type": "MCQ" or "Coding" or "Conceptual",
      "topic": "string",
      "difficulty": "Beginner" or "Intermediate" or "Advanced",
      "questionText": "string",
      "options": ["string", "string", "string", "string"], 
      "answerSnippet": "string",
      "explanation": "string",
      "source": "skill" or "weakness"
    }
  ]
}

Rules:
- Include a balanced mix of MCQ, Coding, and Conceptual questions.
- MCQ requires exactly 4 options. NON-MCQ questions must NOT include "options".
- Keep questions practical and interview-ready.
- Avoid duplicate questions.`;
}

async function resolveAnalysisEnvelope(input: {
  userId: string;
  analysisId?: string;
}): Promise<AnalysisEnvelope | null> {
  if (input.analysisId) {
    const analysisDoc = await db.collection("resumeAnalyses").doc(input.analysisId).get();
    if (analysisDoc.exists) {
      const data = analysisDoc.data() as Record<string, unknown>;
      const intelligence = data.intelligence as ResumeIntelligence | undefined;
      if (intelligence && Array.isArray(intelligence.skills) && Array.isArray(intelligence.weaknesses)) {
        return {
          analysisId: analysisDoc.id,
          intelligence,
        };
      }
    }
  }

  const latest = await getLatestUserResumeAnalysis(input.userId);
  if (!latest) {
    return null;
  }

  return {
    analysisId: latest.analysisId,
    intelligence: latest.intelligence,
  };
}

function sanitizeQuestions(input: {
  parsed: z.infer<typeof llmQuestionSchema>;
  mode: QuestionGenerationMode;
  count: number;
}): AdaptiveQuestion[] {
  const sourceValue = input.mode === "custom" ? "custom" : input.mode === "all-skills" ? "skill" : "weakness";

  return input.parsed.questions.slice(0, input.count).map((question, index) => {
    const rawType = question.type || "Conceptual";
    const typeStr = rawType.toUpperCase().includes("MCQ") ? "MCQ" : rawType.toLowerCase().includes("cod") ? "Coding" : "Conceptual";
    const normalizedOptions = typeStr === "MCQ" ? (question.options?.slice(0, 4) ?? []) : undefined;
    
    // Normalize difficulty 
    const rawDiff = (question.difficulty || "Intermediate").toLowerCase();
    const diffMap = rawDiff.includes("beg") ? "Beginner" : rawDiff.includes("adv") ? "Advanced" : "Intermediate";

    const sanitized: AdaptiveQuestion = {
      id: question.id?.trim() || `q-${index + 1}`,
      type: typeStr as any,
      topic: question.topic.trim(),
      difficulty: diffMap as any,
      questionText: question.questionText.trim(),
      explanation: question.explanation.trim(),
      source: question.source as any ?? sourceValue,
    };

    if (normalizedOptions && normalizedOptions.length >= 2) {
      sanitized.options = normalizedOptions;
    }

    const answerSnippet = question.answerSnippet?.trim();
    if (answerSnippet) {
      sanitized.answerSnippet = answerSnippet;
    }

    return sanitized;
  });
}

function readMemoryCache(key: string): GenerateAdaptiveQuestionsOutput | null {
  const cached = questionMemoryCache.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    questionMemoryCache.delete(key);
    return null;
  }

  return cached.payload;
}

function writeMemoryCache(key: string, payload: GenerateAdaptiveQuestionsOutput): void {
  questionMemoryCache.set(key, {
    expiresAt: Date.now() + QUESTION_CACHE_TTL_MS,
    payload,
  });
}

async function readPersistentCache(input: {
  userId: string;
  key: string;
}): Promise<GenerateAdaptiveQuestionsOutput | null> {
  const userDoc = await db.collection("user_analysis").doc(input.userId).get();
  if (!userDoc.exists) {
    return null;
  }

  const data = userDoc.data() as Record<string, unknown>;
  const cache = (data.questionCache as StoredQuestionCache | undefined) ?? {};

  if (cache.key !== input.key || !cache.generatedAt || !Array.isArray(cache.questions)) {
    return null;
  }

  const generatedAtMs = Date.parse(cache.generatedAt);
  if (!Number.isFinite(generatedAtMs) || Date.now() - generatedAtMs > QUESTION_CACHE_TTL_MS) {
    return null;
  }

  const mode = cache.mode ?? "weak-areas";
  const questions = cache.questions;
  const focusAreas = cache.focusAreas ?? [];

  const envelope = await resolveAnalysisEnvelope({ userId: input.userId });
  if (!envelope) {
    return null;
  }

  return {
    planId: `cached-${input.key}`,
    cached: true,
    mode,
    focusAreas,
    questions,
    intelligence: envelope.intelligence,
  };
}

function toLegacyDifficulty(level: ExperienceLevel): "Easy" | "Medium" | "Hard" {
  if (level === "Advanced") {
    return "Hard";
  }

  if (level === "Intermediate") {
    return "Medium";
  }

  return "Easy";
}

export function toLegacyInterviewPlan(input: {
  questions: AdaptiveQuestion[];
  intelligence: ResumeIntelligence;
  focusAreas: string[];
}): {
  questions: Array<{
    type: string;
    skill?: string;
    project?: string;
    subject?: string;
    question: string;
    followUp: string[];
    expectedAnswer: string;
    difficultyLevel: "Easy" | "Medium" | "Hard";
    tags: string[];
  }>;
  redFlags: string[];
  strengthAreas: string[];
  focusAreas: string[];
  estimatedPreparationTime: string;
  priorityTopics: string[];
} {
  const legacyQuestions = input.questions.map((question) => ({
    type: question.type === "Coding" ? "DEPTH_TESTING" : question.type === "MCQ" ? "CONCEPT_CLARITY" : "SKILL_VERIFICATION",
    skill: question.source === "skill" ? question.topic : undefined,
    subject: question.topic,
    question: question.questionText,
    followUp: [`What is a real interview edge-case for ${question.topic}?`],
    expectedAnswer: question.answerSnippet ?? question.explanation,
    difficultyLevel: toLegacyDifficulty(question.difficulty),
    tags: [question.topic, question.type, question.source],
  }));

  const redFlags = input.intelligence.weaknesses.map((weakness) => weakness.reason);
  const priorityTopics = input.focusAreas.slice(0, 8);

  return {
    questions: legacyQuestions,
    redFlags,
    strengthAreas: input.intelligence.strengths,
    focusAreas: input.focusAreas,
    estimatedPreparationTime: `${Math.max(2, Math.ceil(legacyQuestions.length / 3))} days`,
    priorityTopics,
  };
}

export async function generateAdaptiveQuestions(
  input: GenerateAdaptiveQuestionsInput
): Promise<GenerateAdaptiveQuestionsOutput> {
  const mode = input.mode ?? "weak-areas";
  const count = Math.max(3, Math.min(input.count ?? 9, 18));
  const selectedRole = sanitizeRole(input.selectedRole);

  const envelope = await resolveAnalysisEnvelope({
    userId: input.userId,
    analysisId: input.analysisId,
  });

  if (!envelope) {
    throw new Error("No resume analysis found. Please analyze resume first.");
  }

  const difficulty = input.difficulty ?? envelope.intelligence.experienceLevel;
  const customTopics = (input.customTopics ?? []).map((topic) => topic.trim()).filter(Boolean);
  const focusAreas = resolveTopics({
    intelligence: envelope.intelligence,
    mode,
    customTopics,
  }).slice(0, Math.max(3, count));

  const cacheKey = computeAnalysisHash(
    JSON.stringify({
      userId: input.userId,
      analysisId: envelope.analysisId,
      mode,
      selectedRole,
      difficulty,
      focusAreas,
      count,
    })
  );

  const cachedInMemory = readMemoryCache(cacheKey);
  if (cachedInMemory) {
    return {
      ...cachedInMemory,
      cached: true,
    };
  }

  const cachedPersistent = await readPersistentCache({
    userId: input.userId,
    key: cacheKey,
  });

  if (cachedPersistent) {
    writeMemoryCache(cacheKey, cachedPersistent);
    return cachedPersistent;
  }

  let questions: AdaptiveQuestion[] = [];

  const prompt = buildQuestionPrompt({
    mode,
    topics: focusAreas,
    selectedRole,
    difficulty,
    intelligence: envelope.intelligence,
    count,
  });

  const llmResponse = await callGeminiAPI({
    prompt,
    temperature: 0.45,
    maxOutputTokens: 4096,
    topP: 0.9,
    model: "llama-3.3-70b-versatile",
  });

  if (llmResponse.success) {
    const parsed = parseGeminiJSON<unknown>(llmResponse.text);
    const validated = llmQuestionSchema.safeParse(parsed);
    if (validated.success) {
      questions = sanitizeQuestions({
        parsed: validated.data,
        mode,
        count,
      });
    }
  }

  if (questions.length === 0) {
    questions = buildFallbackQuestions({
      topics: focusAreas,
      difficulty,
      mode,
      count,
    });
  }

  const nowIso = new Date().toISOString();
  const planRef = db.collection("interviewPrepPlans").doc();

  await Promise.all([
    planRef.set({
      userId: input.userId,
      resumeAnalysisId: envelope.analysisId,
      mode,
      selectedRole,
      focusAreas,
      questions,
      createdAt: nowIso,
      updatedAt: nowIso,
      planVersion: 2,
    }),
    db
      .collection("user_analysis")
      .doc(input.userId)
      .set(
        {
          questionCache: {
            key: cacheKey,
            generatedAt: nowIso,
            mode,
            focusAreas,
            questions,
          },
          lastUpdated: nowIso,
        },
        { merge: true }
      ),
  ]);

  const result: GenerateAdaptiveQuestionsOutput = {
    planId: planRef.id,
    cached: false,
    mode,
    focusAreas,
    questions,
    intelligence: envelope.intelligence,
  };

  writeMemoryCache(cacheKey, result);
  return result;
}
