import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const revisionsSnapshot = await db
      .collection("revisions")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const revisions = revisionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ success: true, revisions });
  } catch (error) {
    console.error("Error fetching revisions:", error);
    return NextResponse.json(
      { error: "Failed to fetch revisions" },
      { status: 500 }
    );
  }
}
