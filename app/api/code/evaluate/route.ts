import { NextResponse } from "next/server";
import { callGeminiAPI, parseGeminiJSON } from "@/lib/gemini-utils";
import { z } from "zod";
import { ingestIntelligenceEvent } from "@/features/intelligence/services/intelligence.server";

const codeEvaluationSchema = z.object({
  score: z.number().min(0).max(100).optional(),
  timeComplexity: z.string().optional(),
  spaceComplexity: z.string().optional(),
  codeQuality: z
    .object({
      readability: z.number().min(0).max(10).optional(),
      efficiency: z.number().min(0).max(10).optional(),
      correctness: z.number().min(0).max(10).optional(),
    })
    .optional(),
  suggestions: z.array(z.string()).optional(),
  strengths: z.array(z.string()).optional(),
  improvements: z.array(z.string()).optional(),
  geminiAnalysis: z.string().optional(),
});

const CODE_EVALUATION_PROMPT = `You are an expert code reviewer and algorithm analyst. Analyze this code submission thoroughly.

**CODE:**
\`\`\`{{LANGUAGE}}
{{CODE}}
\`\`\`

**PROBLEM:** {{PROBLEM_DESCRIPTION}}

**TEST RESULTS:**
{{TEST_RESULTS}}

**YOUR TASK:**
1. **Time Complexity** - Provide exact Big O notation with detailed explanation
2. **Space Complexity** - Analyze memory usage with explanation
3. **Code Quality** - Rate on three dimensions:
   - Readability (0-10): Variable names, code structure, comments
   - Efficiency (0-10): Algorithm choice, optimization level
   - Correctness (0-10): Logic accuracy, edge case handling
4. **Strengths** - List 2-3 specific things done well
5. **Improvements** - Provide 2-3 actionable suggestions for improvement
6. **Overall Score** - Provide a score from 0-100 based on all factors

**RESPONSE FORMAT (JSON ONLY, NO MARKDOWN):**
{
  "score": 85,
  "timeComplexity": "O(n)",
  "spaceComplexity": "O(1)",
  "codeQuality": {
    "readability": 8,
    "efficiency": 9,
    "correctness": 10
  },
  "suggestions": [
    "Use more descriptive variable names like 'leftPointer' instead of 'i'",
    "Add edge case handling for empty input"
  ],
  "strengths": [
    "Efficient algorithm with optimal time complexity",
    "Clean and well-structured code"
  ],
  "improvements": [
    "Consider using a hash map for better lookup performance",
    "Add input validation at the beginning"
  ],
  "geminiAnalysis": "This is a well-written solution that demonstrates good understanding of the problem. The algorithm is efficient with O(n) time complexity. The code structure is clean and easy to follow. However, there's room for improvement in variable naming and edge case handling. Overall, this is a solid implementation that would perform well in production."
}`;

export async function POST(req: Request) {
  try {
    const { code, language, problemId, testResults, userId } = await req.json();

    if (!code || !language) {
      return NextResponse.json(
        { error: "Code and language required" },
        { status: 400 }
      );
    }

    // Format test results
    const testResultsText = testResults && Array.isArray(testResults)
      ? testResults.map((r: { passed: boolean; expected: string; actual: string; executionTime?: number; error?: string }, i: number) => 
          `Test ${i + 1}: ${r.passed ? "✅ PASSED" : "❌ FAILED"}${r.executionTime ? ` (${r.executionTime}ms)` : ""}${
            r.error ? ` - Error: ${r.error}` : ""
          }`
        ).join("\n")
      : "No test cases run";

    const prompt = CODE_EVALUATION_PROMPT
      .replace("{{LANGUAGE}}", language)
      .replace("{{CODE}}", code)
      .replace("{{PROBLEM_DESCRIPTION}}", problemId || "General code review")
      .replace("{{TEST_RESULTS}}", testResultsText);

    // Call Gemini API with retry logic
    const geminiResponse = await callGeminiAPI({
      prompt,
      temperature: 0.4,
      maxOutputTokens: 2048,
      topP: 0.9
    });

    if (!geminiResponse.success) {
      return NextResponse.json(
        { 
          error: "AI evaluation failed", 
          details: geminiResponse.error,
          retryable: true
        },
        { status: 503 }
      );
    }

    const parsed = parseGeminiJSON<unknown>(geminiResponse.text);
    const validated = codeEvaluationSchema.safeParse(parsed);
    const evaluation = validated.success ? validated.data : null;

    if (!evaluation) {
      return NextResponse.json(
        {
          error: "Failed to parse evaluation response",
          details: "Invalid JSON format or schema mismatch",
        },
        { status: 500 }
      );
    }

    // Validate evaluation structure
    const validEvaluation: CodeEvaluation = {
      score: evaluation.score ?? 0,
      timeComplexity: evaluation.timeComplexity ?? "Not analyzed",
      spaceComplexity: evaluation.spaceComplexity ?? "Not analyzed",
      codeQuality: {
        readability: evaluation.codeQuality?.readability ?? 0,
        efficiency: evaluation.codeQuality?.efficiency ?? 0,
        correctness: evaluation.codeQuality?.correctness ?? 0,
      },
      suggestions: evaluation.suggestions ?? [],
      strengths: evaluation.strengths ?? [],
      improvements: evaluation.improvements ?? [],
      geminiAnalysis: evaluation.geminiAnalysis ?? "Analysis not available",
    };

    if (typeof userId === "string" && userId.trim()) {
      try {
        await ingestIntelligenceEvent({
          userId: userId.trim(),
          eventType: "code.evaluation.completed",
          payload: {
            problemId: problemId || null,
            language,
            evaluation: validEvaluation,
            testResults: Array.isArray(testResults) ? testResults : [],
          },
          source: "api/code/evaluate",
        });
      } catch (intelligenceError) {
        console.error("[api/code/evaluate] intelligence event failed", intelligenceError);
      }
    }

    return NextResponse.json({
      success: true,
      evaluation: validEvaluation
    });

  } catch (error) {
    console.error("Code evaluation error:", error);
    return NextResponse.json(
      { error: "Evaluation failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
