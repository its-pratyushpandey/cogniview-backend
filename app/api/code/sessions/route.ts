import { NextResponse } from "next/server";
import { db } from "@/firebase/admin";

const CODE_SESSIONS_COLLECTION = "code_sessions";
const LEGACY_CODE_SESSIONS_COLLECTION = "codeSessions";

export async function POST(req: Request) {
  try {
    const {
      userId,
      interviewId,
      problemId,
      code,
      language,
      output,
      evaluation,
      testResults,
      recordingUrl
    } = await req.json();

    if (!userId || !code || !language) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const sessionData: Partial<CodeSession> = {
      userId,
      interviewId: interviewId || undefined,
      problemId: problemId || undefined,
      language,
      code,
      output: output || "",
      evaluation: evaluation || undefined,
      testResults: testResults || [],
      recordingUrl: recordingUrl || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save to Firestore
    const sessionRef = await db.collection(CODE_SESSIONS_COLLECTION).add(sessionData);

    return NextResponse.json({
      success: true,
      sessionId: sessionRef.id,
      message: "Session saved successfully"
    });

  } catch (error) {
    console.error("Error saving code session:", error);
    return NextResponse.json(
      { error: "Failed to save session" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { sessionId, recordingUrl } = await req.json();

    if (!sessionId || !recordingUrl) {
      return NextResponse.json(
        { error: "sessionId and recordingUrl are required" },
        { status: 400 }
      );
    }

    const updateData = {
      recordingUrl,
      updatedAt: new Date().toISOString(),
    };

    const primaryRef = db.collection(CODE_SESSIONS_COLLECTION).doc(sessionId);
    const primaryDoc = await primaryRef.get();

    if (primaryDoc.exists) {
      await primaryRef.update(updateData);
      return NextResponse.json({ success: true, message: "Recording linked to session" });
    }

    const legacyRef = db.collection(LEGACY_CODE_SESSIONS_COLLECTION).doc(sessionId);
    const legacyDoc = await legacyRef.get();

    if (legacyDoc.exists) {
      await legacyRef.update(updateData);
      return NextResponse.json({ success: true, message: "Recording linked to legacy session" });
    }

    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error updating code session recording URL:", error);
    return NextResponse.json(
      { error: "Failed to update recording URL" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const sessionId = searchParams.get("sessionId");

    if (sessionId) {
      // Get specific session
      const primaryDoc = await db.collection(CODE_SESSIONS_COLLECTION).doc(sessionId).get();
      const sessionDoc = primaryDoc.exists
        ? primaryDoc
        : await db.collection(LEGACY_CODE_SESSIONS_COLLECTION).doc(sessionId).get();
      
      if (!sessionDoc.exists) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        session: { id: sessionDoc.id, ...sessionDoc.data() }
      });
    }

    if (userId) {
      // Get all sessions for user
      const [primarySnapshot, legacySnapshot] = await Promise.all([
        db
          .collection(CODE_SESSIONS_COLLECTION)
          .where("userId", "==", userId)
          .limit(40)
          .get(),
        db
          .collection(LEGACY_CODE_SESSIONS_COLLECTION)
          .where("userId", "==", userId)
          .limit(40)
          .get(),
      ]);

      type SessionRecord = Record<string, unknown> & { id: string; createdAt?: string };

      const sessions: SessionRecord[] = [
        ...primarySnapshot.docs,
        ...legacySnapshot.docs,
      ]
        .map((doc): SessionRecord => ({
          id: doc.id,
          ...(doc.data() as Record<string, unknown>),
        }))
        .sort((a, b) => {
          const aTime = new Date(typeof a.createdAt === "string" ? a.createdAt : 0).getTime();
          const bTime = new Date(typeof b.createdAt === "string" ? b.createdAt : 0).getTime();
          return bTime - aTime;
        })
        .slice(0, 20);

      return NextResponse.json({
        success: true,
        sessions
      });
    }

    return NextResponse.json(
      { error: "userId or sessionId required" },
      { status: 400 }
    );

  } catch (error) {
    console.error("Error fetching code sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
