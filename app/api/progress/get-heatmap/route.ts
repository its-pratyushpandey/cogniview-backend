import { NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import {
  getOrLoadProgressCache,
  progressAllCacheKey,
  progressSubjectCacheKey,
} from "@/app/api/progress/_lib/progress-cache";

const PROGRESS_CACHE_TTL_MS = 45_000;

function normalizeText(value: string | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildEmptyProgress(userId: string, subject: string): UserProgress {
  return {
    userId,
    subject,
    topics: {},
    overallStrength: 0,
    updatedAt: new Date().toISOString(),
  };
}

async function loadAllProgress(userId: string): Promise<UserProgress[]> {
  return getOrLoadProgressCache(progressAllCacheKey(userId), PROGRESS_CACHE_TTL_MS, async () => {
    const progressSnapshot = await db.collection("userProgress").where("userId", "==", userId).get();

    const allProgress: UserProgress[] = [];
    progressSnapshot.forEach((doc) => {
      allProgress.push(doc.data() as UserProgress);
    });

    return allProgress;
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = normalizeText(searchParams.get("userId"));
    const subject = normalizeText(searchParams.get("subject"));

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const allProgress = await loadAllProgress(userId);

    if (subject) {
      const subjectProgress = await getOrLoadProgressCache(
        progressSubjectCacheKey(userId, subject),
        PROGRESS_CACHE_TTL_MS,
        async () => {
          const normalizedSubject = subject.toLowerCase();
          return (
            allProgress.find((entry) => entry.subject.trim().toLowerCase() === normalizedSubject) ??
            buildEmptyProgress(userId, subject)
          );
        }
      );

      return NextResponse.json(subjectProgress, {
        headers: {
          "Cache-Control": "private, max-age=20, stale-while-revalidate=40",
        },
      });
    }

    return NextResponse.json(allProgress, {
      headers: {
        "Cache-Control": "private, max-age=20, stale-while-revalidate=40",
      },
    });
  } catch (error: unknown) {
    console.error("Error fetching progress heatmap:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch progress data", details: message },
      { status: 500 }
    );
  }
}
