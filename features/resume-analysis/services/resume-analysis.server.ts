import { z } from "zod";

import { db } from "@/firebase/admin";
import { callGeminiAPI, parseGeminiJSON } from "@/lib/gemini-utils";
import type { LegacyResumeAnalysis, ResumeIntelligence } from "@/features/resume-analysis/types";
import {
  buildResumeIntelligence,
  computeAnalysisHash,
  getWeaknessTopics,
  sanitizeRole,
  toLegacyResumeAnalysis,
  type LLMResumeExtraction,
} from "@/features/resume-analysis/utils/resume-intelligence";

const USER_ANALYSIS_COLLECTION = "user_analysis";
const RESUME_ANALYSIS_COLLECTION = "resumeAnalyses";

const llmResumeSchema = z.object({
  skills: z
    .array(
      z.object({
        name: z.string().min(1),
        category: z.string().optional(),
        confidence: z.enum(["High", "Moderate", "Low"]).optional(),
        evidence: z.array(z.string().min(1)).optional(),
      })
    )
    .optional(),
  strengths: z.array(z.string().min(1)).optional(),
  projects: z
    .array(
      z.object({
        name: z.string().min(1).optional(),
        technologies: z.array(z.string().min(1)).optional(),
        description: z.string().min(1).optional(),
        quality: z.enum(["strong", "moderate", "weak"]).optional(),
        signals: z.array(z.string().min(1)).optional(),
      })
    )
    .optional(),
  experienceLevel: z.enum(["Beginner", "Intermediate", "Advanced"]).optional(),
  yearsOfExperience: z.number().nullable().optional(),
  recommendedRoles: z.array(z.string().min(1)).optional(),
  education: z.array(z.string().min(1)).optional(),
  certifications: z.array(z.string().min(1)).optional(),
});

const storedUserAnalysisSchema = z.object({
  latestAnalysisId: z.string().optional(),
  resumeHash: z.string().optional(),
  intelligence: z.any().optional(),
  legacy: z.any().optional(),
  yearsOfExperience: z.number().optional(),
  education: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
});

export interface AnalyzeResumeInput {
  userId: string;
  resumeText: string;
  selectedRole?: string;
  forceRefresh?: boolean;
}

export interface AnalyzeResumeOutput {
  analysisId: string;
  resumeHash: string;
  cached: boolean;
  intelligence: ResumeIntelligence;
  legacy: LegacyResumeAnalysis;
}

export interface LatestUserAnalysis {
  analysisId: string;
  intelligence: ResumeIntelligence;
  legacy: LegacyResumeAnalysis;
}

function buildExtractionPrompt(resumeText: string, selectedRole: string): string {
  return `You are a resume intelligence engine.
Extract structured technical insights for interview preparation.
Target role: ${selectedRole}

Resume Text:
${resumeText}

Return JSON only with this exact shape:
{
  "skills": [{ "name": "string", "category": "string", "confidence": "High|Moderate|Low", "evidence": ["string"] }],
  "strengths": ["string"],
  "projects": [{ "name": "string", "technologies": ["string"], "description": "string", "quality": "strong|moderate|weak", "signals": ["string"] }],
  "experienceLevel": "Beginner|Intermediate|Advanced",
  "yearsOfExperience": 0,
  "recommendedRoles": ["string"],
  "education": ["string"],
  "certifications": ["string"]
}

Rules:
- Prioritize DSA, OS, DBMS, CN, project depth, and tech stack credibility.
- Do not include markdown.
- Keep confidence low if evidence is weak.
- Prefer concise evidence snippets over generic claims.`;
}

