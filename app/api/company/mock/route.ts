import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createInterviewFromMock,
  getMockInterview,
} from "@/features/company-prep/services/company-prep.server";

const getQuerySchema = z.object({
  companyId: z.string().trim().min(1, "companyId is required"),
  roleId: z.string().trim().min(1, "roleId is required"),
  userId: z.string().trim().optional(),
});

const postSchema = z.object({
  companyId: z.string().trim().min(1, "companyId is required"),
  roleId: z.string().trim().min(1, "roleId is required"),
  userId: z.string().trim().min(1, "userId is required"),
  createInterview: z.boolean().optional(),
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

    const result = await getMockInterview(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/company/mock][GET] failed", error);
    return NextResponse.json(
      {
        error: "Failed to fetch mock interview",
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

    if (parsed.data.createInterview) {
      const result = await createInterviewFromMock(parsed.data);
      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    const result = await getMockInterview(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/company/mock][POST] failed", error);
    return NextResponse.json(
      {
        error: "Failed to create company mock",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
