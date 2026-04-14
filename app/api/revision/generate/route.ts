import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { callGeminiAPI } from "@/lib/gemini-utils";
import { ingestIntelligenceEvent } from "@/features/intelligence/services/intelligence.server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      userId, 
      subject, 
      topic, 
      revisionType, 
      companyType,
      weakTopics = [] 
    } = body;

    if (!userId || !subject || !topic || !revisionType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Build the Gemini prompt based on revision type
    const prompt = buildRevisionPrompt(subject, topic, revisionType, companyType, weakTopics);

    // Call Gemini API with retry and rate limiting
    const geminiResponse = await callGeminiAPI({
      prompt,
      temperature: 0.7,
      maxOutputTokens: 2500,
      topP: 0.95,
      topK: 40,
    });

    if (!geminiResponse.success) {
      return NextResponse.json(
        {
          error: "Failed to generate revision content",
          details: geminiResponse.error || "Unknown error",
          retryable: geminiResponse.error?.includes("rate limit") || 
                     geminiResponse.error?.includes("Too Many Requests"),
        },
        { status: 503 }
      );
    }

    const generatedContent = geminiResponse.text || "";

    // Save to Firestore
    const revisionRef = await db.collection("revisions").add({
      userId,
      subject,
      topic,
      revisionType,
      companyType: companyType || null,
      weakTopics,
      content: generatedContent,
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
    });

    try {
      await ingestIntelligenceEvent({
        userId,
        eventType: "learning.behavior.tracked",
        payload: {
          module: "revision",
          topicName: topic,
          score: Math.max(40, 78 - weakTopics.length * 5),
          retries: 0,
          confidence: Math.max(40, 78 - weakTopics.length * 5),
          difficultyPreference: "medium",
        },
        source: "api/revision/generate",
      });

      await ingestIntelligenceEvent({
        userId,
        eventType: "progress.topic.updated",
        payload: {
          subject,
          topicName: topic,
          score: Math.max(40, 78 - weakTopics.length * 5),
          retries: 0,
          responseTimeMs: Math.max(1200, generatedContent.length * 2),
        },
        source: "api/revision/generate",
      });
    } catch (intelligenceError) {
      console.error("[api/revision/generate] intelligence event failed", intelligenceError);
    }

    return NextResponse.json({
      success: true,
      revisionId: revisionRef.id,
      content: generatedContent,
    });
  } catch (error) {
    console.error("Error generating revision material:", error);
    return NextResponse.json(
      { error: "Failed to generate revision material" },
      { status: 500 }
    );
  }
}

function buildRevisionPrompt(
  subject: string,
  topic: string,
  revisionType: string,
  companyType: string | undefined,
  weakTopics: string[]
): string {
  const weakTopicsText = weakTopics.length > 0 
    ? `\n\n**USER'S WEAK AREAS:** ${weakTopics.join(", ")}\nPay special attention to these weak areas and include extra explanations.`
    : "";

  const basePrompt = `Generate smart revision material for **${subject} - ${topic}**.

**REVISION TYPE:** ${revisionType}${weakTopicsText}

${companyType ? `**TARGET COMPANY TYPE:** ${companyType} companies\n` : ""}`;

  switch (revisionType) {
    case "5-minute-quick":
      return `${basePrompt}
**FORMAT FOR 5-MINUTE-QUICK:**
- 5 key points (bullet form) - must be crisp and memorable
- 2 most common interview questions with concise answers
- 1 common trap/mistake to avoid with explanation

Generate the content in a clear, structured format:`;

    case "last-day-notes":
      return `${basePrompt}
**FORMAT FOR LAST-DAY-NOTES:**
- Must-know definitions (5-7 essential terms with clear definitions)
- Most asked interview questions (10 questions with brief answers)
- Quick revision formulas/algorithms (if applicable)
- Common mistakes candidates make (at least 3)

Generate comprehensive last-day revision notes:`;

    case "one-pager":
      return `${basePrompt}
**FORMAT FOR ONE-PAGER:**
Create a visual, single-page format using ASCII art, tables, and diagrams:
- Core concepts map (show relationships between concepts)
- Quick decision tree for problem-solving
- Interview cheat sheet (key points at a glance)
- Visual flowcharts using ASCII art where applicable

Generate a comprehensive one-pager:`;

    case "most-asked-questions":
      return `${basePrompt}
**FORMAT FOR MOST-ASKED-QUESTIONS:**
Generate top 15 questions from ${companyType || "tech"} companies:
- Each question with brief answer (2-3 lines)
- Follow-up questions to expect (2-3 per question)
- Difficulty level indicator (Easy/Medium/Hard)
- Tips for answering each question

Generate the most-asked interview questions:`;

    default:
      return basePrompt;
  }
}
