"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useIntelligence } from "@/features/intelligence/context/IntelligenceProvider";
import { computeRealtimeHeuristics } from "@/features/intelligence/utils/adaptive";

interface RealtimeWeakTopic {
  subject: string;
  topic: string;
  reason: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  suggestedFocus: string;
}

interface RealtimeInterviewAnalysis {
  weakTopics: RealtimeWeakTopic[];
  overallReadiness: number;
  recommendedAction: "START_TUTOR" | "CONTINUE_PRACTICE" | "READY";
  prioritySubject: string;
}

interface UseRealtimeEvaluationInput {
  userId?: string;
  transcript: Array<{ role: string; content: string }>;
  subjects?: string[];
  enabled?: boolean;
  minTurnsBeforeServerAnalysis?: number;
}

interface AnalyzeRouteSuccess {
  success: true;
  analysis: RealtimeInterviewAnalysis;
}

interface AnalyzeRouteFailure {
  success?: false;
  error?: string;
}

const MAX_REALTIME_TRANSCRIPT_ITEMS = 14;
const STREAM_DEBOUNCE_MS = 550;
const SERVER_ANALYSIS_DEBOUNCE_MS = 1000;
const MIN_TURNS_BETWEEN_STREAMS = 2;
const MIN_TURNS_BETWEEN_ANALYSES = 3;
const MIN_SIGNAL_EMIT_INTERVAL_MS = 30_000;
const MIN_SIGNAL_TURN_DELTA = 2;
const MIN_SIGNAL_SCORE_DELTA = 4;

