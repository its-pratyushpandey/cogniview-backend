import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { buildRecommendedActions } from "@/features/intelligence/engine/recommendation-engine";
import { getIntelligenceSnapshot } from "@/features/intelligence/services/intelligence.server";

const querySchema = z.object({
  userId: z.string().trim().min(1, "userId is required"),
});

export async function GET(request: NextRequest) {
  try {
    const parsed = querySchema.safeParse({
      userId: request.nextUrl.searchParams.get("userId"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query params",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const snapshot = await getIntelligenceSnapshot(parsed.data.userId);
    const recommendedActions = buildRecommendedActions(snapshot, 4);

    return NextResponse.json(
      {
        success: true,
        snapshot,
        recommendedActions,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=45",
        },
      }
    );
  } catch (error) {
    console.error("[api/intelligence/snapshot] failed", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch intelligence snapshot",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
