import { NextResponse } from "next/server";
import { callGeminiAPI, parseGeminiJSON } from "@/lib/gemini-utils";
import { ingestIntelligenceEvent } from "@/features/intelligence/services/intelligence.server";

interface RawAnswerScore {
  question?: unknown;
  userAnswer?: unknown;
  technicalCorrectness?: unknown;
  terminologyUsage?: unknown;
  depthOfExplanation?: unknown;
  interviewReadiness?: unknown;
  overallScore?: unknown;
  strengths?: unknown;
  weaknesses?: unknown;
  improvement?: unknown;
  modelAnswer?: unknown;
}

interface PerQuestionSummary {
  question: string;
  userAnswer: string;
  accuracy: number;
  communicationQuality: number;
  suggestion: string;
  strengths: string[];
  weaknesses: string[];
}

interface SessionSummary {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  focusAreas: string[];
  improvementTips: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toStringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of items) {
    const key = item.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

function normalizeAnswerScores(raw: unknown): AnswerScore[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const entry = (item ?? {}) as RawAnswerScore;

      const technicalCorrectness = clamp(toNumber(entry.technicalCorrectness), 0, 10);
      const terminologyUsage = clamp(toNumber(entry.terminologyUsage), 0, 10);
      const depthOfExplanation = clamp(toNumber(entry.depthOfExplanation), 0, 10);
      const interviewReadiness = clamp(toNumber(entry.interviewReadiness), 0, 10);
      const overallScore =
        typeof entry.overallScore === "number"
          ? clamp(entry.overallScore, 0, 10)
          : Number(
              (
                (technicalCorrectness + terminologyUsage + depthOfExplanation + interviewReadiness) /
                4
              ).toFixed(1)
            );

      return {
        question: toStringValue(entry.question, "Interview question"),
        userAnswer: toStringValue(entry.userAnswer, "No answer captured."),
        technicalCorrectness,
        terminologyUsage,
        depthOfExplanation,
        interviewReadiness,
        overallScore,
        strengths: toStringArray(entry.strengths),
        weaknesses: toStringArray(entry.weaknesses),
        improvement: toStringValue(entry.improvement, "Add clearer structure and stronger technical specifics."),
        modelAnswer: toStringValue(entry.modelAnswer, "Provide a concise, technically precise answer with one concrete example."),
      } satisfies AnswerScore;
    })
    .filter((entry) => entry.question.length > 0);
}

function buildPerQuestionSummary(answerScores: AnswerScore[]): PerQuestionSummary[] {
  return answerScores.map((answer) => {
    const accuracy = Math.round(((answer.technicalCorrectness + answer.depthOfExplanation) / 2) * 10);
    const communicationQuality = Math.round(((answer.terminologyUsage + answer.interviewReadiness) / 2) * 10);

    return {
      question: answer.question,
      userAnswer: answer.userAnswer,
      accuracy: clamp(accuracy, 0, 100),
      communicationQuality: clamp(communicationQuality, 0, 100),
      suggestion:
        answer.improvement ||
        (accuracy < 60
          ? "Revisit fundamentals and answer with clearer technical steps."
          : "Add one concrete example and tighten your explanation structure."),
      strengths: answer.strengths,
      weaknesses: answer.weaknesses,
    };
  });
}

function buildSessionSummary(input: {
  answerScores: AnswerScore[];
  recommendations: string[];
  existing?: unknown;
}): SessionSummary {
  const { answerScores, recommendations, existing } = input;

  const source =
    typeof existing === "object" && existing !== null ? (existing as Record<string, unknown>) : null;

  const avgScore10 =
    answerScores.length > 0
      ? answerScores.reduce((sum, answer) => sum + answer.overallScore, 0) / answerScores.length
      : 0;
  const computedOverall = Math.round(clamp(avgScore10 * 10, 0, 100));

  const strengthPool = unique(answerScores.flatMap((answer) => answer.strengths));
  const weaknessPool = unique(answerScores.flatMap((answer) => answer.weaknesses));

  const overallScore = clamp(Math.round(toNumber(source?.overallScore, computedOverall)), 0, 100);
  const strengths =
    source && Array.isArray(source.strengths)
      ? unique(toStringArray(source.strengths)).slice(0, 8)
      : strengthPool.slice(0, 8);
  const weaknesses =
    source && Array.isArray(source.weaknesses)
      ? unique(toStringArray(source.weaknesses)).slice(0, 8)
      : weaknessPool.slice(0, 8);

  const focusAreas =
    source && Array.isArray(source.focusAreas)
      ? unique(toStringArray(source.focusAreas)).slice(0, 8)
      : weaknesses.slice(0, 5);

  const improvementTips =
    source && Array.isArray(source.improvementTips)
      ? unique(toStringArray(source.improvementTips)).slice(0, 8)
      : unique(recommendations).slice(0, 6);

  return {
    overallScore,
    strengths,
    weaknesses,
    focusAreas,
    improvementTips,
  };
}

