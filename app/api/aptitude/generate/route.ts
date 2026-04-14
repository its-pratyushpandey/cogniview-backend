import { NextResponse } from "next/server";
import { callGeminiAPI, parseGeminiJSON } from "@/lib/gemini-utils";
import {
  getIntelligenceSnapshot,
  ingestIntelligenceEvent,
} from "@/features/intelligence/services/intelligence.server";
import {
  MISTAKE_PRIORITY_THRESHOLD,
  annotateCandidatesWithMistakePriority,
  resolveMistakePriorityTopicOverride,
} from "@/features/intelligence/engine/mistake-priority";

const APTITUDE_TRAINER_PROMPT = `You are an AI Aptitude Trainer for placement preparation.

**TOPIC:** {{TOPIC}} (Time & Work / Puzzles / Seating Arrangement / Number Series / etc.)

**STUDENT PERFORMANCE HISTORY:**
- Attempts: {{ATTEMPTS}}
- Success Rate: {{SUCCESS_RATE}}%
- Average Time: {{AVG_TIME}} seconds
- Common Mistakes: {{COMMON_MISTAKES}}

**YOUR TASK:**
1. Generate a {{DIFFICULTY}} level {{TOPIC}} problem
2. Provide hints if student is stuck (progressive hints)
3. After answer, show:
   - Correct/Incorrect
   - Time taken vs expected time
   - Shortcut method (if exists)
   - Pattern recognition tip
   - Similar problem type for practice

**RESPONSE FORMAT (JSON ONLY):**
{
  "id": "unique_id",
  "statement": "Clear problem statement for a Multiple Choice Question",
  "options": [
    "A) Option 1",
    "B) Option 2",
    "C) Option 3",
    "D) Option 4"
  ],
  "difficulty": "Easy/Medium/Hard",
  "expectedTime": 120,
  "answerFormat": "Multiple Choice",
  "hints": [
    "Hint 1: Start by identifying...",
    "Hint 2: Use the formula...",
    "Hint 3: Direct solution path..."
  ],
  "answer": "A) Option 1",
  "solutionMethods": [
    {
      "name": "Method 1",
      "steps": ["Step 1...", "Step 2..."],
      "time": "2 mins"
    }
  ],
  "learningTip": "For Time & Work problems, always convert to efficiency first",
  "relatedTopics": ["Topic 1", "Topic 2"]
}

Generate problem:`;

