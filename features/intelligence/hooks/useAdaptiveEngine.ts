"use client";

import { useCallback, useMemo } from "react";

import type { IntelligenceDifficultyPreference } from "@/features/intelligence/types";
import { useIntelligence } from "@/features/intelligence/context/IntelligenceProvider";
import { buildAdaptiveEngineState } from "@/features/intelligence/engine/adaptive-engine";

interface TrackLearningInput {
  topicName?: string;
  score?: number;
  accuracy?: number;
  responseTimeMs?: number;
  retries?: number;
  confidence?: number;
  difficultyPreference?: IntelligenceDifficultyPreference;
}

interface MarkProgressInput {
  subject: string;
  topicName: string;
  score: number;
  responseTimeMs?: number;
  retries?: number;
}

export function useAdaptiveEngine(defaultModule = "general") {
  const { snapshot, loading, error, emitEvent } = useIntelligence();

  const engineState = useMemo(() => buildAdaptiveEngineState(snapshot), [snapshot]);

  const trackLearning = useCallback(
    async (input: TrackLearningInput) => {
      await emitEvent(
        "learning.behavior.tracked",
        {
          module: defaultModule,
          topicName: input.topicName,
          score: input.score,
          accuracy: input.accuracy,
          responseTimeMs: input.responseTimeMs,
          retries: input.retries,
          confidence: input.confidence,
          difficultyPreference: input.difficultyPreference,
        },
        `hooks/useAdaptiveEngine/${defaultModule}`
      );
    },
    [defaultModule, emitEvent]
  );

  const markTopicProgress = useCallback(
    async (input: MarkProgressInput) => {
      await emitEvent(
        "progress.topic.updated",
        {
          subject: input.subject,
          topicName: input.topicName,
          score: input.score,
          responseTimeMs: input.responseTimeMs,
          retries: input.retries,
        },
        `hooks/useAdaptiveEngine/${defaultModule}`
      );
    },
    [defaultModule, emitEvent]
  );

  const setDifficultyPreference = useCallback(
    async (difficultyPreference: IntelligenceDifficultyPreference) => {
      await emitEvent(
        "learning.behavior.tracked",
        {
          module: defaultModule,
          difficultyPreference,
        },
        `hooks/useAdaptiveEngine/${defaultModule}`
      );
    },
    [defaultModule, emitEvent]
  );

  return {
    snapshot,
    loading,
    error,
    readinessScore: engineState.readinessScore,
    recommendedDifficulty: engineState.recommendedDifficulty,
    weakAreaPriorities: engineState.weakAreaPriorities,
    strongAreaPriorities: engineState.strongAreaPriorities,
    behaviorSummary: engineState.behaviorSummary,
    trackLearning,
    markTopicProgress,
    setDifficultyPreference,
  };
}
