import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listQuestions } from "@/features/company-prep/services/company-prep.server";

const querySchema = z.object({
  companyId: z.string().trim().min(1, "companyId is required"),
  roleId: z.string().trim().min(1, "roleId is required"),
  userId: z.string().trim().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  type: z.enum(["mcq", "coding", "theory"]).optional(),
  limit: z
    .string()
    .transform((value) => Number(value))
    .refine((value) => Number.isFinite(value) && value > 0 && value <= 30, {
      message: "limit must be between 1 and 30",
    })
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const parsed = querySchema.safeParse({
      companyId: request.nextUrl.searchParams.get("companyId"),
      roleId: request.nextUrl.searchParams.get("roleId"),
      userId: request.nextUrl.searchParams.get("userId") ?? undefined,
      difficulty: request.nextUrl.searchParams.get("difficulty") ?? undefined,
      type: request.nextUrl.searchParams.get("type") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
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

    const result = await listQuestions(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/company/questions] failed", error);
    return NextResponse.json(
      {
        error: "Failed to fetch questions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
