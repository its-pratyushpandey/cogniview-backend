import {
  AdaptiveContext,
  CompanyPrepProgressNode,
  CompanyQuestion,
  Company,
  Difficulty,
} from "@/features/company-prep/types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function uniqueNormalized(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = normalizeTag(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

export function deriveRecommendedDifficulty(progress?: CompanyPrepProgressNode): Difficulty {
  if (!progress) {
    return "medium";
  }

  const recentScores = progress.scores.slice(-5);
  const scoreBase = recentScores.length > 0
    ? recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length
    : progress.stats.averageScore;

  if (scoreBase < 50) return "easy";
  if (scoreBase < 75) return "medium";
  return "hard";
}

export function createAdaptiveContext(input: {
  progress?: CompanyPrepProgressNode;
  company?: Company;
}): AdaptiveContext {
  const { progress, company } = input;
  const recommendedDifficulty = deriveRecommendedDifficulty(progress);
  const weakAreas = uniqueNormalized(progress?.weakAreas ?? []);
  const frequentTopics = uniqueNormalized(company?.frequentTopics ?? []);

  const prioritizedTopics = uniqueNormalized([
    ...weakAreas,
    ...frequentTopics,
  ]).slice(0, 8);

  return {
    recommendedDifficulty,
    weakAreas,
    prioritizedTopics,
    recentScores: progress?.scores.slice(-5) ?? [],
  };
}

function getDifficultyAffinity(questionDifficulty: Difficulty, target: Difficulty): number {
  if (questionDifficulty === target) return 8;
  if (
    (questionDifficulty === "easy" && target === "medium") ||
    (questionDifficulty === "medium" && target === "easy") ||
    (questionDifficulty === "hard" && target === "medium") ||
    (questionDifficulty === "medium" && target === "hard")
  ) {
    return 4;
  }
  return 1;
}

export function rankQuestionsByAdaptation(input: {
  questions: CompanyQuestion[];
  adaptive: AdaptiveContext;
}): CompanyQuestion[] {
  const { questions, adaptive } = input;

  const weakSet = new Set(adaptive.weakAreas.map(normalizeTag));
  const topicSet = new Set(adaptive.prioritizedTopics.map(normalizeTag));

  return [...questions]
    .map((question) => {
      const normalizedTags = question.tags.map(normalizeTag);
      const weakHits = normalizedTags.filter((tag) => weakSet.has(tag)).length;
      const topicHits = normalizedTags.filter((tag) => topicSet.has(tag)).length;

      const score =
        getDifficultyAffinity(question.difficulty, adaptive.recommendedDifficulty) +
        weakHits * 5 +
        topicHits * 3 +
        clamp(question.question.length <= 150 ? 2 : 1, 1, 2);

      return { question, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.question);
}