async function runResumeExtractionLLM(input: {
  resumeText: string;
  selectedRole: string;
}): Promise<LLMResumeExtraction | undefined> {
  const prompt = buildExtractionPrompt(input.resumeText, input.selectedRole);

  const llmResponse = await callGeminiAPI({
    prompt,
    temperature: 0.25,
    maxOutputTokens: 4096,
    topP: 0.9,
    model: "llama-3.3-70b-versatile",
  });

  if (!llmResponse.success) {
    console.error("[resume-analysis] LLM extraction failed", llmResponse.error);
    return undefined;
  }

  const parsed = parseGeminiJSON<unknown>(llmResponse.text);
  const validated = llmResumeSchema.safeParse(parsed);

  if (!validated.success) {
    console.error("[resume-analysis] LLM extraction parse failed", validated.error.flatten());
    return undefined;
  }

  return validated.data;
}

function reviveStoredAnalysis(input: {
  analysisId: string;
  rawIntelligence: unknown;
  rawLegacy: unknown;
  yearsOfExperience: number;
  education: string[];
  certifications: string[];
}): LatestUserAnalysis | null {
  const intelligence = input.rawIntelligence as ResumeIntelligence | undefined;
  if (!intelligence || !Array.isArray(intelligence.skills) || !Array.isArray(intelligence.weaknesses)) {
    return null;
  }

  const legacyCandidate = input.rawLegacy as LegacyResumeAnalysis | undefined;
  const legacy =
    legacyCandidate && Array.isArray(legacyCandidate.detectedSkills)
      ? legacyCandidate
      : toLegacyResumeAnalysis({
          intelligence,
          yearsOfExperience: input.yearsOfExperience,
          education: input.education,
          certifications: input.certifications,
        });

  return {
    analysisId: input.analysisId,
    intelligence,
    legacy,
  };
}

export async function getLatestUserResumeAnalysis(userId: string): Promise<LatestUserAnalysis | null> {
  const userAnalysisDoc = await db.collection(USER_ANALYSIS_COLLECTION).doc(userId).get();

  if (userAnalysisDoc.exists) {
    const parsed = storedUserAnalysisSchema.safeParse(userAnalysisDoc.data());

    if (parsed.success) {
      const revived = reviveStoredAnalysis({
        analysisId: parsed.data.latestAnalysisId ?? `${userId}-latest`,
        rawIntelligence: parsed.data.intelligence,
        rawLegacy: parsed.data.legacy,
        yearsOfExperience: parsed.data.yearsOfExperience ?? 0,
        education: parsed.data.education ?? [],
        certifications: parsed.data.certifications ?? [],
      });

      if (revived) {
        return revived;
      }
    }
  }

  const snapshot = await db.collection(RESUME_ANALYSIS_COLLECTION).where("userId", "==", userId).limit(10).get();
  if (snapshot.empty) {
    return null;
  }

  type ResumeAnalysisCandidate = {
    id: string;
    updatedAt?: unknown;
    intelligence?: unknown;
    legacy?: unknown;
    yearsOfExperience?: unknown;
    education?: unknown;
    certifications?: unknown;
  };

  const latestDoc = snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }) as ResumeAnalysisCandidate)
    .sort((a, b) => {
      const aTime = typeof a.updatedAt === "string" ? a.updatedAt : "";
      const bTime = typeof b.updatedAt === "string" ? b.updatedAt : "";
      return bTime.localeCompare(aTime);
    })[0];

  if (!latestDoc) {
    return null;
  }

  const revived = reviveStoredAnalysis({
    analysisId: latestDoc.id,
    rawIntelligence: latestDoc.intelligence,
    rawLegacy: latestDoc.legacy,
    yearsOfExperience:
      typeof latestDoc.yearsOfExperience === "number" && Number.isFinite(latestDoc.yearsOfExperience)
        ? latestDoc.yearsOfExperience
        : 0,
    education: Array.isArray(latestDoc.education)
      ? latestDoc.education.filter((value: unknown): value is string => typeof value === "string")
      : [],
    certifications: Array.isArray(latestDoc.certifications)
      ? latestDoc.certifications.filter((value: unknown): value is string => typeof value === "string")
      : [],
  });

  return revived;
}

