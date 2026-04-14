import { NextResponse } from "next/server";

const COMPANY_MODE_MODIFIERS: CompanyModeModifiers = {
  SERVICE_BASED: {
    temperature: 0.6,
    depthLevel: "moderate",
    focusAreas: ["Fundamentals", "Concepts", "Simple coding"],
    promptAddition:
      "Focus on TCS/Wipro/Infosys level questions. Keep explanations moderate depth. Include basic coding problems. Emphasize fundamental concepts and standard approaches.",
  },
  PRODUCT_BASED: {
    temperature: 0.8,
    depthLevel: "deep",
    focusAreas: ["System Design", "Optimization", "Edge cases"],
    promptAddition:
      "Ask Amazon/Google/Microsoft level questions. Expect deep understanding of algorithms, data structures, and system design. Include optimization challenges and trade-offs analysis. Test scalability thinking.",
  },
  STARTUP: {
    temperature: 0.7,
    depthLevel: "practical",
    focusAreas: ["Real scenarios", "Problem solving", "Quick thinking"],
    promptAddition:
      "Focus on practical scenarios and adaptability. Ask 'how would you build X' questions. Test problem-solving skills and ability to work with constraints. Emphasize quick learning and pragmatic solutions.",
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyType, basePrompt } = body;

    if (!companyType || !basePrompt) {
      return NextResponse.json(
        { error: "Company type and base prompt are required" },
        { status: 400 }
      );
    }

    const modifier = COMPANY_MODE_MODIFIERS[companyType as CompanyType];

    if (!modifier) {
      return NextResponse.json(
        { error: "Invalid company type" },
        { status: 400 }
      );
    }

    const enhancedPrompt = `${basePrompt}\n\n**COMPANY MODE: ${companyType}**\n${modifier.promptAddition}`;

    return NextResponse.json({
      enhancedPrompt,
      modifier,
      companyType,
    });
  } catch (error: unknown) {
    console.error("Error applying company mode:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to apply company mode", details: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    availableModes: Object.keys(COMPANY_MODE_MODIFIERS),
    modifiers: COMPANY_MODE_MODIFIERS,
  });
}
