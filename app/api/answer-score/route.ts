import { NextResponse } from "next/server";

import { callGeminiAPI, parseGeminiJSON } from "@/lib/gemini-utils";
import { ingestIntelligenceEvent } from "@/features/intelligence/services/intelligence.server";

interface RawAnswerScorePayload {
  score?: unknown;
  clarity?: unknown;
  accuracy?: unknown;
  depth?: unknown;
  feedback?: unknown;
  improvementTips?: unknown;
  strengths?: unknown;
  weaknesses?: unknown;
  modelAnswer?: unknown;
}

const ANSWER_SCORING_PROMPT = `You are an expert technical interview evaluator.

Evaluate the candidate's answer and return JSON only.

Question: {{QUESTION}}
Candidate Answer: {{USER_ANSWER}}

Scoring scale:
- score: 0 to 100 overall
- clarity: 0 to 100
- accuracy: 0 to 100
- depth: 0 to 100

Return exact JSON shape:
{
  "score": 72,
  "clarity": 70,
  "accuracy": 75,
  "depth": 71,
  "feedback": "1 to 2 sentence practical feedback",
  "improvementTips": ["Tip 1", "Tip 2", "Tip 3"],
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "modelAnswer": "A concise high-quality answer in 2 to 4 sentences"
}

Rules:
- Be strict but fair.
- Improvement tips must be actionable.
- Model answer must be realistic and concise.
- No markdown, no prose, JSON only.`;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toStringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 8);
}

function heuristicEvaluation(question: string, userAnswer: string): AnswerScoreEvaluation {
  const words = userAnswer.split(/\s+/).filter(Boolean).length;
  const sentences = userAnswer
    .split(/[.!?]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean).length;
  const hasExample = /for example|for instance|because|therefore|in practice/i.test(userAnswer);

  const baseDepth = clamp(words * 1.3 + (hasExample ? 8 : 0), 24, 86);
  const baseClarity = clamp(sentences * 16 + (hasExample ? 8 : 0), 22, 88);
  const baseAccuracy = clamp(baseDepth * 0.7 + baseClarity * 0.3, 20, 86);
  const score = clamp((baseDepth + baseClarity + baseAccuracy) / 3, 20, 86);

  return {
    question,
    userAnswer,
    score,
    clarity: baseClarity,
    accuracy: baseAccuracy,
    depth: baseDepth,
    feedback: "Initial quality estimate generated. AI detailed scoring is currently unavailable.",
    improvementTips: [
      "Answer in a clear structure: definition, explanation, and example.",
      "Use precise technical terminology for key concepts.",
      "Add one practical scenario to improve depth.",
    ],
    strengths: ["You attempted the question directly."],
    weaknesses: ["Add stronger technical precision and structured explanation."],
    modelAnswer: "A stronger answer should define the concept, explain the mechanism clearly, and include one concise real-world example.",
  };
}

function normalizeEvaluation(
  question: string,
  userAnswer: string,
  payload: RawAnswerScorePayload | null
): AnswerScoreEvaluation {
  const fallback = heuristicEvaluation(question, userAnswer);
  const normalized = payload ?? {};

  const score = clamp(toNumber(normalized.score, fallback.score));
  const clarity = clamp(toNumber(normalized.clarity, fallback.clarity));
  const accuracy = clamp(toNumber(normalized.accuracy, fallback.accuracy));
  const depth = clamp(toNumber(normalized.depth, fallback.depth));

  const improvementTips = toStringList(normalized.improvementTips);
  const strengths = toStringList(normalized.strengths);
  const weaknesses = toStringList(normalized.weaknesses);

  return {
    question,
    userAnswer,
    score,
    clarity,
    accuracy,
    depth,
    feedback: toStringValue(normalized.feedback, fallback.feedback),
    improvementTips: improvementTips.length > 0 ? improvementTips : fallback.improvementTips,
    strengths: strengths.length > 0 ? strengths : fallback.strengths,
    weaknesses: weaknesses.length > 0 ? weaknesses : fallback.weaknesses,
    modelAnswer: toStringValue(normalized.modelAnswer, fallback.modelAnswer),
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      question?: unknown;
      userAnswer?: unknown;
      userId?: unknown;
    };

    const question = typeof body.question === "string" ? body.question.trim() : "";
    const userAnswer = typeof body.userAnswer === "string" ? body.userAnswer.trim() : "";

    if (!question || !userAnswer) {
      return NextResponse.json(
        { success: false, error: "question and userAnswer are required." } satisfies AnswerScoreApiFailure,
        { status: 400 }
      );
    }

    const prompt = ANSWER_SCORING_PROMPT.replace("{{QUESTION}}", question).replace(
      "{{USER_ANSWER}}",
      userAnswer
    );

    const llmResponse = await callGeminiAPI({
      prompt,
      temperature: 0.35,
      maxOutputTokens: 1024,
      topP: 0.9,
      model: "llama-3.3-70b-versatile",
    });

    const parsed = llmResponse.success
      ? parseGeminiJSON<RawAnswerScorePayload>(llmResponse.text)
      : null;

    const result = normalizeEvaluation(question, userAnswer, parsed);

    if (typeof body.userId === "string" && body.userId.trim()) {
      try {
        await ingestIntelligenceEvent({
          userId: body.userId.trim(),
          eventType: "interview.answer_scoring.completed",
          payload: {
            question,
            score: result.score,
            clarity: result.clarity,
            accuracy: result.accuracy,
            depth: result.depth,
          },
          source: "api/answer-score",
        });
      } catch (intelligenceError) {
        console.error("[api/answer-score] intelligence event failed", intelligenceError);
      }
    }

    return NextResponse.json({
      success: true,
      result,
    } satisfies AnswerScoreApiSuccess);
  } catch (error) {
    console.error("[api/answer-score] failed", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to score answer.",
      } satisfies AnswerScoreApiFailure,
      { status: 500 }
    );
  }
}
