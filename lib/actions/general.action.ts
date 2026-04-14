"use server";

import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";
import { callGeminiAPI, parseGeminiJSON } from "@/lib/gemini-utils";
import { ingestIntelligenceEvent } from "@/features/intelligence/services/intelligence.server";

function normalizeTranscriptEntries(
  transcript: { role: string; content: string }[]
): Array<{ role: string; content: string }> {
  return transcript
    .map((entry) => ({
      role: typeof entry.role === "string" ? entry.role.trim().toLowerCase() : "",
      content: typeof entry.content === "string" ? entry.content.trim() : "",
    }))
    .filter((entry) => entry.role.length > 0 && entry.content.length > 0);
}

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId, perQuestionSummary, sessionSummary } = params;

  try {
    const normalizedTranscript = normalizeTranscriptEntries(transcript);
    if (normalizedTranscript.length === 0) {
      console.error("createFeedback: transcript was empty after normalization");
      return { success: false };
    }

    const formattedTranscript = normalizedTranscript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}\n`
      )
      .join("");

    const prompt = `You are a professional interviewer analyzing a mock interview transcript.

Return JSON ONLY that matches this shape exactly:
{
  "totalScore": number,
  "categoryScores": [
    {"name":"Communication Skills","score":number,"comment":"string"},
    {"name":"Technical Knowledge","score":number,"comment":"string"},
    {"name":"Problem Solving","score":number,"comment":"string"},
    {"name":"Cultural Fit","score":number,"comment":"string"},
    {"name":"Confidence and Clarity","score":number,"comment":"string"}
  ],
  "strengths": ["string"],
  "areasForImprovement": ["string"],
  "finalAssessment": "string"
}

Guidelines:
- Be thorough and detailed; do not be lenient.
- If there are mistakes or weak areas, point them out.
- Scores must be consistent with comments.

Transcript:
${formattedTranscript}
`;

    const llmResponse = await callGeminiAPI({
      prompt,
      temperature: 0.4,
      maxOutputTokens: 2048,
      topP: 0.95,
      model: "llama-3.3-70b-versatile",
    });

    const parsed = parseGeminiJSON(llmResponse.text);
    const validated = feedbackSchema.safeParse(parsed);
    if (!llmResponse.success || !validated.success) {
      console.error("createFeedback: invalid model output", {
        error: llmResponse.error,
        zodIssues: validated.success ? undefined : validated.error.issues,
      });
      return { success: false };
    }

    const object = validated.data;

    const feedback = {
      interviewId: interviewId,
      userId: userId,
      totalScore: object.totalScore,
      categoryScores: object.categoryScores,
      strengths: object.strengths,
      areasForImprovement: object.areasForImprovement,
      finalAssessment: object.finalAssessment,
      ...(Array.isArray(perQuestionSummary) && perQuestionSummary.length > 0
        ? { perQuestionSummary }
        : {}),
      ...(sessionSummary ? { sessionSummary } : {}),
      ...(normalizedTranscript.length > 0 ? { transcript: normalizedTranscript } : {}),
      createdAt: new Date().toISOString(),
    };

    let feedbackRef;

    if (feedbackId) {
      feedbackRef = db.collection("feedback").doc(feedbackId);
    } else {
      feedbackRef = db.collection("feedback").doc();
    }

    await feedbackRef.set(feedback);

    try {
      await ingestIntelligenceEvent({
        userId,
        eventType: "interview.feedback.created",
        payload: {
          interviewId,
          totalScore: object.totalScore,
          categoryScores: object.categoryScores,
          strengths: object.strengths,
          areasForImprovement: object.areasForImprovement,
          ...(sessionSummary ? { sessionSummary } : {}),
        },
        source: "lib/actions/createFeedback",
      });
    } catch (intelligenceError) {
      console.error("createFeedback: intelligence event failed", intelligenceError);
    }

    return { success: true, feedbackId: feedbackRef.id };
  } catch (error) {
    console.error("Error saving feedback:", error);
    return { success: false };
  }
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  const interview = await db.collection("interviews").doc(id).get();

  return interview.data() as Interview | null;
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  const querySnapshot = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (querySnapshot.empty) return null;

  const feedbackDoc = querySnapshot.docs[0];
  return { id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback;
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;

  if (!userId) {
    console.warn("getLatestInterviews called with undefined/null userId");
    return [];
  }

  try {
    // Index-safe query: single-field ordering, filter finalized and user in memory.
    const sampleSize = Math.min(Math.max(limit * 8, 120), 400);
    const interviews = await db
      .collection("interviews")
      .orderBy("createdAt", "desc")
      .limit(sampleSize)
      .get();

    const interviewsData = interviews.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Interview[];

    return interviewsData
      .filter((interview) => interview.finalized && interview.userId !== userId)
      .slice(0, limit);
  } catch (error) {
    console.error("Error fetching latest interviews:", error);
    return [];
  }
}

export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[] | null> {
  if (!userId) {
    console.warn("getInterviewsByUserId called with undefined/null userId");
    return [];
  }

  try {
    // Index-safe query: filter by userId only, then sort in memory.
    const interviews = await db
      .collection("interviews")
      .where("userId", "==", userId)
      .get();

    const interviewsData = interviews.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Interview[];

    return interviewsData.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
  } catch (error) {
    console.error("Error fetching user interviews:", error);
    return [];
  }
}