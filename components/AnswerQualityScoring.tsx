"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";

import { AnswerScorePanel } from "@/components/answer-scoring";
import { ScoreCircle } from "@/components/answer-scoring";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnswerScoring } from "@/features/intelligence/hooks/useAnswerScoring";

interface AnswerQualityScoringProps {
  transcript?: Array<{ role: string; content: string }>;
  interviewId?: string;
  userId?: string;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function mapToEvaluation(answer: AnswerScore, recommendations: string[]): AnswerScoreEvaluation {
  return {
    question: answer.question,
    userAnswer: answer.userAnswer,
    score: clamp(answer.overallScore * 10),
    clarity: clamp(((answer.terminologyUsage + answer.interviewReadiness) / 2) * 10),
    accuracy: clamp(answer.technicalCorrectness * 10),
    depth: clamp(answer.depthOfExplanation * 10),
    feedback: answer.improvement,
    improvementTips: [answer.improvement, ...recommendations.slice(0, 2)],
    strengths: answer.strengths,
    weaknesses: answer.weaknesses,
    modelAnswer: answer.modelAnswer,
  };
}

export default function AnswerQualityScoring({
  transcript = [],
  interviewId,
  userId,
}: AnswerQualityScoringProps) {
  const [question, setQuestion] = useState("");
  const [userAnswer, setUserAnswer] = useState("");
  const [analysis, setAnalysis] = useState<AnswerQualityAnalysis | null>(null);
  const [isAnalyzingInterview, setIsAnalyzingInterview] = useState(false);
  const [interviewError, setInterviewError] = useState<string | null>(null);

  const manualScoring = useAnswerScoring({ debounceMs: 500 });

  const hasTranscript = transcript.length > 0;

  const interviewEvaluations = useMemo(() => {
    if (!analysis) {
      return [] as AnswerScoreEvaluation[];
    }

    return analysis.answerScores.map((answer) => mapToEvaluation(answer, analysis.recommendations));
  }, [analysis]);

  const averageInterviewScore = useMemo(() => {
    if (interviewEvaluations.length === 0) {
      return 0;
    }

    const total = interviewEvaluations.reduce((sum, item) => sum + item.score, 0);
    return clamp(total / interviewEvaluations.length);
  }, [interviewEvaluations]);

  const analyzeInterviewAnswers = async () => {
    if (!hasTranscript) {
      return;
    }

    setIsAnalyzingInterview(true);
    setInterviewError(null);

    try {
      const response = await fetch("/api/interview/score-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, userId }),
      });

      const payload = (await response.json()) as
        | { success: true; scoring: AnswerQualityAnalysis }
        | { success: false; error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(!payload.success ? payload.error || "Failed to analyze interview answers." : "Failed to analyze interview answers.");
      }

      setAnalysis(payload.scoring);
    } catch (analysisError) {
      setInterviewError(
        analysisError instanceof Error
          ? analysisError.message
          : "Failed to analyze interview answers."
      );
    } finally {
      setIsAnalyzingInterview(false);
    }
  };

  const evaluateManualAnswer = () => {
    manualScoring.evaluateAnswer(
      {
        question,
        userAnswer,
      },
      { immediate: true }
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <section className="rounded-3xl border border-border/80 bg-card/75 p-6 shadow-lg shadow-black/20">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analyze My Answers</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Quick score inline, detailed coaching in a modal, and professional feedback dimensions for every answer.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="rounded-2xl border-border/80 bg-card/75 shadow-lg shadow-black/20 lg:col-span-2">
          <CardHeader>
            <CardTitle>Manual Evaluation</CardTitle>
            <CardDescription>Paste any interview question and your answer for instant AI scoring.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Question</label>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border/80 bg-secondary/45 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                placeholder="Example: Explain indexing strategies in relational databases."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your Answer</label>
              <textarea
                value={userAnswer}
                onChange={(event) => setUserAnswer(event.target.value)}
                rows={5}
                className="w-full rounded-xl border border-border/80 bg-secondary/45 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                placeholder="Write your interview answer here..."
              />
            </div>

            <Button
              onClick={evaluateManualAnswer}
              disabled={!question.trim() || !userAnswer.trim() || manualScoring.isLoading}
            >
              {manualScoring.isLoading ? "Evaluating..." : "Evaluate Now"}
            </Button>
          </CardContent>
        </Card>

        <AnswerScorePanel
          result={manualScoring.result}
          isLoading={manualScoring.isLoading}
          isOptimistic={manualScoring.isOptimistic}
          error={manualScoring.error}
          onEvaluate={evaluateManualAnswer}
          evaluateLabel="Re-evaluate"
          className="lg:col-span-3"
        />
      </section>

      <Card className="rounded-2xl border-border/80 bg-card/75 shadow-lg shadow-black/20">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Interview Flow Evaluation</CardTitle>
            <CardDescription>
              {hasTranscript
                ? "Analyze answers captured from your latest interview session."
                : "No transcript attached. You can still use manual evaluation above."}
            </CardDescription>
          </div>

          {hasTranscript ? (
            <Button onClick={analyzeInterviewAnswers} disabled={isAnalyzingInterview}>
              {isAnalyzingInterview ? "Analyzing transcript..." : analysis ? "Re-analyze transcript" : "Analyze transcript"}
            </Button>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4">
          {interviewError ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {interviewError}
            </p>
          ) : null}

          {analysis ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="rounded-2xl border border-border/80 bg-secondary/45 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <ScoreCircle score={averageInterviewScore} label="Average Interview Score" />
                  <div className="grid flex-1 grid-cols-2 gap-2 text-sm sm:max-w-md">
                    <div className="rounded-xl border border-border/80 bg-card/70 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Analyzed Answers</p>
                      <p className="text-base font-semibold tabular-nums">{analysis.overallStats.totalAnswers}</p>
                    </div>
                    <div className="rounded-xl border border-border/80 bg-card/70 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Strong Answers</p>
                      <p className="text-base font-semibold tabular-nums">{analysis.overallStats.strongAnswers}</p>
                    </div>
                    <div className="rounded-xl border border-border/80 bg-card/70 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Needs Improvement</p>
                      <p className="text-base font-semibold tabular-nums">{analysis.overallStats.weakAnswers}</p>
                    </div>
                    <div className="rounded-xl border border-border/80 bg-card/70 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Interview Readiness</p>
                      <p className="text-base font-semibold tabular-nums">
                        {clamp(analysis.overallStats.avgInterviewReadiness * 10)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {interviewEvaluations.map((evaluation, index) => (
                  <AnswerScorePanel
                    key={`${index}-${evaluation.question}`}
                    result={evaluation}
                    title={`Answer ${index + 1}`}
                    description="Inline score with optional detailed review."
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="rounded-xl border border-border/80 bg-secondary/40 p-4 text-sm text-muted-foreground">
              {hasTranscript
                ? "Run transcript analysis to generate per-answer quality insights."
                : "Start an interview, then return here to analyze captured answers."}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {interviewId ? (
              <Button asChild variant="outline">
                <Link href={`/interview/${interviewId}/feedback`}>Open Feedback</Link>
              </Button>
            ) : null}

            <Button asChild variant="outline">
              <Link href="/interview">Go To Interview</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
