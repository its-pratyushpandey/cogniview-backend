import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resumeBuilderGenerateSchema } from "@/features/resume-builder/server/document-schema";
import { callGeminiAPI, parseGeminiJSON } from "@/lib/gemini-utils";

const summaryResultSchema = z.object({
  summary: z.string().trim().min(30).max(900),
});

const bulletResultSchema = z.object({
  summary: z.string().trim().min(20).max(900),
  bullets: z.array(z.string().trim().min(12).max(220)).min(2).max(8),
});

const skillsResultSchema = z.object({
  skills: z.array(z.string().trim().min(1).max(60)).min(3).max(25),
});

function uniqueTrimmed(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(trimmed);
  }

  return output;
}

function toSafeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueTrimmed(value.filter((entry): entry is string => typeof entry === "string"));
}

function buildPrompt(input: {
  section: "summary" | "experience" | "project" | "skills";
  targetRole: string;
  payload: Record<string, unknown>;
}): string {
  const targetRole = input.targetRole || "Software Engineer";

  if (input.section === "summary") {
    const existingSummary = toSafeString(input.payload.summary);
    const strengths = toStringArray(input.payload.strengths);
    const skills = toStringArray(input.payload.skills).slice(0, 14);

    return `You are an expert resume writer.
Create a concise, ATS-friendly professional summary tailored for role: ${targetRole}.

Input:
- Existing Summary: ${existingSummary || "none"}
- Strength Areas: ${strengths.join(", ") || "none"}
- Skills: ${skills.join(", ") || "none"}

Output JSON ONLY with this exact shape:
{
  "summary": "string"
}

Rules:
- 2 to 4 lines max.
- Focus on measurable impact, ownership, and delivery.
- Avoid buzzword stuffing and avoid first-person pronouns.
- Keep between 55 and 120 words.`;
  }

  if (input.section === "experience") {
    const role = toSafeString(input.payload.role);
    const company = toSafeString(input.payload.company);
    const existingSummary = toSafeString(input.payload.summary);
    const bullets = toStringArray(input.payload.bullets);
    const skills = toStringArray(input.payload.skills);

    return `You are an expert resume writer.
Rewrite this work experience for role: ${targetRole}.

Experience input:
- Role: ${role || "Unknown role"}
- Company: ${company || "Unknown company"}
- Existing Summary: ${existingSummary || "none"}
- Existing Bullets: ${bullets.join(" | ") || "none"}
- Relevant Skills: ${skills.join(", ") || "none"}

Output JSON ONLY with this exact shape:
{
  "summary": "string",
  "bullets": ["string", "string"]
}

Rules:
- Keep summary to 1-2 lines.
- Return 3 to 5 bullets.
- Bullets must start with strong action verbs.
- Quantify impact where possible.
- Keep each bullet <= 180 characters.
- No markdown.`;
  }

  if (input.section === "project") {
    const name = toSafeString(input.payload.name);
    const role = toSafeString(input.payload.role);
    const existingSummary = toSafeString(input.payload.summary);
    const bullets = toStringArray(input.payload.bullets);
    const technologies = toStringArray(input.payload.technologies);

    return `You are an expert resume writer.
Rewrite this project section for role: ${targetRole}.

Project input:
- Name: ${name || "Project"}
- Role: ${role || "Contributor"}
- Technologies: ${technologies.join(", ") || "none"}
- Existing Summary: ${existingSummary || "none"}
- Existing Bullets: ${bullets.join(" | ") || "none"}

Output JSON ONLY with this exact shape:
{
  "summary": "string",
  "bullets": ["string", "string"]
}

Rules:
- Keep summary to 1-2 lines.
- Return 3 to 4 high-quality bullets.
- Mention architecture, decisions, scale, or outcomes.
- Keep each bullet <= 180 characters.
- No markdown.`;
  }

  const currentSkills = toStringArray(input.payload.skills);
  const weaknessTopics = toStringArray(input.payload.weaknessTopics);

  return `You are an expert resume writer.
Optimize and deduplicate the candidate skills list for role: ${targetRole}.

Input:
- Current Skills: ${currentSkills.join(", ") || "none"}
- Weakness Topics from analysis: ${weaknessTopics.join(", ") || "none"}

Output JSON ONLY with this exact shape:
{
  "skills": ["string"]
}

Rules:
- Return 8 to 16 practical skills.
- Prioritize role-relevant skills first.
- Keep skills concrete (e.g., React, Node.js, SQL, System Design).
- Do not include explanations.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = resumeBuilderGenerateSchema.safeParse(body);

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

    const targetRole = parsed.data.targetRole?.trim() || "Software Engineer";

    const prompt = buildPrompt({
      section: parsed.data.section,
      targetRole,
      payload: parsed.data.payload,
    });

    const llmResponse = await callGeminiAPI({
      prompt,
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 1100,
      model: "llama-3.3-70b-versatile",
    });

    if (!llmResponse.success) {
      return NextResponse.json(
        {
          success: false,
          error: llmResponse.error || "AI generation failed",
        },
        { status: 502 }
      );
    }

    const parsedJson = parseGeminiJSON<unknown>(llmResponse.text);
    if (!parsedJson) {
      return NextResponse.json(
        {
          success: false,
          error: "AI returned invalid JSON",
        },
        { status: 502 }
      );
    }

    if (parsed.data.section === "summary") {
      const summary = summaryResultSchema.safeParse(parsedJson);
      if (!summary.success) {
        return NextResponse.json(
          {
            success: false,
            error: "AI summary response was invalid",
            details: summary.error.flatten(),
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        section: "summary",
        result: summary.data,
      });
    }

    if (parsed.data.section === "experience" || parsed.data.section === "project") {
      const bulletPayload = bulletResultSchema.safeParse(parsedJson);

      if (!bulletPayload.success) {
        return NextResponse.json(
          {
            success: false,
            error: "AI section response was invalid",
            details: bulletPayload.error.flatten(),
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        section: parsed.data.section,
        result: {
          summary: bulletPayload.data.summary,
          bullets: uniqueTrimmed(bulletPayload.data.bullets),
        },
      });
    }

    const skillsPayload = skillsResultSchema.safeParse(parsedJson);
    if (!skillsPayload.success) {
      return NextResponse.json(
        {
          success: false,
          error: "AI skills response was invalid",
          details: skillsPayload.error.flatten(),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      section: "skills",
      result: {
        skills: uniqueTrimmed(skillsPayload.data.skills),
      },
    });
  } catch (error) {
    console.error("[api/resume-builder/generate] failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate resume content",
      },
      { status: 500 }
    );
  }
}
