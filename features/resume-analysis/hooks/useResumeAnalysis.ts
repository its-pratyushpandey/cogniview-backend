"use client";

import { useCallback, useRef, useState } from "react";

import type { ResumeAnalysisResponse } from "@/features/resume-analysis/types";
import { computeAnalysisHash } from "@/features/resume-analysis/utils/resume-intelligence";

type AnalysisStatus = "idle" | "loading" | "success" | "error";

interface AnalyzeResumeParams {
  resumeText: string;
  selectedRole?: string;
  forceRefresh?: boolean;
}

interface AnalysisError {
  message: string;
  retryable: boolean;
}

export function useResumeAnalysis(userId: string) {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<AnalysisError | null>(null);
  const [response, setResponse] = useState<ResumeAnalysisResponse | null>(null);

  const cacheRef = useRef<Map<string, ResumeAnalysisResponse>>(new Map());
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startProgressTimer = useCallback(() => {
    resetProgressTimer();
    setProgress(5);

    progressTimerRef.current = setInterval(() => {
      setProgress((current) => {
        if (current >= 92) {
          return current;
        }
        return current + Math.max(1, Math.floor((96 - current) / 6));
      });
    }, 160);
  }, [resetProgressTimer]);

  const analyzeResume = useCallback(
    async (params: AnalyzeResumeParams): Promise<ResumeAnalysisResponse | null> => {
      const trimmedResume = params.resumeText.trim();
      if (!trimmedResume) {
        setError({ message: "Resume content is empty.", retryable: false });
        setStatus("error");
        return null;
      }

      const cacheKey = computeAnalysisHash(`${trimmedResume}:${params.selectedRole ?? ""}`);
      if (!params.forceRefresh && cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey) ?? null;
        setResponse(cached);
        setError(null);
        setStatus("success");
        setProgress(100);
        return cached;
      }

      setStatus("loading");
      setError(null);
      startProgressTimer();

      try {
        const res = await fetch("/api/resume/intelligence", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            resumeText: trimmedResume,
            selectedRole: params.selectedRole,
            forceRefresh: params.forceRefresh,
          }),
        });

        const payload = (await res.json()) as ResumeAnalysisResponse | { error?: string; details?: unknown };

        if (!res.ok || !("success" in payload && payload.success)) {
          const message =
            "error" in payload && typeof payload.error === "string"
              ? payload.error
              : "Resume analysis failed. Please try again.";
          throw new Error(message);
        }

        cacheRef.current.set(cacheKey, payload);
        setResponse(payload);
        setStatus("success");
        setProgress(100);
        return payload;
      } catch (fetchError) {
        setStatus("error");
        setError({
          message:
            fetchError instanceof Error
              ? fetchError.message
              : "Unable to analyze resume right now. Please retry.",
          retryable: true,
        });
        return null;
      } finally {
        resetProgressTimer();
      }
    },
    [resetProgressTimer, startProgressTimer, userId]
  );

  return {
    status,
    progress,
    error,
    response,
    analyzeResume,
    clearError: () => setError(null),
  };
}
