"use client";
import Image from "next/image";
import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import WeaknessModal from "./WeaknessModal";
import { getVapi } from "@/lib/vapi.sdk";
import { createFeedback } from "@/lib/actions/general.action";
import { interviewer } from "@/constants";
import { CreateAssistantDTO } from "@vapi-ai/web/dist/api";

import { AlertTriangle, BarChart3, ChevronDown, ChevronUp, Mic, PanelRightOpen, PhoneOff, Timer, Waves, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AnswerScorePanel } from "@/components/answer-scoring";
import { useAdaptiveEngine } from "@/features/intelligence/hooks/useAdaptiveEngine";
import { useRealtimeEvaluation } from "@/features/intelligence/hooks/useRealtimeEvaluation";
import { useAnswerScoring } from "@/features/intelligence/hooks/useAnswerScoring";
enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}
interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

const MAX_STORED_MESSAGES = 220;
const MAX_RENDERED_MESSAGES = 120;
const MAX_REALTIME_MESSAGES = 18;
const MAX_REALTIME_USER_MESSAGES = 14;

function isExpectedMeetingEndErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("meeting ended due to ejection") ||
    normalized.includes("meeting has ended") ||
    normalized.includes("transport changed to disconnected")
  );
}

function appendTranscriptMessage(prev: SavedMessage[], next: SavedMessage): SavedMessage[] {
  const content = next.content.trim();
  if (!content) return prev;

  const last = prev[prev.length - 1];
  if (last && last.role === next.role && last.content.trim() === content) {
    return prev;
  }

  const updated = [...prev, { ...next, content }];
  if (updated.length <= MAX_STORED_MESSAGES) {
    return updated;
  }

  return updated.slice(updated.length - MAX_STORED_MESSAGES);
}

type SummarySectionKey = "strengths" | "weaknesses" | "focusAreas" | "improvementTips" | "answers";

