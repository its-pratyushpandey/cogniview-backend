import { NextResponse } from "next/server";
import { callGeminiAPI, parseGeminiJSON } from "@/lib/gemini-utils";
import { z } from "zod";
import {
  MISTAKE_PRIORITY_THRESHOLD,
  annotateCandidatesWithMistakePriority,
  resolveMistakePriorityTopicOverride,
} from "@/features/intelligence/engine/mistake-priority";

const vivaEvaluationSchema = z.object({
  quality: z.enum(["GOOD", "AVERAGE", "POOR"]),
  score: z.number(),
  reasoning: z.string(),
  keyIssues: z.array(z.string()),
  nextStrategy: z.string(),
});

const vivaQuestionBaseSchema = z.object({
  nextQuestion: z.string(),
  questionType: z.enum([
    "BASE",
    "FOLLOWUP",
    "TRAP",
    "SCENARIO",
    "CLARIFICATION",
  ]),
  difficulty: z.number(),
  evaluationOfPreviousAnswer: vivaEvaluationSchema.nullable(),
  hints: z.array(z.string()),
  expectedAnswerKeywords: z.array(z.string()),
});

const vivaQuestionSchema = vivaQuestionBaseSchema.extend({
  mcqOptions: z.array(z.string()).length(4),
  correctOptionIndex: z.number().int().min(0).max(3),
});

function buildFallbackMcqOptions(
  expectedAnswerKeywords: string[],
  topic: string,
): Pick<VivaQuestion, "mcqOptions" | "correctOptionIndex"> {
  const normalizedKeywords = expectedAnswerKeywords
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 3);

  const correctLead =
    normalizedKeywords.length > 0
      ? `It correctly explains ${topic} using ${normalizedKeywords.join(", ")}.`
      : `It correctly explains ${topic} with accurate terminology and core concepts.`;

  return {
    mcqOptions: [
      correctLead,
      `It gives a partial definition of ${topic} but skips the key mechanism.`,
      `It confuses ${topic} with a related concept and reaches the wrong conclusion.`,
      `It focuses on unrelated implementation details instead of the core concept of ${topic}.`,
    ],
    correctOptionIndex: 0,
  };
}

const VIVA_CHAIN_PROMPT = `You are conducting a technical viva for interview preparation with adaptive questioning.

**CONTEXT:**
- Subject: {{SUBJECT}}
- Base Topic: {{BASE_TOPIC}}
- Conversation History:
{{HISTORY}}

**VIVA STRATEGY:**
1. **Base Question**: Start with fundamental concept
2. **Follow-up Logic**:
   - If answer is GOOD (8-10/10): Ask deeper/related concept or edge case
   - If answer is AVERAGE (5-7/10): Ask clarifying question on same topic
   - If answer is POOR (1-4/10): Ask simpler foundational question
3. **Trap Question**: After 2-3 correct answers, ask a common interview trap
4. **Practical Scenario**: "In a real project, when would you NOT use X?"
5. **MCQ FORMAT**: Every question MUST be a single-best-answer MCQ with exactly 4 options.

**MCQ REQUIREMENTS:**
- Provide exactly 4 options in \`mcqOptions\`.
- Keep one clearly correct answer and three plausible distractors.
- Keep options concise, non-overlapping, and interview-relevant.
- Set \`correctOptionIndex\` to the correct option position (0-based).
- Do NOT add "all of the above" or "none of the above".

**EVALUATION SCALE:**
- GOOD (8-10): Accurate, uses proper terminology, shows depth
- AVERAGE (5-7): Partially correct, missing details or precision
- POOR (1-4): Incorrect, confused, or incomplete understanding

**RESPONSE FORMAT (JSON ONLY):**
{
  "nextQuestion": "Your next question based on previous answer",
  "questionType": "BASE|FOLLOWUP|TRAP|SCENARIO|CLARIFICATION",
  "difficulty": 6,
  "evaluationOfPreviousAnswer": {
    "quality": "GOOD|AVERAGE|POOR",
    "score": 7,
    "reasoning": "Why you classified it so - be specific about what was right/wrong",
    "keyIssues": ["Specific problem 1", "Specific problem 2"],
    "nextStrategy": "What to ask next and why"
  },
  "hints": [
    "If student struggles, provide these progressive hints"
  ],
  "expectedAnswerKeywords": [
    "Keywords you expect in a good answer"
  ],
  "mcqOptions": [
    "Option A",
    "Option B",
    "Option C",
    "Option D"
  ],
  "correctOptionIndex": 1
}

**EXAMPLE FLOWS:**

**Flow 1 - Good Student:**
Q1: "What is normalization?" → [Good answer] 
→ Q2: "Why is 3NF preferred over 2NF in most cases?"
→ [Good answer]
→ Q3 (Trap): "Is higher normalization always better for performance?"
→ [Tests nuanced understanding]

**Flow 2 - Struggling Student:**
Q1: "What is a deadlock?" → [Poor/confused answer]
→ Q2 (Simpler): "Can you explain what happens when two processes wait for each other?"
→ [Average answer]
→ Q3 (Clarification): "What are the four necessary conditions for deadlock?"

**Flow 3 - Mixed Performance:**
Q1: "Explain indexing in databases" → [Average answer - knows basics but shallow]
→ Q2 (Depth): "What's the difference between clustered and non-clustered index?"
→ [Good answer]
→ Q3 (Practical): "When would you avoid creating an index?"

**IMPORTANT RULES:**
1. Only ONE question at a time
2. Be conversational, not interrogative ("Can you explain..." not "Explain...")
3. If student chooses a wrong option, provide a hint and adapt difficulty
4. After 3 poor answers on same topic, switch to different concept
5. Keep difficulty adaptive - don't jump too high or stay too low

{{SPECIAL_INSTRUCTION}}

Generate next question:`;

