import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/firebase/admin";
import { resumeBuilderDocumentSchema, resumeDraftSaveSchema } from "@/features/resume-builder/server/document-schema";

const RESUME_BUILDER_COLLECTION = "resume_builder_drafts";

const getQuerySchema = z.object({
  userId: z.string().trim().min(1, "userId is required"),
});

function nowIso(): string {
  return new Date().toISOString();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as T;
  }

  if (isPlainObject(value)) {
    const cleaned = Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entryValue]) => {
      if (entryValue === undefined) {
        return acc;
      }

      const nested = stripUndefinedDeep(entryValue);
      if (nested !== undefined) {
        acc[key] = nested;
      }

      return acc;
    }, {});

    return cleaned as T;
  }

  return value;
}

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = getQuerySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query parameters",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const userId = parsed.data.userId;
    const draftDoc = await db.collection(RESUME_BUILDER_COLLECTION).doc(userId).get();

    if (!draftDoc.exists) {
      return NextResponse.json({
        success: true,
        draft: null,
        updatedAt: null,
      });
    }

    const rawData = draftDoc.data();
    const validatedDraft = resumeBuilderDocumentSchema.safeParse(rawData?.document);

    if (!validatedDraft.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Stored resume draft is invalid",
          details: validatedDraft.error.flatten(),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      draft: validatedDraft.data,
      updatedAt: typeof rawData?.updatedAt === "string" ? rawData.updatedAt : validatedDraft.data.updatedAt,
    });
  } catch (error) {
    console.error("[api/resume-builder/draft] GET failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch resume draft",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = resumeDraftSaveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const timestamp = nowIso();
    const docRef = db.collection(RESUME_BUILDER_COLLECTION).doc(parsed.data.userId);
    const existing = await docRef.get();

    const createdAt =
      existing.exists && typeof existing.data()?.createdAt === "string"
        ? (existing.data()?.createdAt as string)
        : timestamp;

    const nextDocument = {
      ...parsed.data.document,
      createdAt: parsed.data.document.createdAt || createdAt,
      updatedAt: timestamp,
    };

    const payload = stripUndefinedDeep({
      userId: parsed.data.userId,
      document: nextDocument,
      version: 1,
      createdAt,
      updatedAt: timestamp,
    });

    await docRef.set(payload, { merge: true });

    return NextResponse.json({
      success: true,
      updatedAt: timestamp,
      draft: nextDocument,
    });
  } catch (error) {
    console.error("[api/resume-builder/draft] POST failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to save resume draft",
      },
      { status: 500 }
    );
  }
}