export async function POST(req: Request) {
  try {
    const {
      userId,
      topic,
      difficulty = "Medium",
      attempts = 0,
      successRate = 0,
      avgTime = 0,
      commonMistakes = [],
    } = await req.json();

    if (!userId || !topic) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    let weakAreas: string[] = [];
    let targetRole: string | null = null;
    const priorityOverride = await resolveMistakePriorityTopicOverride({
      userId: String(userId),
      selectedTopic: topic,
      subject: "Aptitude",
      threshold: MISTAKE_PRIORITY_THRESHOLD,
      sessionKey: `aptitude:${String(userId)}:${topic}`,
    });
    const effectiveTopic = priorityOverride.selectedTopic;

    try {
      const snapshot = await getIntelligenceSnapshot(String(userId));
      weakAreas = snapshot.weakAreas.slice(0, 6);
      targetRole = snapshot.context.targetRole;
    } catch {
      // Continue without snapshot context.
    }

    // Replace placeholders in the prompt
    const prompt = APTITUDE_TRAINER_PROMPT.replace("{{TOPIC}}", effectiveTopic)
      .replace("{{DIFFICULTY}}", difficulty)
      .replace("{{ATTEMPTS}}", attempts.toString())
      .replace("{{SUCCESS_RATE}}", successRate.toString())
      .replace("{{AVG_TIME}}", avgTime.toString())
      .replace(
        "{{COMMON_MISTAKES}}",
        commonMistakes.length > 0 ? commonMistakes.join(", ") : "None yet"
      )
      .concat(
        `\n\n**ADAPTIVE INTELLIGENCE CONTEXT:**\n` +
          `- Candidate weak areas: ${weakAreas.length > 0 ? weakAreas.join(", ") : "Not available"}\n` +
          `- Target role: ${targetRole ?? "Not set"}\n` +
          `- Mistake-priority override: ${
            priorityOverride.overrideApplied && priorityOverride.metadata?.reason
              ? `${priorityOverride.metadata.reason}. Prioritize ${effectiveTopic}.`
              : "Not active"
          }\n` +
          `Bias the generated problem towards weak areas when relevant.`
      );

    // Call Gemini API with retry and rate limiting
    const geminiResponse = await callGeminiAPI({
      prompt,
      temperature: 0.7,
      maxOutputTokens: 2048,
      topP: 0.95,
    });

    if (!geminiResponse.success) {
      return NextResponse.json(
        {
          error: "Failed to generate aptitude question",
          details: geminiResponse.error || "Unknown error",
          retryable: geminiResponse.error?.includes("rate limit") || 
                     geminiResponse.error?.includes("Too Many Requests"),
        },
        { status: 503 }
      );
    }

    // Parse JSON response
    const problemData = parseGeminiJSON(geminiResponse.text);

    if (!problemData || typeof problemData !== "object") {
      return NextResponse.json(
        { error: "Failed to parse aptitude data", details: "Invalid JSON format" },
        { status: 500 }
      );
    }

    const problemRecord = problemData as Record<string, unknown>;
    
    // Normalize schema in case Gemini hallucinates older format
    if (problemRecord.problem && !problemRecord.statement) {
      problemRecord.statement = problemRecord.problem;
    }
    if (problemRecord.correctAnswer && !problemRecord.answer) {
      problemRecord.answer = problemRecord.correctAnswer;
    }
    if (problemRecord.solution && !Array.isArray(problemRecord.solutionMethods)) {
      problemRecord.solutionMethods = [{
        name: "Method 1",
        steps: [JSON.stringify(problemRecord.solution)],
        time: "N/A"
      }];
    }

    const promptText =
      typeof problemRecord.statement === "string"
        ? problemRecord.statement
        : typeof problemRecord.problem === "string"
          ? problemRecord.problem
          : "";

    const metadata = annotateCandidatesWithMistakePriority({
      context: priorityOverride.context,
      candidates: [
        {
          tags: [effectiveTopic, ...commonMistakes.map((item: string) => String(item))],
          topic: effectiveTopic,
          subject: "Aptitude",
          text: promptText,
        },
      ],
      threshold: MISTAKE_PRIORITY_THRESHOLD,
    })[0]?.metadata;

    const problemWithPriority =
      metadata?.targetedWeakArea || priorityOverride.metadata?.targetedWeakArea
        ? {
            ...problemRecord,
            mistakePriority:
              metadata?.targetedWeakArea && metadata.reason
                ? metadata
                : priorityOverride.metadata,
          }
        : problemRecord;

    void ingestIntelligenceEvent({
      userId: String(userId),
      eventType: "learning.behavior.tracked",
      payload: {
        module: "aptitude-generation",
        topicName: topic,
        score: 68,
        confidence: 68,
        retries: 0,
        difficultyPreference:
          difficulty === "Easy" ? "easy" : difficulty === "Medium" ? "medium" : "hard",
      },
      source: "api/aptitude/generate",
    }).catch((intelligenceError) => {
      console.error("[api/aptitude/generate] intelligence event failed", intelligenceError);
    });

    return NextResponse.json({
      success: true,
      problem: problemWithPriority,
      sessionId: `aptitude_${Date.now()}`,
      ...(geminiResponse.retries && { retries: geminiResponse.retries }),
    });
  } catch (error) {
    console.error("Aptitude Problem Generation Error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate aptitude problem",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
