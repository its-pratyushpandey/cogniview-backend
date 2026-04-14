import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listRoles } from "@/features/company-prep/services/company-prep.server";

const querySchema = z.object({
  companyId: z.string().trim().min(1, "companyId is required"),
  search: z.string().trim().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const parsed = querySchema.safeParse({
      companyId: request.nextUrl.searchParams.get("companyId"),
      search: request.nextUrl.searchParams.get("search") ?? undefined,
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

    const result = await listRoles(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/company/roles] failed", error);
    return NextResponse.json(
      {
        error: "Failed to fetch roles",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
