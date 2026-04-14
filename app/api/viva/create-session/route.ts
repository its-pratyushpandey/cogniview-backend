import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/firebase/admin";

export async function POST(req: NextRequest) {
  try {
    const { userId, subject, baseTopic } = await req.json();

    if (!userId || !subject || !baseTopic) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create viva session in Firestore
    const sessionData = {
      userId,
      subject,
      baseTopic: baseTopic.trim(),
      conversationHistory: [],
      currentDifficulty: 3,
      questionsAsked: 0,
      goodAnswers: 0,
      averageAnswers: 0,
      poorAnswers: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const sessionRef = await adminDb.collection("vivaSessions").add(sessionData);

    return NextResponse.json({
      success: true,
      sessionId: sessionRef.id,
      session: { id: sessionRef.id, ...sessionData },
    });
  } catch (error) {
    console.error("Error creating viva session:", error);
    return NextResponse.json(
      { error: "Failed to create viva session" },
      { status: 500 }
    );
  }
}
