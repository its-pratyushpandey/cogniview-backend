import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { buildRecommendedActions } from "@/features/intelligence/engine/recommendation-engine";
import {
  ingestIntelligenceEvent,
  isKnownIntelligenceEventType,
} from "@/features/intelligence/services/intelligence.server";
import type { IntelligenceEventType } from "@/features/intelligence/types";

const requestSchema = z.object({
  userId: z.string().trim().min(1, "userId is required"),
  eventType: z.string().trim().min(1, "eventType is required"),
  payload: z.record(z.unknown()).optional(),
  source: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const mode = request.nextUrl.searchParams.get("mode");
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const eventType: IntelligenceEventType = isKnownIntelligenceEventType(parsed.data.eventType)
      ? parsed.data.eventType
      : "unknown";

    if (mode === "ack") {
      await ingestIntelligenceEvent(
        {
          userId: parsed.data.userId,
          eventType,
          payload: parsed.data.payload ?? {},
          source: parsed.data.source ?? "api/intelligence/events",
        },
        {
          bypassSnapshotReadCache: false,
          recordEventLog: false,
        }
      );

      return NextResponse.json(
        {
          success: true,
        },
        {
          status: 202,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const snapshot = await ingestIntelligenceEvent({
      userId: parsed.data.userId,
      eventType,
      payload: parsed.data.payload ?? {},
      source: parsed.data.source ?? "api/intelligence/events",
    });

    const recommendedActions = buildRecommendedActions(snapshot);

    return NextResponse.json({
      success: true,
      snapshot,
      recommendedActions,
    });
  } catch (error) {
    console.error("[api/intelligence/events] failed", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to ingest intelligence event",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
