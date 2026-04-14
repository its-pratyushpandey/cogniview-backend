import type { IntelligenceDifficultyPreference, UserIntelligenceSnapshot } from "@/features/intelligence/types";
import {
  clampScore,
  difficultyFromScore,
  getTopStrengthAreas,
  getTopWeakAreas,
} from "@/features/intelligence/utils/adaptive";

export interface AdaptiveEngineState {
  readinessScore: number;
  recommendedDifficulty: IntelligenceDifficultyPreference;
  weakAreaPriorities: string[];
  strongAreaPriorities: string[];
  behaviorSummary: {
    averageResponseTimeMs: number;
    averageRetries: number;
    sessionsTracked: number;
  };
}

export function buildAdaptiveEngineState(
  snapshot: UserIntelligenceSnapshot | null
): AdaptiveEngineState {
  if (!snapshot) {
    return {
      readinessScore: 0,
      recommendedDifficulty: "adaptive",
      weakAreaPriorities: [],
      strongAreaPriorities: [],
      behaviorSummary: {
        averageResponseTimeMs: 0,
        averageRetries: 0,
        sessionsTracked: 0,
      },
    };
  }

  const readinessScore = clampScore(
    snapshot.metrics.interviewReadiness * 0.4 +
      snapshot.metrics.technicalDepth * 0.25 +
      snapshot.metrics.problemSolving * 0.2 +
      snapshot.metrics.communication * 0.15
  );

  const suggestedDifficulty = difficultyFromScore(readinessScore);
  const recommendedDifficulty =
    snapshot.difficultyPreference === "adaptive" ? suggestedDifficulty : snapshot.difficultyPreference;

  return {
    readinessScore,
    recommendedDifficulty,
    weakAreaPriorities: getTopWeakAreas(snapshot, 8),
    strongAreaPriorities: getTopStrengthAreas(snapshot, 8),
    behaviorSummary: {
      averageResponseTimeMs: snapshot.behavior.averageResponseTimeMs,
      averageRetries: snapshot.behavior.averageRetries,
      sessionsTracked: snapshot.behavior.sessionsTracked,
    },
  };
}
