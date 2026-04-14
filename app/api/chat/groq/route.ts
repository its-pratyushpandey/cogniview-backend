import { NextResponse } from "next/server";
import { callGeminiAPI, createGeminiNDJSONStream } from "@/lib/gemini-utils";

interface ChatMessage {
  role: string;
  text: string;
}

export async function POST(req: Request) {
  try {
    // Check if API key exists
    if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
      console.error("❌ GROQ_API_KEY not found in environment variables");
      return NextResponse.json(
        {
          error: "GROQ_API_KEY not configured",
          details: "Please add GROQ_API_KEY to your .env.local file",
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { messages, maxTokens = 1000, temperature = 0.7, stream = false } = body as {
      messages: ChatMessage[];
      maxTokens?: number;
      temperature?: number;
      stream?: boolean;
    };

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        {
          error: "Invalid messages format",
          details: "Messages must be a non-empty array",
        },
        { status: 400 }
      );
    }

    const historyWindow = 16;
    const maxMessageChars = 2000;

    // Build conversation prompt (bounded so latency doesn't grow with chat length)
    const recentMessages = messages.slice(-historyWindow);
    const conversationHistory = recentMessages
      .map((msg: ChatMessage) =>
        `${msg.role === "user" ? "User" : "Kiki"}: ${msg.text.slice(0, maxMessageChars)}`
      )
      .join("\n");

    const prompt = `You are Kiki, a professional AI assistant for the Cogniview interview platform. You can:
1. Answer questions conversationally about interviews, careers, and technology
2. Execute actions by responding with JSON in this exact format: {"type":"action","action":"ACTION_NAME","params":{...}}

Available actions:
- fetch_github_stats: {"owner":"string","repo":"string"}
- fetch_weather: {"location":"string"}
- create_todo: {"text":"string"}
- get_todos: {}
- update_todo: {"id":"string","completed":boolean}
- delete_todo: {"id":"string"}
- calculate: {"expression":"string"}
- get_time: {"timezone":"string"}
- search_web: {"query":"string"}
- open_company_prep: {}

Todo action guidance:
- Use get_todos when the user asks to list/show tasks.
- If the user asks to complete/delete by text, call get_todos first, then use the matching id in update_todo/delete_todo.
- Keep todo text concise and actionable.

You specialize in helping users with:
- Interview preparation tips
- Company-specific preparation strategy and role targeting
- Technical questions about programming
- Career advice
- Job search strategies
- Technology trends

Keep responses helpful, professional, and encouraging.

Conversation:
${conversationHistory}

Kiki:`;

    // Try multiple Groq models for better reliability
    const models = [
      { name: "llama-3.1-8b-instant", model: "llama-3.1-8b-instant" },
      { name: "llama-3.3-70b-versatile", model: "llama-3.3-70b-versatile" },
      { name: "mixtral-8x7b-32768", model: "mixtral-8x7b-32768" },
    ];

    if (stream) {
      const ndjsonStream = createGeminiNDJSONStream({
        prompt,
        temperature: Math.min(Math.max(temperature, 0), 1),
        maxOutputTokens: Math.min(Math.max(maxTokens, 1), 2048),
        topP: 0.95,
        models: models.map((m) => m.model),
        signal: req.signal,
      });

      return new Response(ndjsonStream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    let response: { output: string; model: string } | null = null;
    let lastError: string | null = null;

    for (const candidate of models) {
      try {
        console.log(`🔄 Trying: ${candidate.name}`);

        const llmResponse = await callGeminiAPI({
          prompt,
          temperature: Math.min(Math.max(temperature, 0), 1),
          maxOutputTokens: Math.min(maxTokens, 2048),
          topP: 0.95,
          model: candidate.model,
        });

        if (llmResponse.success) {
          const output =
            llmResponse.text || "Sorry, I couldn't generate a response.";
          console.log(`✅ Success with: ${candidate.name}`);
          response = { output, model: candidate.name };
          break;
        }

        console.log(`❌ Error with ${candidate.name}: ${llmResponse.error}`);
        lastError = `${candidate.name}: ${llmResponse.error}`;
      } catch (error) {
        console.log(`❌ Error with ${candidate.name}:`, error);
        lastError = error instanceof Error ? error.message : String(error);
        continue;
      }
    }

    if (!response) {
      console.error("All Groq models failed:", lastError);

      // Provide a fallback response instead of just failing
      const fallbackResponse = {
        output:
          "I'm having trouble connecting to my AI service right now. Here are some things I can help you with:\n\n• Interview preparation tips\n• Career advice\n• Technical questions about programming\n• Job search strategies\n\nPlease try your question again in a moment, or ask me something specific about interview preparation!",
        model: "fallback",
        isFallback: true,
      };

      return NextResponse.json(fallbackResponse);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
