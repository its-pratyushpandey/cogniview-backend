"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type StreamingCoachModule = "mcq" | "coding";
export type StreamingCoachEvent =
  | "question_answered"
  | "code_executed"
  | "code_evaluated"
  | "session_summary";

interface StreamFeedbackInput {
  userId: string;
  module: StreamingCoachModule;
  event: StreamingCoachEvent;
  metrics: Record<string, unknown>;
  history?: string[];
}

type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; model: string }
  | { type: "error"; error: string };

export function useStreamingCoach() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const streamFeedback = useCallback(async (input: StreamFeedbackInput) => {
    if (!input.userId.trim()) {
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsStreaming(true);
    setError(null);
    setFeedbackText("");

    try {
      const response = await fetch("/api/intelligence/live-score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to open live coach stream");
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
            const event = JSON.parse(line) as StreamEvent;
            if (event.type === "delta") {
              aggregated += event.text;
              setFeedbackText(aggregated.trim());
            } else if (event.type === "error") {
              throw new Error(event.error || "Live coach streaming failed");
            }
          } catch (parseError) {
            if (parseError instanceof Error) {
              setError(parseError.message);
            }
          }
        }
      }
    } catch (streamError) {
      if (streamError instanceof DOMException && streamError.name === "AbortError") {
        return;
      }

      setError(streamError instanceof Error ? streamError.message : "Live coach request failed");
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setError(null);
    setFeedbackText("");
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const bullets = useMemo(() => {
    return feedbackText
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
      .filter((line) => line.length > 0)
      .slice(0, 4);
  }, [feedbackText]);

  return {
    isStreaming,
    feedbackText,
    bullets,
    error,
    streamFeedback,
    reset,
  };
}
