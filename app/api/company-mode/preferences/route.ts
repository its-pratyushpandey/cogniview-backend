import { NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { ingestIntelligenceEvent } from "@/features/intelligence/services/intelligence.server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, companyType, targetCompanies } = body;

    if (!userId || !companyType) {
      return NextResponse.json(
        { error: "User ID and company type are required" },
        { status: 400 }
      );
    }

    const preferenceData: UserCompanyPreference = {
      userId,
      companyType,
      targetCompanies: targetCompanies || [],
      updatedAt: new Date().toISOString(),
    };

    await db.collection("userCompanyPreferences").doc(userId).set(preferenceData);

    try {
      await ingestIntelligenceEvent({
        userId,
        eventType: "company.preference.updated",
        payload: {
          companyType,
          targetCompanies: targetCompanies || [],
        },
        source: "api/company-mode/preferences",
      });
    } catch (intelligenceError) {
      console.error("[api/company-mode/preferences] intelligence event failed", intelligenceError);
    }

    return NextResponse.json({
      success: true,
      preference: preferenceData,
    });
  } catch (error: unknown) {
    console.error("Error saving company preference:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to save preference", details: message },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const preferenceDoc = await db
      .collection("userCompanyPreferences")
      .doc(userId)
      .get();

    if (!preferenceDoc.exists) {
      return NextResponse.json({
        userId,
        companyType: null,
        targetCompanies: [],
        updatedAt: null,
      });
    }

    return NextResponse.json(preferenceDoc.data());
  } catch (error: unknown) {
    console.error("Error fetching company preference:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch preference", details: message },
      { status: 500 }
    );
  }
}
