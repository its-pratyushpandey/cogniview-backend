import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/firebase/admin";
import { ingestIntelligenceEvent } from "@/features/intelligence/services/intelligence.server";

export async function POST(req: NextRequest) {
  try {
    const { sessionId, userId, subject, topic, conversationHistory, stats } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (conversationHistory !== undefined) {
      updateData.conversationHistory = conversationHistory;
    }

    if (stats) {
      if (stats.questionsAsked !== undefined) updateData.questionsAsked = stats.questionsAsked;
      if (stats.goodAnswers !== undefined) updateData.goodAnswers = stats.goodAnswers;
      if (stats.averageAnswers !== undefined) updateData.averageAnswers = stats.averageAnswers;
      if (stats.poorAnswers !== undefined) updateData.poorAnswers = stats.poorAnswers;
      if (stats.currentDifficulty !== undefined) updateData.currentDifficulty = stats.currentDifficulty;
    }

    await adminDb.collection("vivaSessions").doc(sessionId).update(updateData);

    if (typeof userId === "string" && userId.trim()) {
      const normalizedUserId = userId.trim();
      const answered = Number(stats?.questionsAsked ?? 0);
      const good = Number(stats?.goodAnswers ?? 0);
      const average = Number(stats?.averageAnswers ?? 0);
      const poor = Number(stats?.poorAnswers ?? 0);
      const totalEvaluated = good + average + poor;
      const normalizedScore =
        totalEvaluated > 0
          ? Math.round(((good * 90 + average * 62 + poor * 34) / totalEvaluated))
          : 55;

      try {
        await ingestIntelligenceEvent({
          userId: normalizedUserId,
          eventType: "progress.topic.updated",
          payload: {
            subject: typeof subject === "string" ? subject : "Viva",
            topicName: typeof topic === "string" && topic.trim().length > 0 ? topic : "Viva Session",
            score: normalizedScore,
            retries: Math.max(0, poor),
          },
          source: "api/viva/update-session",
        });

        await ingestIntelligenceEvent({
          userId: normalizedUserId,
          eventType: "learning.behavior.tracked",
          payload: {
            module: "viva",
            topicName: typeof topic === "string" ? topic : "Viva",
            score: normalizedScore,
            retries: Math.max(0, poor),
            confidence: normalizedScore,
            responseTimeMs: answered > 0 ? Math.round((answered * 9500) / Math.max(1, totalEvaluated)) : null,
            difficultyPreference:
              Number(stats?.currentDifficulty ?? 5) <= 4
                ? "easy"
                : Number(stats?.currentDifficulty ?? 5) <= 7
                  ? "medium"
                  : "hard",
          },
          source: "api/viva/update-session",
        });
      } catch (intelligenceError) {
        console.error("[api/viva/update-session] intelligence event failed", intelligenceError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Session updated successfully",
    });
  } catch (error) {
    console.error("Error updating viva session:", error);
    return NextResponse.json(
      { error: "Failed to update viva session" },
      { status: 500 }
    );
  }
}