export function buildInterviewContextFromResume(intelligence: ResumeIntelligence): string {
  const topWeakTopics = getWeaknessTopics(intelligence).slice(0, 4);
  const topStrengths = intelligence.strengths.slice(0, 3);

  if (topWeakTopics.length === 0 && topStrengths.length === 0) {
    return "";
  }

  const weakSection = topWeakTopics.length > 0 ? `Weakness focus topics: ${topWeakTopics.join(", ")}.` : "";
  const strengthSection = topStrengths.length > 0 ? `Strength areas: ${topStrengths.join(", ")}.` : "";

  return [weakSection, strengthSection].filter(Boolean).join(" ");
}

export async function analyzeResumeIntelligence(input: AnalyzeResumeInput): Promise<AnalyzeResumeOutput> {
  const resumeText = input.resumeText.trim();
  if (resumeText.length < 40) {
    throw new Error("Resume text is too short. Please provide a detailed resume.");
  }

  const selectedRole = sanitizeRole(input.selectedRole);
  const resumeHash = computeAnalysisHash(resumeText);

  const userAnalysisRef = db.collection(USER_ANALYSIS_COLLECTION).doc(input.userId);
  const userAnalysisDoc = await userAnalysisRef.get();

  if (userAnalysisDoc.exists && !input.forceRefresh) {
    const parsed = storedUserAnalysisSchema.safeParse(userAnalysisDoc.data());
    if (parsed.success && parsed.data.resumeHash === resumeHash) {
      const revived = reviveStoredAnalysis({
        analysisId: parsed.data.latestAnalysisId ?? `${input.userId}-${resumeHash}`,
        rawIntelligence: parsed.data.intelligence,
        rawLegacy: parsed.data.legacy,
        yearsOfExperience: parsed.data.yearsOfExperience ?? 0,
        education: parsed.data.education ?? [],
        certifications: parsed.data.certifications ?? [],
      });

      if (revived) {
        return {
          analysisId: revived.analysisId,
          resumeHash,
          cached: true,
          intelligence: revived.intelligence,
          legacy: revived.legacy,
        };
      }
    }
  }

  const llmExtraction = await runResumeExtractionLLM({
    resumeText,
    selectedRole,
  });

  const built = buildResumeIntelligence({
    resumeText,
    selectedRole,
    llmExtraction,
  });

  const legacy = toLegacyResumeAnalysis({
    intelligence: built.intelligence,
    yearsOfExperience: built.yearsOfExperience,
    education: built.education,
    certifications: built.certifications,
  });

  const nowIso = new Date().toISOString();
  const analysisDocRef = db.collection(RESUME_ANALYSIS_COLLECTION).doc();
  const batch = db.batch();

  batch.set(analysisDocRef, {
    userId: input.userId,
    selectedRole,
    resumeText,
    resumeHash,
    analysisVersion: 2,
    intelligence: built.intelligence,
    legacy,
    yearsOfExperience: built.yearsOfExperience,
    education: built.education,
    certifications: built.certifications,
    detectedSkills: legacy.detectedSkills,
    detectedFrameworks: legacy.detectedFrameworks,
    detectedLanguages: legacy.detectedLanguages,
    detectedTools: legacy.detectedTools,
    projects: legacy.projects,
    detectedSubjects: legacy.detectedSubjects,
    experienceLevel: legacy.experienceLevel,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  batch.set(
    userAnalysisRef,
    {
      userId: input.userId,
      selectedRole,
      resumeHash,
      latestAnalysisId: analysisDocRef.id,
      intelligence: built.intelligence,
      legacy,
      yearsOfExperience: built.yearsOfExperience,
      education: built.education,
      certifications: built.certifications,
      skills: built.intelligence.skills,
      weaknesses: built.intelligence.weaknesses,
      strengths: built.intelligence.strengths,
      recommendedRoles: built.intelligence.recommendedRoles,
      missingKeySkills: built.intelligence.missingKeySkills,
      lastUpdated: nowIso,
      updatedAt: nowIso,
    },
    { merge: true }
  );

  await batch.commit();

  return {
    analysisId: analysisDocRef.id,
    resumeHash,
    cached: false,
    intelligence: built.intelligence,
    legacy,
  };
}