export function useRealtimeEvaluation(input: UseRealtimeEvaluationInput) {
  const {
    userId,
    transcript,
    subjects = ["DBMS", "OS", "OOPS", "DSA", "CN"],
    enabled = true,
    minTurnsBeforeServerAnalysis = 3,
  } = input;

  const { emitEvent } = useIntelligence();

  const [analysis, setAnalysis] = useState<RealtimeInterviewAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStreamingFeedback, setIsStreamingFeedback] = useState(false);
  const [streamingFeedback, setStreamingFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const streamAbortControllerRef = useRef<AbortController | null>(null);
  const lastAnalyzedTurnCountRef = useRef(0);
  const lastStreamedTurnCountRef = useRef(0);
  const lastSignalEmitRef = useRef(0);
  const lastSignalSnapshotRef = useRef<{
    userTurnCount: number;
    confidenceScore: number;
    clarityScore: number;
    readinessScore: number;
  } | null>(null);

  const recentTranscript = useMemo(
    () => transcript.slice(Math.max(0, transcript.length - MAX_REALTIME_TRANSCRIPT_ITEMS)),
    [transcript]
  );

  const userTurnCount = useMemo(
    () => transcript.filter((message) => message.role === "user").length,
    [transcript]
  );

  const heuristics = useMemo(() => computeRealtimeHeuristics(transcript), [transcript]);

  const runServerAnalysis = useCallback(async () => {
    if (!enabled || !userId || recentTranscript.length === 0) {
      return null;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/interview/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: recentTranscript,
          userId,
          subjects,
          mode: "realtime",
        }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as AnalyzeRouteSuccess | AnalyzeRouteFailure;

      if (!response.ok || !payload || !("success" in payload) || payload.success !== true) {
        const message =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Failed to analyze realtime interview feedback";
        throw new Error(message);
      }

      setAnalysis(payload.analysis);
      lastAnalyzedTurnCountRef.current = userTurnCount;
      return payload.analysis;
    } catch (analysisError) {
      if (analysisError instanceof DOMException && analysisError.name === "AbortError") {
        return null;
      }

      setError(analysisError instanceof Error ? analysisError.message : "Realtime analysis failed");
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [enabled, recentTranscript, subjects, userId, userTurnCount]);

  const runStreamingFeedback = useCallback(async () => {
    if (!enabled || !userId || recentTranscript.length === 0) {
      return;
    }

    streamAbortControllerRef.current?.abort();
    const controller = new AbortController();
    streamAbortControllerRef.current = controller;

    setIsStreamingFeedback(true);
    setError(null);
    setStreamingFeedback("");

    try {
      const response = await fetch("/api/intelligence/realtime-feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          transcript: recentTranscript,
          subjects,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to open realtime feedback stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let aggregated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;

          try {
            const event = JSON.parse(line) as
              | { type: "delta"; text: string }
              | { type: "done"; model: string }
              | { type: "error"; error: string };

            if (event.type === "delta") {
              aggregated += event.text;
              setStreamingFeedback(aggregated.trim());
            } else if (event.type === "error") {
              throw new Error(event.error || "Realtime stream error");
            }
          } catch (parseError) {
            if (parseError instanceof Error) {
              setError(parseError.message);
            }
          }
        }
      }

      lastStreamedTurnCountRef.current = userTurnCount;
    } catch (streamError) {
      if (streamError instanceof DOMException && streamError.name === "AbortError") {
        return;
      }

      setError(streamError instanceof Error ? streamError.message : "Realtime feedback stream failed");
    } finally {
      setIsStreamingFeedback(false);
    }
  }, [enabled, recentTranscript, subjects, userId, userTurnCount]);

  useEffect(() => {
    if (!enabled || userTurnCount < 2) {
      return;
    }

    if (userTurnCount - lastStreamedTurnCountRef.current < MIN_TURNS_BETWEEN_STREAMS) {
      return;
    }

    const timer = window.setTimeout(() => {
      void runStreamingFeedback();
    }, STREAM_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled, runStreamingFeedback, userTurnCount]);

  useEffect(() => {
    if (!enabled || userTurnCount < minTurnsBeforeServerAnalysis) {
      return;
    }

    if (userTurnCount - lastAnalyzedTurnCountRef.current < MIN_TURNS_BETWEEN_ANALYSES) {
      return;
    }

    const timer = window.setTimeout(() => {
      void runServerAnalysis();
    }, SERVER_ANALYSIS_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled, minTurnsBeforeServerAnalysis, runServerAnalysis, userTurnCount]);

  useEffect(() => {
    if (!enabled || userTurnCount === 0) {
      return;
    }

    const now = Date.now();
    if (now - lastSignalEmitRef.current < MIN_SIGNAL_EMIT_INTERVAL_MS) {
      return;
    }

    const previous = lastSignalSnapshotRef.current;
    if (previous) {
      const turnDelta = userTurnCount - previous.userTurnCount;
      const confidenceDelta = Math.abs(heuristics.confidenceScore - previous.confidenceScore);
      const clarityDelta = Math.abs(heuristics.clarityScore - previous.clarityScore);
      const readinessDelta = Math.abs(heuristics.readinessScore - previous.readinessScore);

      if (
        turnDelta < MIN_SIGNAL_TURN_DELTA &&
        confidenceDelta < MIN_SIGNAL_SCORE_DELTA &&
        clarityDelta < MIN_SIGNAL_SCORE_DELTA &&
        readinessDelta < MIN_SIGNAL_SCORE_DELTA
      ) {
        return;
      }
    }

    if (heuristics.weakHints.length === 0) {
      return;
    }

    lastSignalEmitRef.current = now;
    lastSignalSnapshotRef.current = {
      userTurnCount,
      confidenceScore: heuristics.confidenceScore,
      clarityScore: heuristics.clarityScore,
      readinessScore: heuristics.readinessScore,
    };

    void emitEvent(
      "interview.realtime.signal",
      {
        confidenceScore: heuristics.confidenceScore,
        clarityScore: heuristics.clarityScore,
        readinessScore: heuristics.readinessScore,
        weakHints: heuristics.weakHints,
        retries: 0,
      },
      "hooks/useRealtimeEvaluation"
    );
  }, [emitEvent, enabled, heuristics, userTurnCount]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      streamAbortControllerRef.current?.abort();
    };
  }, []);

  const readinessScore = analysis?.overallReadiness ?? heuristics.readinessScore;

  const weakTopics = useMemo(() => {
    if (!analysis) return [];
    return analysis.weakTopics.map((topic) => topic.topic);
  }, [analysis]);

  const recommendations = useMemo(() => {
    const streamedLines = streamingFeedback
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
      .filter((line) => line.length > 0)
      .slice(0, 4);

    if (streamedLines.length > 0) {
      return streamedLines;
    }

    if (!analysis) {
      return heuristics.weakHints.map((hint) => `Focus on ${hint.toLowerCase()} in your next response.`);
    }

    const fromAnalysis = analysis.weakTopics
      .map((topic) => topic.suggestedFocus || topic.reason)
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .slice(0, 4);

    if (fromAnalysis.length > 0) {
      return fromAnalysis;
    }

    return heuristics.weakHints.map((hint) => `Focus on ${hint.toLowerCase()} in your next response.`);
  }, [analysis, heuristics.weakHints, streamingFeedback]);

  const streamingBullets = useMemo(() => {
    return streamingFeedback
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
      .filter((line) => line.length > 0)
      .slice(0, 4);
  }, [streamingFeedback]);

  return {
    analysis,
    isAnalyzing,
    isStreamingFeedback,
    streamingFeedback,
    streamingBullets,
    error,
    readinessScore,
    heuristics,
    weakTopics,
    recommendations,
    runServerAnalysis,
    runStreamingFeedback,
  };
}
