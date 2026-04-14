import { NextResponse } from "next/server";
import { callGeminiAPI, parseGeminiJSON } from "@/lib/gemini-utils";
import { z } from "zod";
import {
  getIntelligenceSnapshot,
  ingestIntelligenceEvent,
} from "@/features/intelligence/services/intelligence.server";
import {
  MISTAKE_PRIORITY_THRESHOLD,
  annotateCandidatesWithMistakePriority,
  resolveMistakePriorityTopicOverride,
} from "@/features/intelligence/engine/mistake-priority";

const mcqQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()).min(2),
  correctAnswer: z.number().int().nonnegative(),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced", "Tricky"]),
  conceptTags: z.array(z.string()),
  explanation: z.object({
    correct: z.string(),
    why_others_wrong: z.record(z.string()),
  }),
  interviewTip: z.string(),
  companyAskedBy: z.array(z.string()),
});

const mcqResponseSchema = z.object({
  mcqs: z.array(mcqQuestionSchema),
});

const MCQ_GENERATOR_PROMPT = `Generate {{COUNT}} placement-level MCQ questions for interviews.

**PARAMETERS:**
- Subject: {{SUBJECT}}
- Topic: {{TOPIC}}
- Difficulty: {{DIFFICULTY}} (Beginner/Intermediate/Advanced/Tricky)
- Company Pattern: {{COMPANY_TYPE}} (Service-based/Product-based/Startup)
- Focus: {{FOCUS}} (Conceptual/Tricky/GATE-style/Company-specific)

**RULES:**
1. Questions must be INTERVIEW-REALISTIC (not textbook theory)
2. Include tricky options that expose shallow understanding
3. Provide DETAILED explanations for why each option is right/wrong
4. Tag each question with sub-concepts (e.g., "Deadlock Prevention")
5. Ensure questions match company pattern (TCS = moderate, Amazon = hard)

**RESPONSE FORMAT (JSON ONLY):**
{
  "mcqs": [
    {
      "id": "unique_id",
      "question": "In a multithreaded environment, which synchronization mechanism has the LEAST overhead?",
      "options": [
        "Mutex",
        "Semaphore",
        "Spinlock",
        "Monitor"
      ],
      "correctAnswer": 2,
      "difficulty": "Advanced",
      "conceptTags": ["Concurrency", "Synchronization", "Performance"],
      "explanation": {
        "correct": "Spinlock has least overhead because it doesn't involve context switching...",
        "why_others_wrong": {
          "0": "Mutex involves context switching, higher overhead",
          "1": "Semaphore also has context switching cost",
          "3": "Monitor is higher-level abstraction with more overhead"
        }
      },
      "interviewTip": "Amazon frequently asks about when to use spinlocks vs mutexes in high-performance systems",
      "companyAskedBy": ["Amazon", "Google", "Microsoft"]
    }
  ]
}

Generate now:`;

