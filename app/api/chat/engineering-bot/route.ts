import { NextResponse } from "next/server";
import { callGeminiAPI } from "@/lib/gemini-utils";
import { getLatestUserResumeAnalysis } from "@/features/resume-analysis/services/resume-analysis.server";

const STRICT_ENGINEERING_CHATBOT_PROMPT = `You are an Engineering Placement Assistant. You ONLY help with computer science engineering topics.

**ALLOWED TOPICS:**
✅ Operating Systems, DBMS, OOPS, Computer Networks, Data Structures, Algorithms
✅ Interview preparation strategies
✅ Coding problems explanation
✅ Technical doubt clarification
✅ Placement company patterns
✅ System Design concepts
✅ Software Engineering principles

**STRICTLY FORBIDDEN:**
❌ General chat, weather, jokes, personal advice
❌ Non-engineering subjects (history, biology, finance, etc.)
❌ Homework completion or assignment solutions
❌ Unethical requests (cheating, plagiarism, hacking)
❌ Personal opinions on politics, religion, or controversial topics

**BEHAVIOR:**
1. If question is OFF-TOPIC: Respond EXACTLY with "I only help with engineering placement topics (OS, DBMS, DSA, CN, OOPS, etc.). Ask me something related to computer science or interview preparation!"
2. If question is ENGINEERING: Answer in interview-focused format
3. Use syllabus context (assume Indian B.Tech curriculum)
4. Provide ASCII diagrams when helpful
5. Always relate to interview scenarios
6. Keep responses concise (3-7 sentences for concepts, more for complex topics)

**RESPONSE STYLE:**
- Start with a brief definition
- Explain with examples
- Provide interview context
- Include "💡 Interview Tip" at end if applicable
- Use bullet points for clarity
- Add ASCII diagrams for visual concepts

**USER QUESTION:**
{{USER_MESSAGE}}

**YOUR RESPONSE:**`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, userId, conversationHistory } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const normalizedMessage = message.toLowerCase();
    const asksResumeAnalysis =
      /resume\s+analysis|analy(s|z)e\s+my\s+resume|resume\s+weakness|trigger\s+my\s+resume\s+analysis/.test(
        normalizedMessage
      );

    if (asksResumeAnalysis) {
      if (typeof userId !== "string" || !userId.trim()) {
        return NextResponse.json({
          message:
            "I could not access your account context. Open /resume-analysis to run the pipeline and then ask for your summary again.",
          isOffTopic: false,
        });
      }

      const latest = await getLatestUserResumeAnalysis(userId.trim());
      if (!latest) {
        return NextResponse.json({
          message:
            "No resume intelligence found yet. Go to /resume-analysis, upload your resume, and I can summarize your weak areas and next steps.",
          isOffTopic: false,
        });
      }

      const topWeaknesses = latest.intelligence.weaknesses.slice(0, 3);
      const focus = topWeaknesses.map((item) => `${item.topic}: ${item.reason}`).join("\n- ");
      const responseText = [
        "Resume intelligence summary:",
        `- Experience level: ${latest.intelligence.experienceLevel}`,
        `- Recommended roles: ${latest.intelligence.recommendedRoles.join(", ") || "Software Engineer"}`,
        topWeaknesses.length > 0 ? `- Top weak areas:\n- ${focus}` : "- No critical weak areas detected.",
        "Next step: generate adaptive questions in /resume-analysis (Weak Areas tab).",
      ].join("\n");

      return NextResponse.json({
        message: responseText,
        isOffTopic: false,
      });
    }

    // Build conversation context
    const historyText = conversationHistory
      ?.slice(-5) // Last 5 messages for context
      .map((msg: { role?: string; content?: string }) => {
        const role = msg.role === "user" ? "Student" : "Assistant";
        const content = typeof msg.content === "string" ? msg.content : "";
        return `${role}: ${content}`;
      })
      .join("\n\n") || "";

    const contextPrompt = historyText
      ? `**PREVIOUS CONVERSATION:**\n${historyText}\n\n${STRICT_ENGINEERING_CHATBOT_PROMPT}`
      : STRICT_ENGINEERING_CHATBOT_PROMPT;

    const prompt = contextPrompt.replace("{{USER_MESSAGE}}", message);

    const llmResponse = await callGeminiAPI({
      prompt,
      temperature: 0.7,
      maxOutputTokens: 1500,
      topP: 0.95,
      model: "llama-3.1-8b-instant",
    });

    const responseText = llmResponse.success
      ? llmResponse.text
      : "I can’t answer that right now — my AI service is temporarily unavailable. Please try again.";

    return NextResponse.json({
      message: responseText,
      isOffTopic: responseText.includes("I only help with engineering placement topics"),
    });
  } catch (error: unknown) {
    console.error("Error in engineering chatbot:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate response", details: message },
      { status: 500 }
    );
  }
}
