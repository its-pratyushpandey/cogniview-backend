import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listCompanies } from "@/features/company-prep/services/company-prep.server";

const querySchema = z.object({
  search: z.string().trim().optional(),
  userId: z.string().trim().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const parsed = querySchema.safeParse({
      search: request.nextUrl.searchParams.get("search") ?? undefined,
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

    const result = await listCompanies(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/company/list] failed", error);
    return NextResponse.json(
      {
        error: "Failed to fetch companies",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
