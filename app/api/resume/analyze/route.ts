import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { analyzeResumeIntelligence } from "@/features/resume-analysis/services/resume-analysis.server";

const requestSchema = z.object({
  userId: z.string().trim().min(1, "userId is required"),
  resumeText: z.string().trim().min(40, "resumeText is too short"),
  selectedRole: z.string().trim().optional(),
  forceRefresh: z.boolean().optional(),
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

    const result = await analyzeResumeIntelligence(parsed.data);

    return NextResponse.json({
      success: true,
      analysisId: result.analysisId,
      analysis: result.legacy,
      intelligence: result.intelligence,
      cached: result.cached,
    });
  } catch (error) {
    console.error("Error analyzing resume:", error);
    return NextResponse.json(
      { error: "Failed to analyze resume" },
      { status: 500 }
    );
  }
}
