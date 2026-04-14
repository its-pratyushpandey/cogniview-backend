import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { generateAdaptiveQuestions } from "@/features/resume-analysis/services/question-generator.server";

const requestSchema = z.object({
  userId: z.string().trim().min(1, "userId is required"),
  analysisId: z.string().trim().optional(),
  mode: z.enum(["weak-areas", "all-skills", "custom"]).optional(),
  selectedRole: z.string().trim().optional(),
  customTopics: z.array(z.string().trim().min(1)).optional(),
  count: z.number().int().min(3).max(18).optional(),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON body",
        },
        { status: 400 }
      );
    }

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

    const result = await generateAdaptiveQuestions(parsed.data);

    return NextResponse.json({
      success: true,
      planId: result.planId,
      cached: result.cached,
      mode: result.mode,
      questions: result.questions,
      focusAreas: result.focusAreas,
      intelligence: result.intelligence,
    });
  } catch (error) {
    console.error("[api/resume/questions] failed", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate adaptive questions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
