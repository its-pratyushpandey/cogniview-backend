import { NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { ingestIntelligenceEvent } from "@/features/intelligence/services/intelligence.server";
import { invalidateProgressCacheByPrefix, progressUserPrefix } from "@/app/api/progress/_lib/progress-cache";

// Helper function to calculate topic status
const calculateTopicStatus = (
  successRate: number,
  attempts: number
): { status: "STRONG" | "MODERATE" | "WEAK" | "NOT_ATTEMPTED"; color: "green" | "yellow" | "red" | "gray" } => {
  if (attempts === 0) return { status: "NOT_ATTEMPTED", color: "gray" };
  if (successRate >= 75) return { status: "STRONG", color: "green" };
  if (successRate >= 50) return { status: "MODERATE", color: "yellow" };
  return { status: "WEAK", color: "red" };
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, subject, topicName, score } = body;

    if (!userId || !subject || !topicName || score === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const progressDocId = `${userId}_${subject}`;
    const progressRef = db.collection("userProgress").doc(progressDocId);
    const progressDoc = await progressRef.get();

    let progressData: UserProgress;

    if (!progressDoc.exists) {
      // Create new progress document
      progressData = {
        userId,
        subject,
        topics: {},
        overallStrength: 0,
        updatedAt: new Date().toISOString(),
      };
    } else {
      progressData = progressDoc.data() as UserProgress;
    }

    // Update or create topic progress
    const currentTopic = progressData.topics[topicName] || {
      attempts: 0,
      successRate: 0,
      lastAttemptDate: "",
      averageScore: 0,
      status: "NOT_ATTEMPTED",
      color: "gray",
    };

    // Calculate new values
    const newAttempts = currentTopic.attempts + 1;
    const newAverageScore =
      (currentTopic.averageScore * currentTopic.attempts + score) / newAttempts;
    const newSuccessRate = newAverageScore; // Assuming score is 0-100

    const topicStatus = calculateTopicStatus(newSuccessRate, newAttempts);

    progressData.topics[topicName] = {
      attempts: newAttempts,
      successRate: newSuccessRate,
      lastAttemptDate: new Date().toISOString(),
      averageScore: newAverageScore,
      status: topicStatus.status,
      color: topicStatus.color,
    };

    // Calculate overall strength
    const topicScores = Object.values(progressData.topics)
      .filter((topic) => topic.attempts > 0)
      .map((topic) => topic.successRate);

    progressData.overallStrength =
      topicScores.length > 0
        ? topicScores.reduce((sum, score) => sum + score, 0) / topicScores.length
        : 0;

    progressData.updatedAt = new Date().toISOString();

    // Save to Firestore
    await progressRef.set(progressData);
    invalidateProgressCacheByPrefix(progressUserPrefix(userId));

    try {
      await ingestIntelligenceEvent({
        userId,
        eventType: "progress.topic.updated",
        payload: {
          subject,
          topicName,
          score,
          status: progressData.topics[topicName]?.status ?? "NOT_ATTEMPTED",
        },
        source: "api/progress/update-progress",
      });
    } catch (intelligenceError) {
      console.error("[api/progress/update-progress] intelligence event failed", intelligenceError);
    }

    return NextResponse.json({
      success: true,
      progress: progressData,
    });
  } catch (error: unknown) {
    console.error("Error updating progress:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update progress", details: message },
      { status: 500 }
    );
  }
}
