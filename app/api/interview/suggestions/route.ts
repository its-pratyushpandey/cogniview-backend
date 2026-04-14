import { NextResponse } from "next/server";
import { callGeminiAPI, parseGeminiJSON } from "@/lib/gemini-utils";

const MIN_TRANSCRIPT_ENTRIES = 2;
const MAX_TRANSCRIPT_ENTRIES = 120;
const MIN_TRANSCRIPT_CHARACTERS = 60;

type TranscriptEntry = { role: string; content: string };

function normalizeTranscript(transcript: unknown): TranscriptEntry[] {
  if (!Array.isArray(transcript)) return [];

  return transcript
    .map((entry) => {
      const role =
        typeof entry?.role === "string"
          ? entry.role.trim().toLowerCase().slice(0, 30)
          : "";
      const content =
        typeof entry?.content === "string"
          ? entry.content.replace(/\s+/g, " ").trim()
          : "";

      return { role, content };
    })
    .filter((entry) => entry.role.length > 0 && entry.content.length > 0)
    .slice(-MAX_TRANSCRIPT_ENTRIES);
}

const SUGGESTIONS_PROMPT = `Analyze this interview transcript and provide detailed improvement suggestions.

**TRANSCRIPT:**
{{TRANSCRIPT}}

**INSTRUCTIONS:**
1. Identify weak or incomplete answers
2. For EACH weak answer, provide comprehensive feedback
3. Return JSON array with structured suggestions

**OUTPUT FORMAT:**
{
  "suggestions": [
    {
      "questionAsked": "The original question from the interview",
      "userAnswer": "What the user actually said",
      "issues": ["Specific issue 1", "Specific issue 2", "Specific issue 3"],
      "modelAnswer": "How a STRONG candidate would answer this comprehensively with technical depth and clear structure",
      "rephrasingSuggestion": "A better way to phrase the user's existing knowledge to sound more professional and confident",
      "additionalConcepts": ["Concept 1 that should be mentioned", "Concept 2 to add depth", "Concept 3 for completeness"],
      "improvementScore": 7.5
    }
  ],
  "overallFeedback": "General advice on interview performance",
  "keyAreas": ["Area 1 to focus on", "Area 2 to improve", "Area 3 to master"]
}

**CRITERIA FOR WEAK ANSWERS:**
- Incomplete explanations
- Missing technical terms
- Lack of examples
- Unclear structure
- Factual errors

Focus on actionable, specific feedback. Be constructive.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const normalizedTranscript = normalizeTranscript(body?.transcript);

    if (normalizedTranscript.length < MIN_TRANSCRIPT_ENTRIES) {
      return NextResponse.json(
        {
          error:
            "Transcript must include at least two valid messages with speaker role and content",
        },
        { status: 400 }
      );
    }

    const totalCharacters = normalizedTranscript.reduce(
      (sum, entry) => sum + entry.content.length,
      0
    );

    if (totalCharacters < MIN_TRANSCRIPT_CHARACTERS) {
      return NextResponse.json(
        {
          error:
            "Transcript is too short for meaningful analysis. Please complete more of the interview.",
        },
        { status: 400 }
      );
    }

    // Format transcript for analysis
    const formattedTranscript = normalizedTranscript
      .map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`)
      .join("\n\n");

    const prompt = SUGGESTIONS_PROMPT.replace("{{TRANSCRIPT}}", formattedTranscript);

    const llmResponse = await callGeminiAPI({
      prompt,
      temperature: 0.7,
      maxOutputTokens: 4000,
      topP: 0.95,
      model: "llama-3.3-70b-versatile",
    });

    const suggestionsData = parseGeminiJSON(llmResponse.text);
    const hasSuggestionsArray = Array.isArray(
      (suggestionsData as { suggestions?: unknown })?.suggestions
    );

    if (!llmResponse.success || !suggestionsData || !hasSuggestionsArray) {
      return NextResponse.json(
        {
          error: "Failed to generate suggestions",
          details: llmResponse.error || "Invalid JSON from model",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(suggestionsData);
  } catch (error: unknown) {
    console.error("Error generating suggestions:", error);
    return NextResponse.json(
      {
        error: "Failed to generate suggestions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
