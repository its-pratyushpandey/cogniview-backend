import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getCompanyTest,
  submitTest,
} from "@/features/company-prep/services/company-prep.server";
import { ingestIntelligenceEvent } from "@/features/intelligence/services/intelligence.server";

const getQuerySchema = z.object({
  companyId: z.string().trim().min(1, "companyId is required"),
  roleId: z.string().trim().min(1, "roleId is required"),
  userId: z.string().trim().optional(),
});

const postSchema = z.object({
  userId: z.string().trim().min(1, "userId is required"),
  companyId: z.string().trim().min(1, "companyId is required"),
  roleId: z.string().trim().min(1, "roleId is required"),
  answers: z.record(z.union([z.string(), z.number()])),
});

export async function GET(request: NextRequest) {
  try {
    const parsed = getQuerySchema.safeParse({
      companyId: request.nextUrl.searchParams.get("companyId"),
      roleId: request.nextUrl.searchParams.get("roleId"),
      userId: request.nextUrl.searchParams.get("userId") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid query params",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = await getCompanyTest(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/company/test][GET] failed", error);
    return NextResponse.json(
      {
        error: "Failed to fetch test",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = postSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = await submitTest(parsed.data);

    try {
      await ingestIntelligenceEvent({
        userId: parsed.data.userId,
        eventType: "company.test.submitted",
        payload: {
          companyId: parsed.data.companyId,
          roleId: parsed.data.roleId,
          result,
        },
        source: "api/company/test",
      });
    } catch (intelligenceError) {
      console.error("[api/company/test][POST] intelligence event failed", intelligenceError);
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("[api/company/test][POST] failed", error);
    return NextResponse.json(
      {
        error: "Failed to submit test",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
