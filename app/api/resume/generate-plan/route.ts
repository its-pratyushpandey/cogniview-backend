import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  generateAdaptiveQuestions,
  toLegacyInterviewPlan,
} from "@/features/resume-analysis/services/question-generator.server";

const requestSchema = z.object({
  userId: z.string().trim().min(1, "userId is required"),
  resumeAnalysisId: z.string().trim().optional(),
  targetCompanyType: z.string().trim().optional(),
  targetRole: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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

    const result = await generateAdaptiveQuestions({
      userId: parsed.data.userId,
      analysisId: parsed.data.resumeAnalysisId,
      mode: "weak-areas",
      selectedRole: parsed.data.targetRole,
    });

    const plan = toLegacyInterviewPlan({
      questions: result.questions,
      intelligence: result.intelligence,
      focusAreas: result.focusAreas,
    });

    return NextResponse.json({
      success: true,
      planId: result.planId,
      plan,
      mode: result.mode,
      cached: result.cached,
      targetCompanyType: parsed.data.targetCompanyType ?? "product-based",
      targetRole: parsed.data.targetRole ?? "Software Engineer",
    });
  } catch (error) {
    console.error("Error generating interview plan:", error);
    return NextResponse.json(
      { error: "Failed to generate interview plan" },
      { status: 500 }
    );
  }
}
