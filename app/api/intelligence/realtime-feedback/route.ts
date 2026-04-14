import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createGeminiNDJSONStream } from "@/lib/gemini-utils";
import { getIntelligenceSnapshot } from "@/features/intelligence/services/intelligence.server";

const SNAPSHOT_CONTEXT_CACHE_TTL_MS = 15_000;

interface SnapshotContextCacheEntry {
  weakAreas: string[];
  targetRole: string | null;
  companyType: string | null;
  expiresAt: number;
}

const snapshotContextCache = new Map<string, SnapshotContextCacheEntry>();

function getCachedContext(userId: string): SnapshotContextCacheEntry | null {
  const cached = snapshotContextCache.get(userId);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    snapshotContextCache.delete(userId);
    return null;
  }
  return cached;
}

function setCachedContext(userId: string, entry: Omit<SnapshotContextCacheEntry, "expiresAt">): void {
  snapshotContextCache.set(userId, {
    ...entry,
    expiresAt: Date.now() + SNAPSHOT_CONTEXT_CACHE_TTL_MS,
  });
}

const requestSchema = z.object({
  userId: z.string().trim().min(1),
  transcript: z
    .array(
      z.object({
        role: z.string().trim().min(1),
        content: z.string().trim().min(1),
      })
    )
    .min(1),
  subjects: z.array(z.string().trim()).optional(),
});

function buildRealtimePrompt(input: {
  transcript: Array<{ role: string; content: string }>;
  weakAreas: string[];
  targetRole: string | null;
  companyType: string | null;
  subjects: string[];
}): string {
  const recentTranscript = input.transcript.slice(-10);
  const transcriptText = recentTranscript
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`)
    .join("\n");

  const weakAreaText = input.weakAreas.length > 0 ? input.weakAreas.join(", ") : "None identified yet";

  return `You are Cogniview Live Interview Coach. Give realtime coaching cues for an ongoing interview.

Context:
- Target Role: ${input.targetRole ?? "General Software Engineer"}
- Company Type: ${input.companyType ?? "General"}
- Priority Subjects: ${input.subjects.join(", ")}
- Known Weak Areas: ${weakAreaText}

Latest Transcript:
${transcriptText}

Rules:
1. Respond with exactly 3 short bullet points.
2. Each bullet must be actionable and under 18 words.
3. Focus on weak spots and immediate improvement for next answer.
4. Avoid repeating the same suggestion wording.
5. Do not include markdown code blocks or JSON.

Output format:
- cue 1
- cue 2
- cue 3`;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const parsed = requestSchema.safeParse(payload);

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

    const subjects =
      parsed.data.subjects && parsed.data.subjects.length > 0
        ? parsed.data.subjects
        : ["DBMS", "OS", "OOPS", "DSA", "CN"];

    let weakAreas: string[] = [];
    let targetRole: string | null = null;
    let companyType: string | null = null;

    const cachedContext = getCachedContext(parsed.data.userId);

    if (cachedContext) {
      weakAreas = cachedContext.weakAreas;
      targetRole = cachedContext.targetRole;
      companyType = cachedContext.companyType;
    } else {
      try {
        const snapshot = await getIntelligenceSnapshot(parsed.data.userId);
        weakAreas = snapshot.weakAreas.slice(0, 8);
        targetRole = snapshot.context.targetRole;
        companyType = snapshot.context.companyType;

        setCachedContext(parsed.data.userId, {
          weakAreas,
          targetRole,
          companyType,
        });
      } catch {
        // Continue without snapshot context for low-latency feedback.
      }
    }

    const prompt = buildRealtimePrompt({
      transcript: parsed.data.transcript,
      weakAreas,
      targetRole,
      companyType,
      subjects,
    });

    const stream = createGeminiNDJSONStream({
      prompt,
      model: "llama-3.1-8b-instant",
      maxOutputTokens: 220,
      temperature: 0.35,
      topP: 0.9,
      signal: request.signal,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/intelligence/realtime-feedback] failed", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to stream realtime feedback",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
