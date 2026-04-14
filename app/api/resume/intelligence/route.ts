import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { analyzeResumeIntelligence } from "@/features/resume-analysis/services/resume-analysis.server";
import { ingestIntelligenceEvent } from "@/features/intelligence/services/intelligence.server";

const requestSchema = z.object({
  userId: z.string().trim().min(1, "userId is required"),
  resumeText: z.string().trim().min(40, "resumeText is too short"),
  selectedRole: z.string().trim().optional(),
  forceRefresh: z.boolean().optional(),
});

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

    const result = await analyzeResumeIntelligence(parsed.data);

    try {
      await ingestIntelligenceEvent({
        userId: parsed.data.userId,
        eventType: "resume.analysis.completed",
        payload: {
          analysisId: result.analysisId,
          selectedRole: parsed.data.selectedRole ?? null,
          cached: result.cached,
          intelligence: result.intelligence,
        },
        source: "api/resume/intelligence",
      });
    } catch (intelligenceError) {
      console.error("[api/resume/intelligence] intelligence event failed", intelligenceError);
    }

    return NextResponse.json({
      success: true,
      analysisId: result.analysisId,
      cached: result.cached,
      intelligence: result.intelligence,
      analysis: result.legacy,
    });
  } catch (error) {
    console.error("[api/resume/intelligence] failed", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to analyze resume",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
