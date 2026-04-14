import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/firebase/admin";
import { ingestIntelligenceEvent } from "@/features/intelligence/services/intelligence.server";
import { generateAdaptiveQuestions } from "@/features/resume-analysis/services/question-generator.server";
import type { ExperienceLevel, QuestionGenerationMode } from "@/features/resume-analysis/types";

const requestSchema = z.object({
  userId: z.string().trim().min(1, "userId is required"),
  analysisId: z.string().trim().optional(),
  selectedRole: z.string().trim().optional(),
  mode: z.enum(["weak-areas", "all-skills", "custom"]).optional(),
  questionCount: z.number().int().min(4).max(12).optional(),
  questions: z.array(z.string().trim().min(6)).max(18).optional(),
  focusAreas: z.array(z.string().trim().min(1)).max(18).optional(),
  experienceLevel: z.enum(["Beginner", "Intermediate", "Advanced"]).optional(),
  techstack: z.array(z.string().trim().min(1)).max(24).optional(),
});

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(trimmed);
  }

  return output;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const selectedRole = parsed.data.selectedRole?.trim() || "Software Engineer";
    const questionLimit = parsed.data.questionCount ?? 8;
    const providedQuestions = (parsed.data.questions ?? [])
      .map((question) => question.trim())
      .filter(Boolean)
      .slice(0, questionLimit);

    let interviewQuestions = providedQuestions;
    let focusAreas = uniqueStrings(parsed.data.focusAreas ?? []);
    let experienceLevel: ExperienceLevel = parsed.data.experienceLevel ?? "Intermediate";
    let techstack = uniqueStrings(parsed.data.techstack ?? []);
    let source: "resume-generated" | "client-provided" = "client-provided";
    let generationMode: QuestionGenerationMode = parsed.data.mode ?? "weak-areas";
    let generatedFromCache = false;

    if (interviewQuestions.length === 0) {
      const generated = await generateAdaptiveQuestions({
        userId: parsed.data.userId,
        analysisId: parsed.data.analysisId,
        selectedRole,
        mode: parsed.data.mode ?? "weak-areas",
        count: questionLimit,
      });

      interviewQuestions = generated.questions.map((question) => question.questionText);
      focusAreas = generated.focusAreas;
      experienceLevel = generated.intelligence.experienceLevel;
      techstack = generated.intelligence.skills.map((skill) => skill.name).slice(0, 10);
      source = "resume-generated";
      generationMode = generated.mode;
      generatedFromCache = generated.cached;
    }

    if (interviewQuestions.length < 4) {
      return NextResponse.json(
        {
          success: false,
          error: "Not enough interview questions to launch a session",
        },
        { status: 400 }
      );
    }

    const interviewRef = await db.collection("interviews").add({
      role: selectedRole,
      type: "resume-mock",
      level: experienceLevel,
      techstack: uniqueStrings([...techstack, ...focusAreas]).slice(0, 12),
      questions: uniqueStrings(interviewQuestions).slice(0, questionLimit),
      userId: parsed.data.userId,
      finalized: true,
      createdAt: new Date().toISOString(),
    });

    try {
      await ingestIntelligenceEvent({
        userId: parsed.data.userId,
        eventType: "resume.questions.generated",
        payload: {
          selectedRole,
          mode: generationMode,
          count: interviewQuestions.length,
          focusAreas,
          launchedInterviewId: interviewRef.id,
          source,
        },
        source: "api/resume/launch-interview",
      });
    } catch (intelligenceError) {
      console.error("[api/resume/launch-interview] intelligence event failed", intelligenceError);
    }

    return NextResponse.json({
      success: true,
      interviewId: interviewRef.id,
      questionCount: interviewQuestions.length,
      source,
      mode: generationMode,
      cached: generatedFromCache,
    });
  } catch (error) {
    console.error("[api/resume/launch-interview] failed", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to launch interview session",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}