const ENHANCED_SCORING_PROMPT = `You are an expert technical interviewer evaluating interview answers with precision.

**TRANSCRIPT:**
{{INTERVIEW_TRANSCRIPT}}

**YOUR TASK:**
Analyze EACH technical answer in the transcript and provide detailed quality scoring.

**SCORING CRITERIA (0-10):**
1. **Technical Correctness**: Factual accuracy of the answer
2. **Terminology Usage**: Proper use of technical terms and jargon
3. **Depth of Explanation**: Level of detail and understanding shown
4. **Interview Readiness**: How well it would perform in a real interview

**RESPONSE FORMAT (JSON ONLY):**
{
  "answerScores": [
    {
      "question": "Extract the main question asked",
      "userAnswer": "Brief summary of what candidate said",
      "technicalCorrectness": 7,
      "terminologyUsage": 6,
      "depthOfExplanation": 5,
      "interviewReadiness": 6,
      "overallScore": 6.0,
      "strengths": ["What they did well"],
      "weaknesses": ["What was missing or wrong"],
      "improvement": "Specific actionable improvement advice",
      "modelAnswer": "Provide what a STRONG 9-10/10 answer would look like"
    }
  ],
  "overallStats": {
    "avgTechnicalCorrectness": 7.2,
    "avgTerminologyUsage": 6.5,
    "avgDepthOfExplanation": 6.8,
    "avgInterviewReadiness": 7.0,
    "totalAnswers": 5,
    "strongAnswers": 2,
    "weakAnswers": 1
  },
  "recommendations": [
    "Top 3 specific improvements needed"
  ],
  "perQuestionSummary": [
    {
      "question": "Question text",
      "userAnswer": "Candidate answer summary",
      "accuracy": 72,
      "communicationQuality": 68,
      "suggestion": "One actionable suggestion",
      "strengths": ["What worked"],
      "weaknesses": ["What to improve"]
    }
  ],
  "sessionSummary": {
    "overallScore": 74,
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": ["Weakness 1", "Weakness 2"],
    "focusAreas": ["Area 1", "Area 2"],
    "improvementTips": ["Tip 1", "Tip 2"]
  }
}

Important:
- Only score TECHNICAL questions/answers (skip greetings, small talk)
- Be strict but fair - a 10/10 answer is exceptional
- Model answers should be concise but complete (2-3 sentences)
- Improvement advice should be specific and actionable

Analyze now:`;

