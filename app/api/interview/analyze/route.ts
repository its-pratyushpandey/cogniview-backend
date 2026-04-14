import { NextResponse } from "next/server";
import { callGeminiAPI, parseGeminiJSON } from "@/lib/gemini-utils";
import {
  buildInterviewContextFromResume,
  getLatestUserResumeAnalysis,
} from "@/features/resume-analysis/services/resume-analysis.server";
import { ingestIntelligenceEvent } from "@/features/intelligence/services/intelligence.server";

const WEAKNESS_DETECTOR_PROMPT = `Analyze this interview transcript and identify weak topics that need tutoring.

**TRANSCRIPT:**
{{INTERVIEW_TRANSCRIPT}}

**SUBJECTS COVERED:**
{{SUBJECTS}} (e.g., DBMS, OS, OOPS, DSA)

**YOUR TASK:**
Identify:
1. Topics where the candidate gave SHALLOW or INCORRECT answers
2. Concepts the candidate AVOIDED or couldn't explain
3. Terminology misuse or confusion
4. Lack of depth in explanations

**RESPONSE FORMAT (JSON ONLY):**
{
  "weakTopics": [
    {
      "subject": "DBMS",
      "topic": "Normalization",
      "reason": "Could not explain 3NF, confused with 2NF",
      "severity": "HIGH",
      "suggestedFocus": "3NF vs BCNF with examples"
    }
  ],
  "overallReadiness": 45,
  "recommendedAction": "START_TUTOR",
  "prioritySubject": "DBMS"
}

Analyze now:`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      transcript,
      userId,
      subjects = ["DBMS", "OS", "OOPS", "DSA", "CN"],
      mode,
    } = body as {
      transcript: Array<{ role: string; content: string }>;
      userId?: string;
      subjects?: string[];
      mode?: "realtime" | "final";
    };

    const analysisMode = mode === "realtime" ? "realtime" : "final";

    if (!transcript || !Array.isArray(transcript)) {
      return NextResponse.json(
        { error: "Invalid transcript format" },
        { status: 400 }
      );
    }

    const transcriptWindow =
      analysisMode === "realtime" ? transcript.slice(Math.max(0, transcript.length - 14)) : transcript;

    // Format transcript for analysis
    const formattedTranscript = transcriptWindow
      .map(
        (msg: { role: string; content: string }) =>
          `${msg.role.toUpperCase()}: ${msg.content}`
      )
      .join("\n\n");

    let prompt = WEAKNESS_DETECTOR_PROMPT.replace(
      "{{INTERVIEW_TRANSCRIPT}}",
      formattedTranscript
    ).replace("{{SUBJECTS}}", subjects.join(", "));

    if (analysisMode !== "realtime" && typeof userId === "string" && userId.trim()) {
      const latestResume = await getLatestUserResumeAnalysis(userId.trim());
      if (latestResume) {
        const resumeContext = buildInterviewContextFromResume(latestResume.intelligence);
        if (resumeContext) {
          prompt = `${prompt}\n\n**RESUME INTELLIGENCE CONTEXT:**\n${resumeContext}\nPrioritize overlap between transcript gaps and resume weaknesses.`;
        }
      }
    }

    // Call Gemini API with retry and rate limiting
    const geminiResponse = await callGeminiAPI({
      prompt,
      temperature: analysisMode === "realtime" ? 0.25 : 0.3,
      maxOutputTokens: analysisMode === "realtime" ? 900 : 2048,
      topP: analysisMode === "realtime" ? 0.9 : 0.95,
    });

    if (!geminiResponse.success) {
      return NextResponse.json(
        {
          error: "Failed to analyze interview",
          details: geminiResponse.error || "Unknown error",
          retryable: geminiResponse.error?.includes("rate limit") || 
                     geminiResponse.error?.includes("Too Many Requests"),
        },
        { status: 503 }
      );
    }

    // Parse JSON response
    const analysis = parseGeminiJSON(geminiResponse.text);

    if (!analysis) {
      return NextResponse.json(
        { error: "Failed to parse analysis", details: "Invalid JSON format" },
        { status: 500 }
      );
    }

    if (analysisMode !== "realtime" && typeof userId === "string" && userId.trim()) {
      try {
        await ingestIntelligenceEvent({
          userId: userId.trim(),
          eventType: "interview.analysis.completed",
          payload: {
            analysis,
          },
          source: "api/interview/analyze",
        });
      } catch (intelligenceError) {
        console.error("[api/interview/analyze] intelligence event failed", intelligenceError);
      }
    }

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Interview Analysis Error:", error);
    return NextResponse.json(
      {
        error: "Failed to analyze interview",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
