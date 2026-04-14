import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";
import { callGeminiAPI, parseGeminiJSON } from "@/lib/gemini-utils";
import { listQuestions } from "@/features/company-prep/services/company-prep.server";

export async function POST(request: Request) {
  const {
    type,
    role,
    level,
    techstack,
    amount,
    userid,
    companyId,
    roleId,
  } = await request.json() as {
    type: string;
    role: string;
    level: string;
    techstack: string;
    amount: number;
    userid: string;
    companyId?: string;
    roleId?: string;
  };

  try {
    const questionAmount = Number.isFinite(amount) && amount > 0 ? Math.min(amount, 12) : 5;
    let questions: string[] | null = null;

    // Company-wise integration path: prioritize curated question bank before LLM generation.
    if (companyId && roleId) {
      const companyQuestions = await listQuestions({
        companyId,
        roleId,
        userId: userid,
        limit: questionAmount,
      });

      if (companyQuestions.questions.length > 0) {
        questions = companyQuestions.questions.map((question) => question.question);
      }
    }

    const prompt = `Prepare questions for a job interview.
        The job role is ${role}.
        The job experience level is ${level}.
        The tech stack used in the job is: ${techstack}.
        The focus between behavioural and technical questions should lean towards: ${type}.
        The amount of questions required is: ${amount}.
        Please return only the questions, without any additional text.
        The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
        Return the questions formatted like this:
        ["Question 1", "Question 2", "Question 3"]
        
        Thank you! <3
    `;

    if (!questions) {
      const llmResponse = await callGeminiAPI({
        prompt,
        temperature: 0.6,
        maxOutputTokens: 1200,
        topP: 0.95,
        model: "llama-3.1-8b-instant",
      });

      const parsedQuestions = parseGeminiJSON<string[]>(llmResponse.text);
      if (!llmResponse.success || !Array.isArray(parsedQuestions)) {
        throw new Error(llmResponse.error || "Failed to generate valid questions JSON array");
      }

      questions = parsedQuestions;
    }

    const interview = {
      role: role,
      type: type,
      level: level,
      techstack: techstack.split(","),
      questions,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };
    await db.collection("interviews").add(interview);
    
    // return Response.json(interview, { status: 200 });
    
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return Response.json({ success: false, error: error }, { status: 500 });
  }
}