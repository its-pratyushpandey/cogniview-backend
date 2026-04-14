// Code Execution Playground Type Definitions

interface CodeSession {
  id: string;
  userId: string;
  interviewId?: string;
  problemId?: string;
  language: "python" | "java" | "cpp" | "javascript";
  code: string;
  output: string;
  evaluation?: CodeEvaluation;
  recordingUrl?: string;
  testResults?: TestResult[];
  createdAt: string;
  updatedAt: string;
}

interface CodeEvaluation {
  score: number; // 0-100
  timeComplexity: string; // "O(n)", "O(log n)", etc.
  spaceComplexity: string;
  codeQuality: {
    readability: number; // 0-10
    efficiency: number; // 0-10
    correctness: number; // 0-10
  };
  suggestions: string[];
  strengths: string[];
  improvements: string[];
  geminiAnalysis: string;
}

interface DSAProblem {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  category: string; // "Arrays", "Trees", "DP", etc.
  description: string;
  examples: Array<{
    input: string;
    output: string;
    explanation: string;
  }>;
  constraints: string[];
  testCases: TestCase[];
  hints: string[];
  timeLimit: number; // in ms
  memoryLimit: number; // in MB;
}

interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  weight: number;
}

interface TestResult {
  testCaseId: string;
  passed: boolean;
  actualOutput: string;
  expectedOutput: string;
  executionTime: number; // ms
  memoryUsed: number; // MB
  error?: string;
}

interface ExecutionResponse {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  memoryUsed: number;
  language: string;
}

interface CodeEditorProps {
  code: string;
  language: string;
  onChange: (value: string) => void;
  height?: string;
  readOnly?: boolean;
}

interface CodePlaygroundProps {
  userId: string;
  interviewId?: string;
  initialProblem?: DSAProblem;
  mode?: "practice" | "interview";
}
