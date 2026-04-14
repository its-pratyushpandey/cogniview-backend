import type {
  AdaptiveQuestion,
  ExperienceLevel,
  QuestionGenerationMode,
} from "@/features/resume-analysis/types";

function makeDifficultyHint(level: ExperienceLevel): string {
  if (level === "Advanced") {
    return "Explain trade-offs and edge cases in your answer.";
  }

  if (level === "Intermediate") {
    return "Cover the core approach and a realistic implementation detail.";
  }

  return "Focus on fundamentals and clear definitions.";
}

function makeQuestionId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`;
}

export function buildFallbackQuestions(input: {
  topics: string[];
  difficulty: ExperienceLevel;
  mode: QuestionGenerationMode;
  count: number;
}): AdaptiveQuestion[] {
  const { topics, difficulty, mode, count } = input;
  const safeTopics = topics.length > 0 ? topics : ["Core CS Fundamentals"];
  const output: AdaptiveQuestion[] = [];

  let index = 0;
  while (output.length < count) {
    const topic = safeTopics[index % safeTopics.length];
    const questionType = index % 3 === 0 ? "MCQ" : index % 3 === 1 ? "Conceptual" : "Coding";

    if (questionType === "MCQ") {
      output.push({
        id: makeQuestionId("mcq", index),
        type: "MCQ",
        topic,
        difficulty,
        questionText: `Which statement best explains an interview-critical concept in ${topic}?`,
        options: [
          "A partially correct but shallow explanation",
          "A complete definition with practical example",
          "A generic statement without context",
          "An unrelated implementation detail",
        ],
        explanation: `${makeDifficultyHint(difficulty)} The strongest option always includes both concept and context.`,
        answerSnippet: "Option 2",
        source: mode === "custom" ? "custom" : mode === "all-skills" ? "skill" : "weakness",
      });
    } else if (questionType === "Conceptual") {
      output.push({
        id: makeQuestionId("concept", index),
        type: "Conceptual",
        topic,
        difficulty,
        questionText: `Explain ${topic} as if you are answering a hiring manager who asks for practical relevance.`,
        explanation: makeDifficultyHint(difficulty),
        answerSnippet:
          "Start with definition, include one real-world scenario, and mention a trade-off or limitation.",
        source: mode === "custom" ? "custom" : mode === "all-skills" ? "skill" : "weakness",
      });
    } else {
      output.push({
        id: makeQuestionId("coding", index),
        type: "Coding",
        topic,
        difficulty,
        questionText: `Write a concise function or component that demonstrates your depth in ${topic}.`,
        explanation: `${makeDifficultyHint(difficulty)} Optimize for readability and testability.`,
        answerSnippet:
          "Pseudo-outline: validate input -> core logic -> edge-case guard -> return structured result.",
        source: mode === "custom" ? "custom" : mode === "all-skills" ? "skill" : "weakness",
      });
    }

    index += 1;
  }

  return output;
}
