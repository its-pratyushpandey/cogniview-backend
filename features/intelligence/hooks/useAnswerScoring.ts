"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface EvaluateAnswerPayload {
  question: string;
  userAnswer: string;
}

interface EvaluateAnswerOptions {
  immediate?: boolean;
}

interface UseAnswerScoringOptions {
  debounceMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 420;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function buildOptimisticEvaluation(payload: EvaluateAnswerPayload): AnswerScoreEvaluation {
  const words = payload.userAnswer.trim().split(/\s+/).filter(Boolean).length;
  const sentences = payload.userAnswer
    .split(/[.!?]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean).length;

  const lengthSignal = clamp(words * 1.4, 30, 84);
  const structureSignal = clamp(sentences * 16, 26, 88);
  const accuracy = clamp(Math.round(lengthSignal * 0.72 + structureSignal * 0.28));
  const clarity = clamp(Math.round(structureSignal * 0.72 + lengthSignal * 0.28));
  const depth = clamp(Math.round(lengthSignal * 0.78 + sentences * 7));
  const score = clamp(Math.round((accuracy + clarity + depth) / 3));

  return {
    question: payload.question,
    userAnswer: payload.userAnswer,
    score,
    clarity,
    accuracy,
    depth,
    feedback: "Preparing AI evaluation...",
    strengths: ["Response submitted successfully"],
    weaknesses: [],
    improvementTips: ["Generating detailed coaching tips..."],
    modelAnswer: "Generating model answer...",
  };
}

export function useAnswerScoring(options?: UseAnswerScoringOptions) {
  const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const [result, setResult] = useState<AnswerScoreEvaluation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimistic, setIsOptimistic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeoutRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const clearPending = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const runRequest = useCallback(async (payload: EvaluateAnswerPayload, requestId: number) => {
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/answer-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const parsed = (await response.json()) as AnswerScoreApiSuccess | AnswerScoreApiFailure;

      if (!response.ok || !parsed.success) {
        const message = !parsed.success ? parsed.error : "Unable to score this answer right now.";
        throw new Error(message || "Unable to score this answer right now.");
      }

      if (requestIdRef.current !== requestId) {
        return;
      }

      setResult(parsed.result);
      setError(null);
      setIsOptimistic(false);
      setIsLoading(false);
    } catch (requestError) {
      if (controller.signal.aborted || requestIdRef.current !== requestId) {
        return;
      }

      setIsLoading(false);
      setIsOptimistic(false);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to score this answer right now."
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, []);

  const evaluateAnswer = useCallback(
    (payload: EvaluateAnswerPayload, evalOptions?: EvaluateAnswerOptions) => {
      const question = payload.question.trim();
      const userAnswer = payload.userAnswer.trim();
      if (!question || !userAnswer) {
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      clearPending();
      setError(null);
      setIsLoading(true);
      setIsOptimistic(true);
      setResult(buildOptimisticEvaluation({ question, userAnswer }));

      const execute = () => {
        void runRequest({ question, userAnswer }, requestId);
      };

      if (evalOptions?.immediate) {
        execute();
        return;
      }

      timeoutRef.current = window.setTimeout(execute, debounceMs);
    },
    [clearPending, debounceMs, runRequest]
  );

  const resetScore = useCallback(() => {
    clearPending();
    setResult(null);
    setError(null);
    setIsLoading(false);
    setIsOptimistic(false);
  }, [clearPending]);

  useEffect(() => {
    return () => {
      clearPending();
    };
  }, [clearPending]);

  return {
    result,
    isLoading,
    isOptimistic,
    error,
    evaluateAnswer,
    resetScore,
  };
}