interface ConversationMessage {
  role: "assistant" | "user";
  content: string;
}

export async function POST(req: Request) {
  try {
    const { 
      userId,
      subject, 
      baseTopic, 
      conversationHistory = [], 
      isFirstQuestion = false 
    } = await req.json();

    if (!subject || !baseTopic) {
      return NextResponse.json(
        { error: "Subject and baseTopic are required" },
        { status: 400 }
      );
    }

    // Format conversation history
    let historyStr = "";
    if (conversationHistory.length > 0) {
      historyStr = conversationHistory
        .map((msg: ConversationMessage, idx: number) => 
          `${idx + 1}. ${msg.role.toUpperCase()}: ${msg.content}`
        )
        .join("\n\n");
    } else {
      historyStr = "No previous conversation - this is the first question.";
    }

    // Special instruction for first question
    let effectiveBaseTopic = baseTopic;
    let priorityInstruction = "";
    let priorityContext: Awaited<ReturnType<typeof resolveMistakePriorityTopicOverride>> | null = null;

    if (typeof userId === "string" && userId.trim()) {
      priorityContext = await resolveMistakePriorityTopicOverride({
        userId: userId.trim(),
        selectedTopic: baseTopic,
        subject,
        threshold: MISTAKE_PRIORITY_THRESHOLD,
        sessionKey: `viva:${userId.trim()}:${subject}`,
      });

      effectiveBaseTopic = priorityContext.selectedTopic;

      if (priorityContext.overrideApplied && priorityContext.metadata?.reason) {
        priorityInstruction =
          `**MISTAKE-PRIORITY OVERRIDE:** ${priorityContext.metadata.reason}. ` +
          `Prioritize the next question around ${effectiveBaseTopic} before normal progression.`;
      }
    }

    const specialInstruction = isFirstQuestion
      ? `**SPECIAL**: This is the FIRST question. Start with a fundamental concept question about ${effectiveBaseTopic}. Set difficulty to 3-4/10. Your response should have evaluationOfPreviousAnswer set to null for the first question.`
      : "";

    const combinedInstruction = [specialInstruction, priorityInstruction].filter(Boolean).join("\n");

    const prompt = VIVA_CHAIN_PROMPT
      .replace("{{SUBJECT}}", subject)
      .replace("{{BASE_TOPIC}}", effectiveBaseTopic)
      .replace("{{HISTORY}}", historyStr)
      .replace("{{SPECIAL_INSTRUCTION}}", combinedInstruction);

    // Call Gemini API with retry and rate limiting
    const geminiResponse = await callGeminiAPI({
      prompt,
      temperature: 0.7,
      maxOutputTokens: 1024,
      topP: 0.9,
    });

    if (!geminiResponse.success) {
      return NextResponse.json(
        {
          error: "Failed to generate viva question",
          details: geminiResponse.error || "Unknown error",
          retryable: geminiResponse.error?.includes("rate limit") || 
                     geminiResponse.error?.includes("Too Many Requests"),
        },
        { status: 503 } // Service Unavailable - indicates client should retry
      );
    }

    // Parse + validate JSON response
    const parsed = parseGeminiJSON<unknown>(geminiResponse.text);
    const validated = vivaQuestionSchema.safeParse(parsed);

    const normalizedVivaData = validated.success
      ? validated.data
      : (() => {
          const legacyValidated = vivaQuestionBaseSchema.safeParse(parsed);
          if (!legacyValidated.success) return null;

          return {
            ...legacyValidated.data,
            ...buildFallbackMcqOptions(
              legacyValidated.data.expectedAnswerKeywords,
              effectiveBaseTopic,
            ),
          };
        })();

    if (!normalizedVivaData) {
      return NextResponse.json(
        {
          error: "Failed to parse AI response",
          details: "Invalid JSON format or schema mismatch received",
        },
        { status: 500 }
      );
    }

    let mistakePriority = priorityContext?.metadata ?? null;

    if (priorityContext) {
      const metadata = annotateCandidatesWithMistakePriority({
        context: priorityContext.context,
        candidates: [
          {
            tags: normalizedVivaData.expectedAnswerKeywords,
            topic: effectiveBaseTopic,
            subject,
            text: normalizedVivaData.nextQuestion,
          },
        ],
        threshold: MISTAKE_PRIORITY_THRESHOLD,
      })[0]?.metadata;

      if (metadata?.targetedWeakArea) {
        mistakePriority = metadata;
      }
    }

    const viva: VivaQuestion = {
      ...normalizedVivaData,
      evaluationOfPreviousAnswer: isFirstQuestion
        ? null
        : normalizedVivaData.evaluationOfPreviousAnswer,
      ...(mistakePriority?.targetedWeakArea
        ? {
            mistakePriority,
          }
        : {}),
    };

    return NextResponse.json({
      success: true,
      viva,
      ...(geminiResponse.retries && { retries: geminiResponse.retries }),
    });
  } catch (error) {
    console.error("Viva Chain Error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate viva question",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
