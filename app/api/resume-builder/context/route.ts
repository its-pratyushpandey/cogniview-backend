import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/firebase/admin";
import { getLatestUserResumeAnalysis } from "@/features/resume-analysis/services/resume-analysis.server";
import { resumeBuilderDocumentSchema } from "@/features/resume-builder/server/document-schema";

const RESUME_BUILDER_COLLECTION = "resume_builder_drafts";

const querySchema = z.object({
  userId: z.string().trim().min(1, "userId is required"),
});

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          draft: null,
          analysis: null,
          draftUpdatedAt: null,
          error: "Invalid query parameters",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const userId = parsed.data.userId;

    const [draftDoc, analysis] = await Promise.all([
      db.collection(RESUME_BUILDER_COLLECTION).doc(userId).get(),
      getLatestUserResumeAnalysis(userId),
    ]);

    let draft = null;
    let draftUpdatedAt: string | null = null;

    if (draftDoc.exists) {
      const rawDraft = draftDoc.data();
      const validatedDraft = resumeBuilderDocumentSchema.safeParse(rawDraft?.document);

      if (validatedDraft.success) {
        draft = validatedDraft.data;
        draftUpdatedAt = typeof rawDraft?.updatedAt === "string" ? rawDraft.updatedAt : validatedDraft.data.updatedAt;
      }
    }

    return NextResponse.json({
      success: true,
      draft,
      analysis: analysis
        ? {
            analysisId: analysis.analysisId,
            intelligence: analysis.intelligence,
            legacy: analysis.legacy,
          }
        : null,
      draftUpdatedAt,
    });
  } catch (error) {
    console.error("[api/resume-builder/context] failed", error);

    return NextResponse.json(
      {
        success: false,
        draft: null,
        analysis: null,
        draftUpdatedAt: null,
        error: "Failed to load resume builder context",
      },
      { status: 500 }
    );
  }
}
