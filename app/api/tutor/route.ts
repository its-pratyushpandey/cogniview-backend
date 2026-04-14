import { NextResponse } from "next/server";
import { callGeminiAPI } from "@/lib/gemini-utils";
import { ingestIntelligenceEvent } from "@/features/intelligence/services/intelligence.server";

const TUTOR_SYSTEM_PROMPT = `You are an AI Engineering Placement Tutor specialized in computer science subjects for Indian college placements and interviews.

**YOUR ROLE:**
- You are NOT a general chatbot - You ONLY teach: Operating Systems, DBMS, OOPS, Computer Networks, Data Structures & Algorithms
- You adapt your teaching based on student performance
- You explain concepts using placement interview patterns
- You refuse off-topic questions politely

**TEACHING METHODOLOGY:**
1. **Explain Concept**: Start with practical, interview-focused explanation (not pure theory)
2. **Check Understanding**: Ask 2-3 viva-style questions
3. **Test with MCQ**: Give 1-2 tricky placement-level MCQs
4. **Apply with Problem**: Give coding/logic problem if applicable
5. **Analyze Mistakes**: If student fails, identify exact gap
6. **Re-teach**: Explain weak concept differently with examples
7. **Progressive Difficulty**: Increase difficulty only after mastery

**CONTEXT:**
Subject: {{SUBJECT}}
Topic: {{TOPIC}}
Student's Current Level: {{DIFFICULTY_LEVEL}}/10
Previously Weak Concepts: {{WEAK_CONCEPTS}}
Previously Mastered: {{MASTERED_CONCEPTS}}

**ADAPTIVE RULES:**
- If student answers correctly 3 times → Increase difficulty
- If student fails 2 times → Decrease difficulty and re-explain
- Always relate to real interview scenarios (e.g., "Amazon asks this as...")
- Use Indian placement company examples (TCS, Infosys, Wipro, Google India)

**RESPONSE FORMAT:**
- Keep explanations concise (3-5 sentences max initially)
- Use bullet points for clarity
- Provide diagrams in ASCII art when helpful
- Always end with a question to check understanding

**Current Student Question:**
{{STUDENT_MESSAGE}}

**Your Response:**`;

export async function POST(req: Request) {
  try {
    const {
      userId,
      subject,
      topic,
      message,
      sessionId,
      weakConcepts = [],
      masteredConcepts = [],
      difficultyLevel = 5,
    } = await req.json();

    if (!userId || !subject || !topic || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Replace placeholders in the prompt
    const prompt = TUTOR_SYSTEM_PROMPT.replace("{{SUBJECT}}", subject)
      .replace("{{TOPIC}}", topic)
      .replace("{{DIFFICULTY_LEVEL}}", difficultyLevel.toString())
      .replace(
        "{{WEAK_CONCEPTS}}",
        weakConcepts.length > 0 ? weakConcepts.join(", ") : "None yet"
      )
      .replace(
        "{{MASTERED_CONCEPTS}}",
        masteredConcepts.length > 0 ? masteredConcepts.join(", ") : "None yet"
      )
      .replace("{{STUDENT_MESSAGE}}", message);

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
          error: "Failed to get tutor response",
          details: geminiResponse.error || "Unknown error",
          retryable: geminiResponse.error?.includes("rate limit") || 
                     geminiResponse.error?.includes("Too Many Requests"),
        },
        { status: 503 }
      );
    }

    const aiResponse = geminiResponse.text ||
      "I apologize, but I couldn't generate a response. Please try again.";

    const responseLower = aiResponse.toLowerCase();
    let score = 68;
    if (/(great|excellent|correct|well done|perfect)/.test(responseLower)) {
      score = 86;
    } else if (/(good|nice|solid)/.test(responseLower)) {
      score = 74;
    } else if (/(not quite|incorrect|mistake|revise|wrong|revisit)/.test(responseLower)) {
      score = 44;
    }

    void ingestIntelligenceEvent({
      userId,
      eventType: "learning.behavior.tracked",
      payload: {
        module: "tutor",
        topicName: topic,
        score,
        confidence: score,
        retries: 0,
        difficultyPreference: score <= 45 ? "easy" : score <= 72 ? "medium" : "hard",
      },
      source: "api/tutor",
    }).catch((intelligenceError) => {
      console.error("[api/tutor] intelligence event failed", intelligenceError);
    });

    return NextResponse.json({
      success: true,
      response: aiResponse,
      sessionId: sessionId || `session_${Date.now()}`,
      ...(geminiResponse.retries && { retries: geminiResponse.retries }),
    });
  } catch (error) {
    console.error("Tutor API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to process tutor request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
