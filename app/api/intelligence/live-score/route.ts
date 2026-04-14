import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createGeminiNDJSONStream } from "@/lib/gemini-utils";
import { getIntelligenceSnapshot } from "@/features/intelligence/services/intelligence.server";

const requestSchema = z.object({
  userId: z.string().trim().min(1),
  module: z.enum(["mcq", "coding"]),
  event: z.enum(["question_answered", "code_executed", "code_evaluated", "session_summary"]),
  metrics: z.record(z.unknown()),
  history: z.array(z.string().trim().min(1)).max(8).optional(),
});

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function buildLiveScorePrompt(input: {
  module: "mcq" | "coding";
  event: "question_answered" | "code_executed" | "code_evaluated" | "session_summary";
  metrics: Record<string, unknown>;
  weakAreas: string[];
  targetRole: string | null;
  companyType: string | null;
  history: string[];
}): string {
  const accuracy = toNumber(input.metrics.accuracy);
  const score = toNumber(input.metrics.score);
  const passRate = toNumber(input.metrics.passRate);
  const responseTimeMs = toNumber(input.metrics.responseTimeMs);
  const retries = toNumber(input.metrics.retries);
  const difficulty = toText(input.metrics.difficulty);
  const topic = toText(input.metrics.topic) ?? toText(input.metrics.topicName);
  const explicitCompanyType = toText(input.metrics.companyType);
  const explicitRole = toText(input.metrics.targetRole);

  const codeQualityRaw =
    typeof input.metrics.codeQuality === "object" && input.metrics.codeQuality !== null
      ? (input.metrics.codeQuality as Record<string, unknown>)
      : null;

  const readability = codeQualityRaw ? toNumber(codeQualityRaw.readability) : null;
  const efficiency = codeQualityRaw ? toNumber(codeQualityRaw.efficiency) : null;
  const correctness = codeQualityRaw ? toNumber(codeQualityRaw.correctness) : null;

  const weakAreaText = input.weakAreas.length > 0 ? input.weakAreas.join(", ") : "none";
  const historyText = input.history.length > 0 ? input.history.join(" | ") : "not available";

  return `You are Cogniview Live Coach for ${input.module.toUpperCase()} prep.

Event: ${input.event}
Target role: ${explicitRole ?? input.targetRole ?? "General Software Engineer"}
Company type: ${explicitCompanyType ?? input.companyType ?? "General"}
Topic: ${topic ?? "General"}
Difficulty: ${difficulty ?? "adaptive"}
Accuracy: ${accuracy ?? "n/a"}
Score: ${score ?? "n/a"}
Pass rate: ${passRate ?? "n/a"}
Response time ms: ${responseTimeMs ?? "n/a"}
Retries: ${retries ?? "n/a"}
Code quality (readability/efficiency/correctness): ${readability ?? "n/a"}/${efficiency ?? "n/a"}/${correctness ?? "n/a"}
Known weak areas: ${weakAreaText}
Recent history: ${historyText}

Rules:
1. Return exactly 3 bullet points.
2. Each bullet must be actionable and under 18 words.
3. Bullet 1: immediate diagnosis.
4. Bullet 2: specific improvement for next attempt.
5. Bullet 3: short strategic focus linked to weak areas/role/company.
6. Avoid markdown code blocks, JSON, or numbering.

Output:
- cue 1
- cue 2
- cue 3`;
}

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

    let weakAreas: string[] = [];
    let targetRole: string | null = null;
    let companyType: string | null = null;

    try {
      const snapshot = await getIntelligenceSnapshot(parsed.data.userId);
      weakAreas = snapshot.weakAreas.slice(0, 8);
      targetRole = snapshot.context.targetRole;
      companyType = snapshot.context.companyType;
    } catch {
      // Continue with low-latency defaults when snapshot is unavailable.
    }

    const prompt = buildLiveScorePrompt({
      module: parsed.data.module,
      event: parsed.data.event,
      metrics: parsed.data.metrics,
      weakAreas,
      targetRole,
      companyType,
      history: parsed.data.history ?? [],
    });

    const stream = createGeminiNDJSONStream({
      prompt,
      model: "llama-3.1-8b-instant",
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 220,
      signal: request.signal,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/intelligence/live-score] failed", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to stream live score feedback",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