export async function POST(req: Request) {
  try {
    const {
      userId,
      subject,
      topic,
      count = 5,
      difficulty = "Intermediate",
      companyType = "Product-based",
      focus = "Conceptual",
    } = await req.json();

    if (!userId || !subject || !topic) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    let weakAreas: string[] = [];
    let targetRole: string | null = null;
    let companyContext: string | null = null;
    const priorityOverride = await resolveMistakePriorityTopicOverride({
      userId: String(userId),
      selectedTopic: topic,
      subject,
      threshold: MISTAKE_PRIORITY_THRESHOLD,
      sessionKey: `mcq:${String(userId)}:${subject}`,
    });
    const effectiveTopic = priorityOverride.selectedTopic;

    try {
      const snapshot = await getIntelligenceSnapshot(String(userId));
      weakAreas = snapshot.weakAreas.slice(0, 6);
      targetRole = snapshot.context.targetRole;
      companyContext = snapshot.context.companyType;
    } catch {
      // Continue even if intelligence snapshot is unavailable.
    }

    // Replace placeholders in the prompt
    const prompt = MCQ_GENERATOR_PROMPT.replace("{{COUNT}}", count.toString())
      .replace("{{SUBJECT}}", subject)
      .replace("{{TOPIC}}", effectiveTopic)
      .replace("{{DIFFICULTY}}", difficulty)
      .replace("{{COMPANY_TYPE}}", companyType)
      .replace("{{FOCUS}}", focus)
      .concat(
        `\n\n**ADAPTIVE INTELLIGENCE CONTEXT:**\n` +
          `- Candidate weak areas: ${weakAreas.length > 0 ? weakAreas.join(", ") : "Not available"}\n` +
          `- Target role: ${targetRole ?? "Not set"}\n` +
          `- Company context: ${companyContext ?? companyType}\n` +
          `- Mistake-priority override: ${
            priorityOverride.overrideApplied && priorityOverride.metadata?.reason
              ? `${priorityOverride.metadata.reason}. Prioritize ${effectiveTopic}.`
              : "Not active"
          }\n` +
          `Prioritize at least 60% questions from weak areas and role-relevant subtopics.`
      );

    // Call Gemini API with retry and rate limiting
    const geminiResponse = await callGeminiAPI({
      prompt,
      temperature: 0.8,
      maxOutputTokens: 4096,
      topP: 0.95,
    });

    if (!geminiResponse.success) {
      return NextResponse.json(
        {
          error: "Failed to generate MCQs",
          details: geminiResponse.error || "Unknown error",
          retryable: geminiResponse.error?.includes("rate limit") || 
                     geminiResponse.error?.includes("Too Many Requests"),
        },
        { status: 503 }
      );
    }

    // Parse + validate JSON response
    const parsed = parseGeminiJSON<unknown>(geminiResponse.text);
    const validated = mcqResponseSchema.safeParse(parsed);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Failed to parse MCQ data",
          details: "Invalid JSON format or schema mismatch",
        },
        { status: 500 }
      );
    }

    const generated = validated.data.mcqs;
    const annotated = annotateCandidatesWithMistakePriority({
      context: priorityOverride.context,
      candidates: generated.map((question) => ({
        tags: question.conceptTags,
        topic: question.conceptTags[0],
        text: question.question,
      })),
      threshold: MISTAKE_PRIORITY_THRESHOLD,
    });

    const generatedWithPriority = generated.map((question, index) => {
      const metadata = annotated[index]?.metadata;
      if (!metadata?.targetedWeakArea) {
        return question;
      }

      return {
        ...question,
        mistakePriority: metadata,
      };
    });

    if (
      priorityOverride.overrideApplied &&
      priorityOverride.metadata?.targetedWeakArea &&
      generatedWithPriority.length > 0 &&
      !generatedWithPriority.some((question) => Boolean((question as { mistakePriority?: unknown }).mistakePriority))
    ) {
      generatedWithPriority[0] = {
        ...generatedWithPriority[0],
        mistakePriority: priorityOverride.metadata,
      };
    }

    const finalQuestions = priorityOverride.overrideApplied
      ? [...generatedWithPriority].sort((left, right) => {
          const leftPriority = (left as { mistakePriority?: { priorityScore?: number; targetedWeakArea?: boolean } }).mistakePriority;
          const rightPriority = (right as { mistakePriority?: { priorityScore?: number; targetedWeakArea?: boolean } }).mistakePriority;

          const leftTargeted = leftPriority?.targetedWeakArea ? 1 : 0;
          const rightTargeted = rightPriority?.targetedWeakArea ? 1 : 0;
          if (leftTargeted !== rightTargeted) {
            return rightTargeted - leftTargeted;
          }

          return (rightPriority?.priorityScore ?? 0) - (leftPriority?.priorityScore ?? 0);
        })
      : generatedWithPriority;

    void ingestIntelligenceEvent({
      userId: String(userId),
      eventType: "learning.behavior.tracked",
      payload: {
        module: "mcq-generation",
        topicName: topic,
        score: 70,
        confidence: 70,
        retries: 0,
        difficultyPreference:
          difficulty === "Beginner"
            ? "easy"
            : difficulty === "Intermediate"
              ? "medium"
              : "hard",
      },
      source: "api/mcq/generate",
    }).catch((intelligenceError) => {
      console.error("[api/mcq/generate] intelligence event failed", intelligenceError);
    });

    return NextResponse.json({
      success: true,
      mcqs: finalQuestions,
      sessionId: `mcq_${Date.now()}`,
    });
  } catch (error) {
    console.error("MCQ Generation Error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate MCQs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