const Agent = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  type,
  questions,
}: AgentProps) => {
  const router = useRouter();
  const [vapi, setVapi] = useState<ReturnType<typeof getVapi>>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [connectionError, setConnectionError] = useState<string>("");
  const [, setRetryCount] = useState(0);
  const [showWeaknessModal, setShowWeaknessModal] = useState(false);
  const [weaknessAnalysis, setWeaknessAnalysis] = useState<WeaknessAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingStructuredFeedback, setIsGeneratingStructuredFeedback] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [microSummaries, setMicroSummaries] = useState<InterviewPerQuestionSummary[]>([]);
  const [latestMicroSummary, setLatestMicroSummary] = useState<InterviewPerQuestionSummary | null>(null);
  const [sessionSummary, setSessionSummary] = useState<InterviewSessionSummary | null>(null);
  const [summaryPanelOpen, setSummaryPanelOpen] = useState(false);
  const [selectedAnswerReview, setSelectedAnswerReview] = useState<number | null>(null);
  const [generatedFeedbackId, setGeneratedFeedbackId] = useState<string | null>(feedbackId ?? null);
  const [expandedSections, setExpandedSections] = useState<Record<SummarySectionKey, boolean>>({
    strengths: true,
    weaknesses: true,
    focusAreas: true,
    improvementTips: true,
    answers: true,
  });
  const finishHandledRef = useRef(false);
  const intentionalHangupRef = useRef(false);

  const realtimeTranscript = useMemo(
    () => messages.slice(Math.max(0, messages.length - MAX_REALTIME_MESSAGES)),
    [messages]
  );

  const {
    readinessScore: adaptiveReadiness,
    recommendedDifficulty,
    weakAreaPriorities,
    trackLearning,
  } = useAdaptiveEngine("interview");

  const {
    result: latestAnswerScore,
    isLoading: isAnswerScoring,
    isOptimistic: isAnswerScoringOptimistic,
    error: answerScoringError,
    evaluateAnswer: evaluateAnswerScore,
    resetScore: resetAnswerScore,
  } = useAnswerScoring({ debounceMs: 520 });

  const realtimeEvaluation = useRealtimeEvaluation({
    userId,
    transcript: realtimeTranscript,
    enabled: type === "interview" && callStatus === CallStatus.ACTIVE,
    minTurnsBeforeServerAnalysis: 4,
  });

  useEffect(() => {
    setVapi(getVapi());
  }, []);

  function getAssistantId(): string | null {
    const raw =
      type === "generate"
        ? process.env.NEXT_PUBLIC_VAPI_GENERATOR_ASSISTANT_ID
        : process.env.NEXT_PUBLIC_VAPI_INTERVIEWER_ASSISTANT_ID;

    const fallback = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
    const id = raw || fallback;
    if (!id) return null;
    if (id === "your_vapi_assistant_id_here") return null;
    return id;
  }

  function describeVapiError(err: unknown): string {
    if (err instanceof Error) return err.message || String(err);
    if (typeof err === "string") return err;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  useEffect(() => {
    if (!vapi) return;

    const onCallStart = () => {
      setCallStatus(CallStatus.ACTIVE);
      setConnectionError("");
      setCallStartedAt(Date.now());
      setElapsedSeconds(0);
      finishHandledRef.current = false;
      intentionalHangupRef.current = false;
      trackedTurnCountRef.current = 0;
      setMessages([]);
      setMicroSummaries([]);
      setLatestMicroSummary(null);
      setSessionSummary(null);
      setSummaryPanelOpen(false);
      setSelectedAnswerReview(null);
      setGeneratedFeedbackId(feedbackId ?? null);
      resetAnswerScore();
    };

    const onCallEnd = () => {
      setCallStatus(CallStatus.FINISHED);
      setCallStartedAt(null);
    };

    const onMessage = (message: Message) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => appendTranscriptMessage(prev, newMessage));
      }
    };

    const onSpeechStart = () => {
      setIsSpeaking(true);
    };

    const onSpeechEnd = () => {
      setIsSpeaking(false);
    };

    const onError = (error: unknown) => {
      const errorMessage = describeVapiError(error);

      if (isExpectedMeetingEndErrorMessage(errorMessage)) {
        if (!intentionalHangupRef.current && errorMessage.toLowerCase().includes("transport changed to disconnected")) {
          setConnectionError("Connection lost. Please try starting the interview again.");
        }
        setCallStatus(CallStatus.FINISHED);
        setCallStartedAt(null);
        finishHandledRef.current = false;
        return;
      }

      console.error("VAPI Error:", error);
      
      // For other errors, set status to inactive and show user-friendly message
      if (errorMessage.includes("400") || errorMessage.includes("Bad Request") || errorMessage.includes("start-method-error")) {
        setConnectionError(
          "Voice setup error (Vapi rejected the request). Please verify your Vapi Public Key and Assistant ID are configured correctly."
        );
      } else {
        setConnectionError("Voice connection error. Please try again.");
      }
      setCallStatus(CallStatus.INACTIVE);
      setCallStartedAt(null);
      finishHandledRef.current = false;
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
    };
  }, [feedbackId, resetAnswerScore, vapi]);

  useEffect(() => {
    if (callStatus !== CallStatus.ACTIVE || !callStartedAt) return;

    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [callStatus, callStartedAt]);

  useEffect(() => {
    const analyzeAndShowWeakness = async (messages: SavedMessage[]) => {
      // Only analyze if it's an actual interview (not generation mode)
      if (type !== "interview" || messages.length < 4) return;

      setIsAnalyzing(true);
      try {
        const response = await fetch("/api/interview/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: messages,
            userId,
            subjects: ["DBMS", "OS", "OOPS", "DSA", "CN"],
          }),
        });

        const data = await response.json();
        if (data.success && data.analysis) {
          setWeaknessAnalysis(data.analysis);
          // Show modal after a brief delay
          setTimeout(() => {
            setShowWeaknessModal(true);
          }, 1000);
        }
      } catch (error) {
        console.error("Error analyzing interview:", error);
      } finally {
        setIsAnalyzing(false);
      }
    };

    const handleGenerateFeedback = async (messages: SavedMessage[]) => {
      if (!interviewId || !userId) {
        router.push("/");
        return;
      }

      setIsGeneratingStructuredFeedback(true);
      setSummaryPanelOpen(true);

      let structuredScoring: AnswerQualityAnalysis | null = null;

      try {
        const scoringResponse = await fetch("/api/interview/score-answers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: messages, userId }),
        });

        const scoringData = (await scoringResponse.json()) as
          | { success: true; scoring: AnswerQualityAnalysis }
          | { success: false; error?: string };

        if (scoringResponse.ok && scoringData && scoringData.success && scoringData.scoring) {
          structuredScoring = scoringData.scoring;

          if (Array.isArray(structuredScoring.perQuestionSummary) && structuredScoring.perQuestionSummary.length > 0) {
            setMicroSummaries(structuredScoring.perQuestionSummary);
            setLatestMicroSummary(structuredScoring.perQuestionSummary[structuredScoring.perQuestionSummary.length - 1]);
          }

          if (structuredScoring.sessionSummary) {
            setSessionSummary(structuredScoring.sessionSummary);
            setSummaryPanelOpen(true);
          }
        }
      } catch (error) {
        console.error("Error generating structured interview summary:", error);
      } finally {
        setIsGeneratingStructuredFeedback(false);
      }

      // Weakness modal remains part of existing inline flow.
      await analyzeAndShowWeakness(messages);

      const { success, feedbackId: id } = await createFeedback({
        interviewId,
        userId,
        transcript: messages,
        feedbackId,
        perQuestionSummary: structuredScoring?.perQuestionSummary,
        sessionSummary: structuredScoring?.sessionSummary,
      });

      if (success && id) {
        setGeneratedFeedbackId(id);
      }

      if (!structuredScoring) {
        setSummaryPanelOpen(true);
      }
    };

    if (callStatus === CallStatus.FINISHED) {
      if (type === "generate") {
        router.push("/");
      } else {
        if (finishHandledRef.current) return;
        finishHandledRef.current = true;
        if (messages.length < 2) return;
        void handleGenerateFeedback(messages);
      }
    }
  }, [messages, callStatus, feedbackId, interviewId, router, type, userId]);

  const handleCall = async () => {
    try {
      if (callStatus === CallStatus.CONNECTING || callStatus === CallStatus.ACTIVE) {
        return;
      }

      // Check if VAPI is properly configured
      if (!vapi) {
        setConnectionError(
          "Vapi is not configured. Set NEXT_PUBLIC_VAPI_WEB_TOKEN in your environment and fully restart the app (stop/start `npm run dev`, or redeploy on Vercel)."
        );
        return;
      }

      const assistantId = getAssistantId();

      // Clear any previous connection errors
      setConnectionError("");
      setCallStatus(CallStatus.CONNECTING);
      setElapsedSeconds(0);
      setCallStartedAt(null);
      intentionalHangupRef.current = false;

      if (type === "generate") {
        // Prefer configured assistantId; fall back to in-code assistant definition.
        const generatorAssistant: CreateAssistantDTO = {
          ...interviewer,
          name: "Interview Generator",
          firstMessage: `Hello ${userName}! I'm here to help you create a personalized mock interview. Let's gather some information about the type of interview you'd like to practice.`,
        };

        if (generatorAssistant.model && "messages" in generatorAssistant.model) {
          generatorAssistant.model.messages = [
            {
              role: "system",
              content: `You are an AI Interview Generator assistant helping ${userName} (ID: ${userId}) create a personalized mock interview.

Your role is to gather information about:
1. Job role/position they're applying for
2. Experience level (Junior, Mid, Senior)
3. Type of interview focus (Technical, Behavioral, or Mixed)
4. Tech stack or skills they want to practice
5. Number of questions they want (typically 5-10)

Keep the conversation friendly, professional, and focused. Ask one question at a time and wait for their response before moving to the next topic.

Once you gather all the information, summarize what you've collected and let them know their personalized interview questions will be generated shortly.

Important: This is a voice conversation, so keep responses short and conversational. Don't list everything at once - have a natural dialogue.`,
            },
          ];
        }

        await vapi.start(assistantId ?? generatorAssistant, {
          variableValues: {
            username: userName,
            userid: userId,
          },
        });
      } else {
        // For interview type, use the regular interviewer
        let formattedQuestions = "";
        if (questions) {
          formattedQuestions = questions
            .map((question) => `- ${question}`)
            .join("\n");
        }

        // Prefer configured assistantId; fall back to in-code assistant definition.
        await vapi.start(assistantId ?? interviewer, {
          variableValues: {
            questions: formattedQuestions,
          },
        });
      }
    } catch (error) {
      // Set user-friendly error message
      const details = describeVapiError(error);
      if (isExpectedMeetingEndErrorMessage(details)) {
        setCallStatus(CallStatus.FINISHED);
        setCallStartedAt(null);
        return;
      }

      console.error("Error starting VAPI call:", error);
      setCallStatus(CallStatus.INACTIVE);

      if (details.includes("400") || details.includes("Bad Request")) {
        setConnectionError(
          "Vapi rejected the request (400). Double-check your Vapi Public Key and Assistant ID in env vars, then restart the app."
        );
      } else {
        setConnectionError("Unable to start the voice interview. Please check your internet connection and try again.");
      }
      
      // Increment retry count for potential future retry logic
      setRetryCount(prev => prev + 1);
    }
  };

  const handleDisconnect = async () => {
    intentionalHangupRef.current = true;
    setCallStartedAt(null);
    setConnectionError("");

    try {
      await Promise.resolve(vapi?.stop());
    } catch (error) {
      const details = describeVapiError(error);
      if (!isExpectedMeetingEndErrorMessage(details)) {
        console.warn("Error while ending call:", details);
      }
    } finally {
      setCallStatus(CallStatus.FINISHED);
    }
  };

  const aiScrollRef = useRef<HTMLDivElement | null>(null);
  const userScrollRef = useRef<HTMLDivElement | null>(null);
  const trackedTurnCountRef = useRef(0);

  const { aiTranscript, userTranscript } = useMemo(() => {
    const ai = messages.filter((m) => m.role !== "user");
    const user = messages.filter((m) => m.role === "user");
    return { aiTranscript: ai, userTranscript: user };
  }, [messages]);

  const visibleAiTranscript = useMemo(
    () => aiTranscript.slice(Math.max(0, aiTranscript.length - MAX_RENDERED_MESSAGES)),
    [aiTranscript]
  );

  const visibleUserTranscript = useMemo(
    () => userTranscript.slice(Math.max(0, userTranscript.length - MAX_RENDERED_MESSAGES)),
    [userTranscript]
  );

  const recentUserTranscript = useMemo(
    () => userTranscript.slice(Math.max(0, userTranscript.length - MAX_REALTIME_USER_MESSAGES)),
    [userTranscript]
  );

  useEffect(() => {
    const aiEl = aiScrollRef.current;
    const userEl = userScrollRef.current;
    if (aiEl) aiEl.scrollTop = aiEl.scrollHeight;
    if (userEl) userEl.scrollTop = userEl.scrollHeight;
  }, [messages.length]);

  const formattedTime = useMemo(() => {
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [elapsedSeconds]);

  const totalQuestions = questions?.length ?? 0;
  const answeredApprox = totalQuestions > 0 ? Math.min(userTranscript.length, totalQuestions) : 0;
  const progressPct = totalQuestions > 0 ? Math.round((answeredApprox / totalQuestions) * 100) : 0;
  const showCompletionEndCta =
    type === "interview" &&
    callStatus === CallStatus.ACTIVE &&
    totalQuestions > 0 &&
    answeredApprox >= totalQuestions;

  const realtime = useMemo(() => {
    if (recentUserTranscript.length === 0) {
      return {
        confidenceScore: null as number | null,
        clarityScore: null as number | null,
        confidenceLabel: "—",
        clarityLabel: "—",
        confidenceBadgeVariant: "muted" as const,
        clarityBadgeVariant: "muted" as const,
        confidenceBadgeClass: "",
        clarityBadgeClass: "",
      };
    }

    const clamp = (n: number) => Math.max(0, Math.min(100, n));
    const scoreLabel = (n: number) => (n >= 75 ? "High" : n >= 55 ? "Medium" : "Low");
    const badgeForScore = (n: number) => {
      if (n >= 75) return { variant: "default" as const, className: "" };
      if (n >= 55) return { variant: "secondary" as const, className: "" };
      return { variant: "outline" as const, className: "border-destructive/40 text-destructive" };
    };

    const text = recentUserTranscript.map((m) => m.content).join(" ").toLowerCase();
    const words = text.match(/\b[a-z']+\b/g) ?? [];
    const totalWords = Math.max(1, words.length);

    const filler = new Set(["um", "uh", "like", "actually", "basically", "literally", "hmm"]);
    const fillerCount = words.reduce((acc, w) => acc + (filler.has(w) ? 1 : 0), 0);

    const countOccurrences = (needle: string) => (needle ? text.split(needle).length - 1 : 0);
    const hedgeHits =
      countOccurrences("not sure") +
      countOccurrences("i think") +
      countOccurrences("i guess") +
      countOccurrences("maybe") +
      countOccurrences("probably") +
      countOccurrences("i don't know");

    const structureHits =
      countOccurrences("because") +
      countOccurrences("therefore") +
      countOccurrences("for example") +
      countOccurrences("in summary") +
      countOccurrences("to summarize") +
      countOccurrences("first") +
      countOccurrences("second");

    const fillerRatio = fillerCount / totalWords;
    const avgWordsPerUtterance = totalWords / Math.max(1, recentUserTranscript.length);

    const confidenceScore = clamp(75 - fillerRatio * 180 - hedgeHits * 6);
    const clarityScore = clamp(70 - fillerRatio * 160 - Math.max(0, avgWordsPerUtterance - 40) * 0.8 + structureHits * 3);

    const confidenceBadge = badgeForScore(confidenceScore);
    const clarityBadge = badgeForScore(clarityScore);

    return {
      confidenceScore,
      clarityScore,
      confidenceLabel: scoreLabel(confidenceScore),
      clarityLabel: scoreLabel(clarityScore),
      confidenceBadgeVariant: confidenceBadge.variant,
      clarityBadgeVariant: clarityBadge.variant,
      confidenceBadgeClass: confidenceBadge.className,
      clarityBadgeClass: clarityBadge.className,
    };
  }, [recentUserTranscript]);

  const blendedReadinessScore = useMemo(() => {
    const localScore = realtimeEvaluation.readinessScore;

    if (localScore <= 0) {
      return Math.round(adaptiveReadiness);
    }

    return Math.round(adaptiveReadiness * 0.58 + localScore * 0.42);
  }, [adaptiveReadiness, realtimeEvaluation.readinessScore]);

  const adaptiveDifficultyLabel = useMemo(() => {
    if (recommendedDifficulty === "adaptive") {
      return "Auto";
    }

    return recommendedDifficulty.charAt(0).toUpperCase() + recommendedDifficulty.slice(1);
  }, [recommendedDifficulty]);

  const coachingWeakAreas = useMemo(() => {
    const fromRealtime = realtimeEvaluation.weakTopics;
    if (fromRealtime.length > 0) {
      return fromRealtime.slice(0, 5);
    }

    return weakAreaPriorities.slice(0, 5);
  }, [realtimeEvaluation.weakTopics, weakAreaPriorities]);

  const coachingRecommendations = useMemo(() => {
    if (realtimeEvaluation.streamingBullets.length > 0) {
      return realtimeEvaluation.streamingBullets.slice(0, 4);
    }

    return realtimeEvaluation.recommendations.slice(0, 4);
  }, [realtimeEvaluation.recommendations, realtimeEvaluation.streamingBullets]);

  useEffect(() => {
    if (type !== "interview") return;
    if (userTranscript.length === 0) return;
    if (trackedTurnCountRef.current >= userTranscript.length) return;

    trackedTurnCountRef.current = userTranscript.length;

    const latestAnswer = userTranscript[userTranscript.length - 1]?.content ?? "";
    const wordCount = latestAnswer.split(/\s+/).filter(Boolean).length;
    const responseTimeMs = Math.max(1500, Math.round((wordCount / 2.6) * 1000));

    let latestQuestion = `Question ${userTranscript.length}`;
    for (let idx = messages.length - 2; idx >= 0; idx -= 1) {
      const msg = messages[idx];
      if (msg.role !== "user") {
        latestQuestion = msg.content;
        break;
      }
    }

    const accuracy = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          blendedReadinessScore * 0.62 +
            realtimeEvaluation.heuristics.confidenceScore * 0.22 +
            realtimeEvaluation.heuristics.clarityScore * 0.16
        )
      )
    );

    const communicationQuality = Math.max(
      0,
      Math.min(
        100,
        Math.round(realtimeEvaluation.heuristics.clarityScore * 0.6 + realtimeEvaluation.heuristics.confidenceScore * 0.4)
      )
    );

    let suggestion = "Add one concrete real-world example to improve answer credibility.";
    if (accuracy < 60) {
      suggestion = "Answer in a clearer step-by-step structure and verify core technical correctness first.";
    } else if (communicationQuality < 60) {
      suggestion = "Use fewer filler phrases and close with a concise summary line for stronger communication.";
    } else if (coachingWeakAreas[0]) {
      suggestion = `Strengthen your explanation depth around ${coachingWeakAreas[0]}.`;
    }

    const summary: InterviewPerQuestionSummary = {
      question: latestQuestion,
      userAnswer: latestAnswer,
      accuracy,
      communicationQuality,
      suggestion,
      strengths:
        accuracy >= 70
          ? ["Solid technical direction"]
          : ["Good intent, needs tighter structure"],
      weaknesses:
        accuracy < 60
          ? ["Technical precision needs improvement"]
          : communicationQuality < 60
            ? ["Communication clarity can be sharper"]
            : ["Add deeper edge-case coverage"],
    };

    setMicroSummaries((prev) => [...prev, summary]);
    setLatestMicroSummary(summary);
    evaluateAnswerScore({ question: latestQuestion, userAnswer: latestAnswer });

    void trackLearning({
      topicName: coachingWeakAreas[0],
      score: blendedReadinessScore,
      confidence: realtime.confidenceScore ?? blendedReadinessScore,
      responseTimeMs,
      retries: 0,
      difficultyPreference: recommendedDifficulty,
    });
  }, [
    blendedReadinessScore,
    coachingWeakAreas,
    realtime.confidenceScore,
    realtimeEvaluation.heuristics.clarityScore,
    realtimeEvaluation.heuristics.confidenceScore,
    recommendedDifficulty,
    evaluateAnswerScore,
    trackLearning,
    type,
    userTranscript,
    messages,
  ]);

  const statusBadge = useMemo(() => {
    if (connectionError) {
      return {
        text: "Error",
        variant: "outline" as const,
        className: "border-destructive/40 text-destructive",
      };
    }

    switch (callStatus) {
      case CallStatus.ACTIVE:
        return { text: "Live", variant: "default" as const, className: "" };
      case CallStatus.CONNECTING:
        return { text: "Connecting", variant: "muted" as const, className: "" };
      case CallStatus.FINISHED:
        return { text: "Completed", variant: "secondary" as const, className: "" };
      case CallStatus.INACTIVE:
      default:
        return { text: "Ready", variant: "outline" as const, className: "" };
    }
  }, [callStatus, connectionError]);

  const summaryOverallScore = useMemo(() => {
    if (sessionSummary?.overallScore !== undefined) {
      return Math.max(0, Math.min(100, sessionSummary.overallScore));
    }

    return Math.max(0, Math.min(100, blendedReadinessScore));
  }, [blendedReadinessScore, sessionSummary?.overallScore]);

  const fallbackStrengths = useMemo(() => {
    const merged = microSummaries.flatMap((summary) => summary.strengths || []);
    return [...new Set(merged.map((item) => item.trim()).filter(Boolean))].slice(0, 8);
  }, [microSummaries]);

  const fallbackWeaknesses = useMemo(() => {
    const merged = microSummaries.flatMap((summary) => summary.weaknesses || []);
    return [...new Set(merged.map((item) => item.trim()).filter(Boolean))].slice(0, 8);
  }, [microSummaries]);

  const strengthsList = sessionSummary?.strengths?.length ? sessionSummary.strengths : fallbackStrengths;
  const weaknessesList = sessionSummary?.weaknesses?.length ? sessionSummary.weaknesses : fallbackWeaknesses;
  const focusAreasList =
    sessionSummary?.focusAreas?.length
      ? sessionSummary.focusAreas
      : coachingWeakAreas.length > 0
        ? coachingWeakAreas
        : weaknessesList.slice(0, 5);
  const improvementTipsList =
    sessionSummary?.improvementTips?.length
      ? sessionSummary.improvementTips
      : coachingRecommendations.length > 0
        ? coachingRecommendations
        : microSummaries.map((summary) => summary.suggestion).slice(-4);

  const toggleSummarySection = (key: SummarySectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold">
                  {type === "generate" ? "Interview Setup" : "Voice Interview"}
                </h1>
                <Badge variant={statusBadge.variant} className={cn("shrink-0", statusBadge.className)}>
                  {statusBadge.text}
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {callStatus === CallStatus.ACTIVE
                  ? isSpeaking
                    ? "AI is speaking"
                    : "Listening for your response"
                  : callStatus === CallStatus.CONNECTING
                    ? "Connecting to voice session"
                    : callStatus === CallStatus.FINISHED
                      ? "Session ended"
                      : "Press Start when you’re ready"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <Timer className="h-4 w-4" />
              <span className="tabular-nums">{formattedTime}</span>
            </div>
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            <div className="flex items-center gap-2">
              {type === "interview" ? (
                <Badge variant="outline" className="hidden sm:inline-flex">
                  Difficulty: {adaptiveDifficultyLabel}
                </Badge>
              ) : null}
              <Badge
                variant={realtime.confidenceBadgeVariant}
                className={cn("hidden sm:inline-flex", realtime.confidenceBadgeClass)}
              >
                Confidence: {realtime.confidenceLabel}
              </Badge>
              <Badge
                variant={realtime.clarityBadgeVariant}
                className={cn("hidden sm:inline-flex", realtime.clarityBadgeClass)}
              >
                Clarity: {realtime.clarityLabel}
              </Badge>
              {type === "interview" ? (
                <Badge variant="muted" className="hidden sm:inline-flex">
                  Readiness: {blendedReadinessScore}
                </Badge>
              ) : null}

              {callStatus === CallStatus.ACTIVE ? (
                <Button
                  size="sm"
                  className="hidden border border-red-700 bg-red-600 text-white hover:bg-red-700 sm:inline-flex"
                  onClick={() => void handleDisconnect()}
                  aria-label="End interview"
                >
                  <PhoneOff className="h-4 w-4" />
                  End Interview
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {totalQuestions > 0 && (
          <div className="mx-auto w-full max-w-7xl px-4 pb-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Question progress</span>
              <span className="tabular-nums">
                {answeredApprox}/{totalQuestions}
              </span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${progressPct}%` }}
                aria-label="Question progress"
              />
            </div>
          </div>
        )}

        {showCompletionEndCta && (
          <div className="mx-auto w-full max-w-7xl px-4 pb-3 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground/90">
                All questions are completed. End interview to finalize and generate your feedback.
              </p>
              <Button variant="default" size="sm" className="w-full sm:w-auto" onClick={() => void handleDisconnect()}>
                <PhoneOff className="h-4 w-4" />
                Finish Interview
              </Button>
            </div>
          </div>
        )}
      </header>

      {connectionError && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <Card className="border-destructive/40 bg-destructive/10">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p className="text-sm">{connectionError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void handleCall()}>
                Retry Connection
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className={cn("grid flex-1 grid-cols-1 gap-4", type === "interview" ? "xl:grid-cols-3" : "lg:grid-cols-2")}>
            <Card className="flex min-h-0 flex-col">
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 p-4 pb-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative size-10 overflow-hidden rounded-full border bg-muted">
                    <Image src="/ai.png" alt="AI Interviewer" fill sizes="40px" className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base">AI Interviewer</CardTitle>
                    <CardDescription className="truncate">
                      {callStatus === CallStatus.ACTIVE
                        ? isSpeaking
                          ? "Speaking"
                          : "Listening"
                        : callStatus === CallStatus.CONNECTING
                          ? "Connecting"
                          : "Ready"}
                    </CardDescription>
                  </div>
                </div>

                {isSpeaking && (
                  <Badge variant="muted" className="gap-1">
                    <Waves className="h-3.5 w-3.5 animate-pulse text-primary" />
                    Speaking
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-auto p-4 pt-0" ref={aiScrollRef}>
                <div className="space-y-2">
                  {aiTranscript.length === 0 ? (
                    <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                      AI prompts and questions will appear here.
                    </div>
                  ) : (
                    visibleAiTranscript.map((m, idx) => (
                      <div
                        key={`ai-${idx}`}
                        className={cn(
                          "rounded-xl border bg-muted/40 p-3 text-sm leading-relaxed",
                          m.role === "system" && "border-dashed text-muted-foreground"
                        )}
                        style={{ whiteSpace: "pre-wrap" }}
                      >
                        {m.content}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="flex min-h-0 flex-col">
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 p-4 pb-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative size-10 overflow-hidden rounded-full border bg-muted">
                    <Image src="/user.png" alt="Your profile" fill sizes="40px" className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{userName || "You"}</CardTitle>
                    <CardDescription className="truncate">Your answers</CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:hidden">
                  <Badge variant={realtime.confidenceBadgeVariant} className={cn(realtime.confidenceBadgeClass)}>
                    Conf: {realtime.confidenceLabel}
                  </Badge>
                  <Badge variant={realtime.clarityBadgeVariant} className={cn(realtime.clarityBadgeClass)}>
                    Clarity: {realtime.clarityLabel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-auto p-4 pt-0" ref={userScrollRef}>
                <div className="space-y-2">
                  {userTranscript.length === 0 ? (
                    <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                      Your transcript will appear here as you speak.
                    </div>
                  ) : (
                    visibleUserTranscript.map((m, idx) => (
                      <div
                        key={`user-${idx}`}
                        className="rounded-xl border border-primary/20 bg-background/40 p-3 text-sm leading-relaxed"
                        style={{ whiteSpace: "pre-wrap" }}
                      >
                        {m.content}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {type === "interview" ? (
            <Card className="flex min-h-0 flex-col">
              <CardHeader className="space-y-2 p-4 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Adaptive Live Coach</CardTitle>
                  <Badge variant="outline">{adaptiveDifficultyLabel}</Badge>
                </div>
                <CardDescription>
                  Realtime quality signals and weak-area guidance tuned to your current interview trajectory.
                </CardDescription>
              </CardHeader>

              <CardContent className="min-h-0 flex-1 overflow-auto p-4 pt-2">
                <div className="space-y-4">
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Blended readiness</span>
                      <span className="tabular-nums">{blendedReadinessScore}/100</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.max(0, Math.min(100, blendedReadinessScore))}%` }}
                      />
                    </div>
                  </div>

                  {latestMicroSummary ? (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Micro summary (latest answer)</span>
                        <span className="tabular-nums">Q{microSummaries.length}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border bg-background/70 px-2 py-1.5">
                          <p className="text-muted-foreground">Accuracy</p>
                          <p className="mt-0.5 tabular-nums font-semibold">{latestMicroSummary.accuracy}%</p>
                        </div>
                        <div className="rounded-lg border bg-background/70 px-2 py-1.5">
                          <p className="text-muted-foreground">Communication</p>
                          <p className="mt-0.5 tabular-nums font-semibold">{latestMicroSummary.communicationQuality}%</p>
                        </div>
                      </div>
                      <p className="mt-2 rounded-lg border bg-background/60 px-2.5 py-1.5 text-sm text-foreground/90">
                        {latestMicroSummary.suggestion}
                      </p>
                    </div>
                  ) : null}

                  <AnswerScorePanel
                    result={latestAnswerScore}
                    isLoading={isAnswerScoring}
                    isOptimistic={isAnswerScoringOptimistic}
                    error={answerScoringError}
                    title="Latest Answer Score"
                    description="Auto-scored after each response with quick inline feedback and detailed modal review."
                    onEvaluate={
                      latestMicroSummary
                        ? () =>
                            evaluateAnswerScore(
                              {
                                question: latestMicroSummary.question,
                                userAnswer: latestMicroSummary.userAnswer,
                              },
                              { immediate: true }
                            )
                        : undefined
                    }
                    evaluateLabel="Re-evaluate latest"
                  />

                  <div className="rounded-xl border bg-muted/30 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Realtime analyzer</span>
                      <span>
                        {realtimeEvaluation.isStreamingFeedback
                          ? "Streaming..."
                          : realtimeEvaluation.isAnalyzing
                          ? "Analyzing..."
                          : realtimeEvaluation.analysis
                            ? "Live"
                            : "Waiting for more turns"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border bg-background/70 px-2 py-1.5">
                        <p className="text-muted-foreground">Confidence</p>
                        <p className="mt-0.5 tabular-nums font-semibold">
                          {Math.round(realtimeEvaluation.heuristics.confidenceScore)}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-background/70 px-2 py-1.5">
                        <p className="text-muted-foreground">Clarity</p>
                        <p className="mt-0.5 tabular-nums font-semibold">
                          {Math.round(realtimeEvaluation.heuristics.clarityScore)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Priority weak areas</p>
                    {coachingWeakAreas.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {coachingWeakAreas.map((topic) => (
                          <Badge key={topic} variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No high-priority weak area yet.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Coaching cues</p>
                    {coachingRecommendations.length > 0 ? (
                      <ul className="space-y-1.5 text-sm text-foreground/90">
                        {coachingRecommendations.map((item, index) => (
                          <li key={`${index}-${item}`} className="rounded-lg border bg-background/60 px-2.5 py-1.5">
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Start answering and the live coach will populate cues.</p>
                    )}

                    {realtimeEvaluation.streamingFeedback ? (
                      <p className="rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs text-muted-foreground">
                        Streaming feedback active
                      </p>
                    ) : null}

                    {realtimeEvaluation.error ? (
                      <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                        {realtimeEvaluation.error}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
            ) : null}
          </div>
        </div>
      </main>

      <footer className="sticky bottom-0 z-10 border-t bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className={cn(
                  "inline-block size-2 rounded-full",
                  callStatus === CallStatus.ACTIVE
                    ? "bg-primary"
                    : callStatus === CallStatus.CONNECTING
                      ? "bg-muted-foreground/60"
                      : "bg-muted-foreground/40"
                )}
                aria-hidden="true"
              />
              <span>
                {callStatus === CallStatus.ACTIVE
                  ? "Connected"
                  : callStatus === CallStatus.CONNECTING
                    ? "Connecting"
                    : callStatus === CallStatus.FINISHED
                      ? "Completed"
                      : "Not connected"}
              </span>
            </div>

            <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
              <span>Voice recognition</span>
              <span>Real-time indicators</span>
              <span>Private by default</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {callStatus === CallStatus.FINISHED && type === "interview" && interviewId ? (
              <Button variant="outline" onClick={() => router.push(`/interview/${interviewId}/feedback`)}>
                <BarChart3 className="h-4 w-4" />
                View Feedback
              </Button>
            ) : null}

            {type === "interview" && (microSummaries.length > 0 || sessionSummary) ? (
              <Button variant="outline" onClick={() => setSummaryPanelOpen(true)}>
                <PanelRightOpen className="h-4 w-4" />
                Summary
              </Button>
            ) : null}

            {callStatus !== CallStatus.ACTIVE ? (
              <Button
                variant="gradient"
                onClick={() => handleCall()}
                disabled={callStatus === CallStatus.CONNECTING}
                className="min-w-[200px]"
              >
                {callStatus === CallStatus.CONNECTING ? (
                  <Waves className="h-4 w-4 animate-pulse" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                {callStatus === CallStatus.CONNECTING
                  ? "Connecting…"
                  : callStatus === CallStatus.FINISHED
                    ? "Start Again"
                    : "Start Interview"}
              </Button>
            ) : (
              <Button
                onClick={() => void handleDisconnect()}
                className="min-w-[200px] border border-red-700 bg-red-600 text-white hover:bg-red-700"
                aria-label="End interview"
              >
                <PhoneOff className="h-4 w-4" />
                End Interview
              </Button>
            )}
          </div>
        </div>
      </footer>

      {callStatus === CallStatus.ACTIVE ? (
        <div className="fixed bottom-24 right-4 z-40 sm:hidden">
          <Button
            size="sm"
            className="shadow-lg border border-red-700 bg-red-600 text-white hover:bg-red-700"
            onClick={() => void handleDisconnect()}
            aria-label="End interview"
          >
            <PhoneOff className="h-4 w-4" />
            End Interview
          </Button>
        </div>
      ) : null}

      <AnimatePresence>
        {summaryPanelOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/30"
              onClick={() => setSummaryPanelOpen(false)}
            />

            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="fixed right-0 top-0 z-50 h-dvh w-full max-w-xl overflow-hidden border-l border-white/30 bg-gradient-to-br from-white/20 via-white/10 to-white/5 backdrop-blur-2xl"
              role="dialog"
              aria-label="Interview summary panel"
            >
              <div className="flex h-full flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/20 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Structured Interview Feedback
                    </p>
                    <h3 className="mt-1 truncate text-lg font-semibold">Session Summary</h3>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSummaryPanelOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  {(isGeneratingStructuredFeedback || isAnalyzing) && (
                    <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm text-foreground/90">
                      Generating structured summary and recommendations...
                    </div>
                  )}

                  <div className="rounded-2xl border border-white/30 bg-white/20 p-4 shadow-xl">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Overall Score</p>
                      <p className="text-lg font-bold tabular-nums">{summaryOverallScore}%</p>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/30">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${summaryOverallScore}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="h-2.5 rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/30 bg-white/15 p-3">
                    <button
                      type="button"
                      onClick={() => toggleSummarySection("strengths")}
                      className="flex w-full items-center justify-between"
                    >
                      <span className="text-sm font-semibold">Strengths</span>
                      {expandedSections.strengths ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {expandedSections.strengths ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {strengthsList.length > 0 ? (
                          strengthsList.map((item) => (
                            <Badge key={`strength-${item}`} variant="outline" className="border-emerald-400/40 bg-emerald-500/15 text-emerald-900">
                              {item}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No strengths captured yet.</p>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-white/30 bg-white/15 p-3">
                    <button
                      type="button"
                      onClick={() => toggleSummarySection("weaknesses")}
                      className="flex w-full items-center justify-between"
                    >
                      <span className="text-sm font-semibold">Weaknesses</span>
                      {expandedSections.weaknesses ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {expandedSections.weaknesses ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {weaknessesList.length > 0 ? (
                          weaknessesList.map((item) => (
                            <Badge key={`weakness-${item}`} variant="outline" className="border-rose-400/40 bg-rose-500/15 text-rose-900">
                              {item}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No weaknesses detected yet.</p>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-white/30 bg-white/15 p-3">
                    <button
                      type="button"
                      onClick={() => toggleSummarySection("focusAreas")}
                      className="flex w-full items-center justify-between"
                    >
                      <span className="text-sm font-semibold">Suggested Focus Areas</span>
                      {expandedSections.focusAreas ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {expandedSections.focusAreas ? (
                      <ul className="mt-3 space-y-2 text-sm">
                        {focusAreasList.length > 0 ? (
                          focusAreasList.map((item, index) => (
                            <li key={`focus-${index}-${item}`} className="rounded-lg border border-white/30 bg-white/25 px-2.5 py-1.5">
                              {item}
                            </li>
                          ))
                        ) : (
                          <li className="text-muted-foreground">No focus areas yet.</li>
                        )}
                      </ul>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-white/30 bg-white/15 p-3">
                    <button
                      type="button"
                      onClick={() => toggleSummarySection("improvementTips")}
                      className="flex w-full items-center justify-between"
                    >
                      <span className="text-sm font-semibold">Improvement Tips</span>
                      {expandedSections.improvementTips ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {expandedSections.improvementTips ? (
                      <ul className="mt-3 space-y-2 text-sm">
                        {improvementTipsList.length > 0 ? (
                          improvementTipsList.map((item, index) => (
                            <li key={`tip-${index}-${item}`} className="rounded-lg border border-white/30 bg-white/25 px-2.5 py-1.5">
                              {item}
                            </li>
                          ))
                        ) : (
                          <li className="text-muted-foreground">No tips available yet.</li>
                        )}
                      </ul>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-white/30 bg-white/15 p-3">
                    <button
                      type="button"
                      onClick={() => toggleSummarySection("answers")}
                      className="flex w-full items-center justify-between"
                    >
                      <span className="text-sm font-semibold">Revisit Each Answer</span>
                      {expandedSections.answers ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {expandedSections.answers ? (
                      <div className="mt-3 space-y-2">
                        {microSummaries.length > 0 ? (
                          microSummaries.map((summary, index) => {
                            const expanded = selectedAnswerReview === index;

                            return (
                              <div key={`review-${index}`} className="rounded-xl border border-white/30 bg-white/25 p-2.5">
                                <button
                                  type="button"
                                  className="flex w-full items-start justify-between gap-2 text-left"
                                  onClick={() => setSelectedAnswerReview(expanded ? null : index)}
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                      Answer {index + 1}
                                    </p>
                                    <p className="truncate text-sm font-medium">{summary.question}</p>
                                  </div>
                                  <div className="shrink-0">
                                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </div>
                                </button>

                                {expanded ? (
                                  <div className="mt-2 space-y-2 text-sm">
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div className="rounded-lg border border-white/30 bg-white/30 px-2 py-1.5">
                                        <p className="text-muted-foreground">Accuracy</p>
                                        <p className="font-semibold tabular-nums">{summary.accuracy}%</p>
                                      </div>
                                      <div className="rounded-lg border border-white/30 bg-white/30 px-2 py-1.5">
                                        <p className="text-muted-foreground">Communication</p>
                                        <p className="font-semibold tabular-nums">{summary.communicationQuality}%</p>
                                      </div>
                                    </div>
                                    <div className="rounded-lg border border-white/30 bg-white/30 px-2 py-1.5 text-xs">
                                      <p className="mb-1 font-semibold text-muted-foreground">Your answer</p>
                                      <p>{summary.userAnswer || "No answer captured."}</p>
                                    </div>
                                    <div className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-1.5 text-xs">
                                      <p className="mb-1 font-semibold text-muted-foreground">Suggestion</p>
                                      <p>{summary.suggestion}</p>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-muted-foreground">Answer summaries will appear as the interview progresses.</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="border-t border-white/20 p-4">
                  <div className="flex items-center gap-2">
                    {interviewId ? (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => router.push(`/interview/${interviewId}/feedback`)}
                      >
                        <BarChart3 className="h-4 w-4" />
                        Full Feedback Page
                      </Button>
                    ) : null}
                    <Button className="flex-1" onClick={() => setSummaryPanelOpen(false)}>
                      Close
                    </Button>
                  </div>
                  {generatedFeedbackId ? (
                    <p className="mt-2 text-xs text-muted-foreground">Feedback saved successfully.</p>
                  ) : null}
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <WeaknessModal
        isOpen={showWeaknessModal}
        onClose={() => setShowWeaknessModal(false)}
        analysis={weaknessAnalysis}
      />

      {isAnalyzing && (
        <div className="fixed bottom-24 right-4 z-50">
          <Card className="w-[280px]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Waves className="h-4 w-4 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Analyzing performance…</p>
                  <p className="text-xs text-muted-foreground">Generating feedback and weak areas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Agent;
