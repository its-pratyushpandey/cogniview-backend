import { NextResponse } from "next/server";

// Using Piston API for code execution (free tier available)
const PISTON_API_URL = "https://emkc.org/api/v2/piston";

const LANGUAGE_MAP: Record<string, string> = {
  python: "python",
  java: "java",
  cpp: "c++",
  javascript: "javascript"
};

const FILE_EXTENSIONS: Record<string, string> = {
  python: "py",
  java: "java",
  cpp: "cpp",
  javascript: "js"
};

export async function POST(req: Request) {
  try {
    const { code, language, input = "" } = await req.json();

    if (!code || !language) {
      return NextResponse.json(
        { error: "Code and language are required" },
        { status: 400 }
      );
    }

    const pistonLanguage = LANGUAGE_MAP[language];
    
    if (!pistonLanguage) {
      return NextResponse.json(
        { error: "Unsupported language" },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Execute code via Piston API
    const response = await fetch(`${PISTON_API_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: pistonLanguage,
        version: "*", // Use latest version
        files: [
          {
            name: `main.${FILE_EXTENSIONS[language]}`,
            content: code
          }
        ],
        stdin: input,
        args: [],
        compile_timeout: 10000,
        run_timeout: 3000,
        compile_memory_limit: -1,
        run_memory_limit: -1
      })
    });

    const executionTime = Date.now() - startTime;

    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Execution service unavailable",
          output: "",
          executionTime: 0,
          memoryUsed: 0,
          language
        },
        { status: 503 }
      );
    }

    const data = await response.json();

    // Format output
    let output = "";
    if (data.run?.stdout) {
      output += data.run.stdout;
    }
    if (data.run?.stderr) {
      output += `\n❌ Runtime Error:\n${data.run.stderr}`;
    }
    if (data.compile?.stderr) {
      output += `\n❌ Compilation Error:\n${data.compile.stderr}`;
    }
    if (data.run?.code && data.run.code !== 0) {
      output += `\n⚠️ Process exited with code ${data.run.code}`;
    }

    const success = !data.run?.stderr && !data.compile?.stderr && (!data.run?.code || data.run.code === 0);

    return NextResponse.json({
      success,
      output: output || "✅ Code executed successfully (no output)",
      error: data.run?.stderr || data.compile?.stderr || undefined,
      executionTime,
      memoryUsed: 0, // Piston doesn't provide memory info
      language
    });

  } catch (error) {
    console.error("Code execution error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Execution failed",
        output: "",
        executionTime: 0,
        memoryUsed: 0,
        language: "unknown"
      },
      { status: 500 }
    );
  }
}