export async function POST(req: Request) {
  try {
    const { transcript, userId } = await req.json();

    if (!transcript || !Array.isArray(transcript)) {
      return NextResponse.json(
        { error: "Invalid transcript format" },
        { status: 400 }
      );
    }

    // Filter out only meaningful Q&A exchanges
    const technicalTranscript = transcript.filter((msg: { role: string; content: string }) => {
      const content = msg.content.toLowerCase();
      // Skip very short messages and greetings
      return msg.content.length > 20 && 
             !content.includes("hello") && 
             !content.includes("hi there") &&
             !content.includes("thank you");
    });

    if (technicalTranscript.length === 0) {
      return NextResponse.json(
        { error: "No technical content to analyze" },
        { status: 400 }
      );
    }

    // Format transcript for analysis
    const formattedTranscript = technicalTranscript
      .map((msg: { role: string; content: string }) =>
        `${msg.role.toUpperCase()}: ${msg.content}`
      )
      .join("\n\n");

    const prompt = ENHANCED_SCORING_PROMPT.replace(
      "{{INTERVIEW_TRANSCRIPT}}",
      formattedTranscript
    );

    const llmResponse = await callGeminiAPI({
      prompt,
      temperature: 0.4,
      maxOutputTokens: 4096,
      topP: 0.95,
      model: "llama-3.3-70b-versatile",
    });

    const analysis = parseGeminiJSON(llmResponse.text);
    if (!llmResponse.success || !analysis || typeof analysis !== "object") {
      throw new Error(llmResponse.error || "Failed to parse model JSON output");
    }

    const analysisRecord = analysis as Record<string, unknown>;
    const answerScores = normalizeAnswerScores(analysisRecord.answerScores);

    const overallStatsRecord =
      typeof analysisRecord.overallStats === "object" && analysisRecord.overallStats !== null
        ? (analysisRecord.overallStats as Record<string, unknown>)
        : null;

    const avgTechnicalCorrectness =
      answerScores.length > 0
        ? Number(
            (answerScores.reduce((sum, score) => sum + score.technicalCorrectness, 0) / answerScores.length).toFixed(2)
          )
        : 0;
    const avgTerminologyUsage =
      answerScores.length > 0
        ? Number(
            (answerScores.reduce((sum, score) => sum + score.terminologyUsage, 0) / answerScores.length).toFixed(2)
          )
        : 0;
    const avgDepthOfExplanation =
      answerScores.length > 0
        ? Number(
            (answerScores.reduce((sum, score) => sum + score.depthOfExplanation, 0) / answerScores.length).toFixed(2)
          )
        : 0;
    const avgInterviewReadiness =
      answerScores.length > 0
        ? Number(
            (answerScores.reduce((sum, score) => sum + score.interviewReadiness, 0) / answerScores.length).toFixed(2)
          )
        : 0;

    const overallStats = {
      avgTechnicalCorrectness: clamp(toNumber(overallStatsRecord?.avgTechnicalCorrectness, avgTechnicalCorrectness), 0, 10),
      avgTerminologyUsage: clamp(toNumber(overallStatsRecord?.avgTerminologyUsage, avgTerminologyUsage), 0, 10),
      avgDepthOfExplanation: clamp(toNumber(overallStatsRecord?.avgDepthOfExplanation, avgDepthOfExplanation), 0, 10),
      avgInterviewReadiness: clamp(toNumber(overallStatsRecord?.avgInterviewReadiness, avgInterviewReadiness), 0, 10),
      totalAnswers: Math.max(0, Math.round(toNumber(overallStatsRecord?.totalAnswers, answerScores.length))),
      strongAnswers: Math.max(0, Math.round(toNumber(overallStatsRecord?.strongAnswers, answerScores.filter((score) => score.overallScore >= 8).length))),
      weakAnswers: Math.max(0, Math.round(toNumber(overallStatsRecord?.weakAnswers, answerScores.filter((score) => score.overallScore < 5).length))),
    };

    const recommendations = unique(toStringArray(analysisRecord.recommendations)).slice(0, 8);

    const computedPerQuestion = buildPerQuestionSummary(answerScores);
    const perQuestionSummaryRaw = Array.isArray(analysisRecord.perQuestionSummary)
      ? analysisRecord.perQuestionSummary
      : [];

    const perQuestionSummary =
      perQuestionSummaryRaw.length > 0
        ? perQuestionSummaryRaw
            .map((item, index) => {
              const record =
                typeof item === "object" && item !== null ? (item as Record<string, unknown>) : null;
              const fallback = computedPerQuestion[index];

              return {
                question: toStringValue(record?.question, fallback?.question ?? `Question ${index + 1}`),
                userAnswer: toStringValue(record?.userAnswer, fallback?.userAnswer ?? ""),
                accuracy: clamp(Math.round(toNumber(record?.accuracy, fallback?.accuracy ?? 0)), 0, 100),
                communicationQuality: clamp(
                  Math.round(toNumber(record?.communicationQuality, fallback?.communicationQuality ?? 0)),
                  0,
                  100
                ),
                suggestion: toStringValue(record?.suggestion, fallback?.suggestion ?? "Improve structure and technical precision."),
                strengths: unique(toStringArray(record?.strengths)).slice(0, 6),
                weaknesses: unique(toStringArray(record?.weaknesses)).slice(0, 6),
              };
            })
            .slice(0, Math.max(answerScores.length, perQuestionSummaryRaw.length))
        : computedPerQuestion;

    const sessionSummary = buildSessionSummary({
      answerScores,
      recommendations,
      existing: analysisRecord.sessionSummary,
    });

    const normalizedScoring: AnswerQualityAnalysis = {
      answerScores,
      overallStats,
      recommendations,
      perQuestionSummary,
      sessionSummary,
    };

    if (typeof userId === "string" && userId.trim()) {
      try {
        await ingestIntelligenceEvent({
          userId: userId.trim(),
          eventType: "interview.answer_scoring.completed",
          payload: {
            scoring: normalizedScoring,
          },
          source: "api/interview/score-answers",
        });
      } catch (intelligenceError) {
        console.error("[api/interview/score-answers] intelligence event failed", intelligenceError);
      }
    }

    return NextResponse.json({
      success: true,
      scoring: normalizedScoring,
    });
  } catch (error) {
    console.error("Answer Quality Scoring Error:", error);
    return NextResponse.json(
      {
        error: "Failed to analyze answer quality",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
