"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AdaptiveQuestion,
  ExperienceLevel,
  QuestionGenerationMode,
  ResumeIntelligence,
} from "@/features/resume-analysis/types";
import { computeAnalysisHash } from "@/features/resume-analysis/utils/resume-intelligence";

interface QuestionApiResponse {
  success: boolean;
  planId: string;
  cached: boolean;
  mode: QuestionGenerationMode;
  questions: AdaptiveQuestion[];
  focusAreas: string[];
  intelligence: ResumeIntelligence;
  error?: string;
}

type QuestionStatus = "idle" | "loading" | "success" | "error";

interface GenerateParams {
  analysisId?: string;
  mode?: QuestionGenerationMode;
  selectedRole?: string;
  customTopics?: string[];
  difficulty?: ExperienceLevel;
  count?: number;
}

export function useQuestionGenerator(userId: string) {
  const [status, setStatus] = useState<QuestionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AdaptiveQuestion[]>([]);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [mode, setMode] = useState<QuestionGenerationMode>("weak-areas");
  const [customTopicsText, setCustomTopicsText] = useState("");

  const requestCacheRef = useRef<Map<string, QuestionApiResponse>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  const parsedCustomTopics = useMemo(
    () =>
      customTopicsText
        .split(",")
        .map((topic) => topic.trim())
        .filter(Boolean),
    [customTopicsText]
  );

  const generateQuestions = useCallback(
    async (params: GenerateParams): Promise<QuestionApiResponse | null> => {
      const resolvedMode = params.mode ?? mode;
      const customTopics =
        resolvedMode === "custom"
          ? (params.customTopics && params.customTopics.length > 0 ? params.customTopics : parsedCustomTopics)
          : [];

      const cacheKey = computeAnalysisHash(
        JSON.stringify({
          userId,
          analysisId: params.analysisId ?? "latest",
          mode: resolvedMode,
          selectedRole: params.selectedRole ?? "",
          customTopics,
          difficulty: params.difficulty ?? "auto",
          count: params.count ?? 9,
        })
      );

      const inMemory = requestCacheRef.current.get(cacheKey);
      if (inMemory) {
        setQuestions(inMemory.questions);
        setFocusAreas(inMemory.focusAreas);
        setError(null);
        setStatus("success");
        return inMemory;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setStatus("loading");
      setError(null);

      try {
        const response = await fetch("/api/resume/questions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            analysisId: params.analysisId,
            mode: resolvedMode,
            selectedRole: params.selectedRole,
            customTopics,
            difficulty: params.difficulty,
            count: params.count,
          }),
          signal: abortController.signal,
        });

        const payload = (await response.json()) as QuestionApiResponse;

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Unable to generate questions");
        }

        requestCacheRef.current.set(cacheKey, payload);
        setQuestions(payload.questions);
        setFocusAreas(payload.focusAreas);
        setStatus("success");
        setError(null);

        return payload;
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") {
          return null;
        }

        const message = requestError instanceof Error ? requestError.message : "Question generation failed";
        setStatus("error");
        setError(message);
        return null;
      }
    },
    [mode, parsedCustomTopics, userId]
  );

  useEffect(() => {
    if (mode !== "custom") {
      return;
    }

    if (parsedCustomTopics.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      void generateQuestions({ mode: "custom", customTopics: parsedCustomTopics });
    }, 500);

    return () => clearTimeout(timer);
  }, [generateQuestions, mode, parsedCustomTopics]);

  return {
    status,
    error,
    questions,
    focusAreas,
    mode,
    setMode,
    customTopicsText,
    setCustomTopicsText,
    parsedCustomTopics,
    generateQuestions,
    clearError: () => setError(null),
  };
}
