"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Expand, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FeedbackBreakdown } from "@/components/answer-scoring/FeedbackBreakdown";
import { ImprovementTipsCard } from "@/components/answer-scoring/ImprovementTipsCard";
import { ScoreCircle } from "@/components/answer-scoring/ScoreCircle";

interface AnswerScorePanelProps {
  result: AnswerScoreEvaluation | null;
  isLoading?: boolean;
  isOptimistic?: boolean;
  error?: string | null;
  onEvaluate?: () => void;
  evaluateLabel?: string;
  className?: string;
  title?: string;
  description?: string;
}

function scoreTone(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Developing";
  return "Needs Work";
}

export function AnswerScorePanel({
  result,
  isLoading = false,
  isOptimistic = false,
  error,
  onEvaluate,
  evaluateLabel = "Evaluate Answer",
  className,
  title = "AI Score + Feedback",
  description = "Quick inline score with a detailed analysis modal.",
}: AnswerScorePanelProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const quickFeedback = useMemo(() => {
    if (!result?.feedback) {
      return "Submit an answer to receive AI scoring and coaching insights.";
    }

    return result.feedback;
  }, [result?.feedback]);

  const showSkeleton = isLoading && !result;

  return (
    <>
      <Card className={cn("rounded-2xl border-border/80 bg-card/75 shadow-lg shadow-black/20", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            {isOptimistic ? (
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                Provisional
              </Badge>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {showSkeleton ? (
            <div className="space-y-2 rounded-xl border border-border/80 bg-secondary/40 p-3 text-sm text-muted-foreground">
              <p>Scoring response...</p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className="h-2 w-1/2 rounded-full bg-primary/60"
                  animate={{ x: ["-20%", "120%"] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              </div>
            </div>
          ) : result ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <ScoreCircle score={result.score} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-border/80 bg-secondary/50 text-foreground">
                      {scoreTone(result.score)}
                    </Badge>
                    <Badge variant="outline" className="border-border/80 bg-secondary/50 text-muted-foreground">
                      Score {result.score}/100
                    </Badge>
                  </div>

                  <p className="text-sm text-foreground/90">{quickFeedback}</p>
                </div>
              </div>

              <FeedbackBreakdown
                clarity={result.clarity}
                accuracy={result.accuracy}
                depth={result.depth}
              />
            </motion.div>
          ) : (
            <div className="rounded-xl border border-border/80 bg-secondary/45 p-3 text-sm text-muted-foreground">
              No answer evaluated yet.
            </div>
          )}

          {error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {onEvaluate ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onEvaluate}
                disabled={isLoading}
                className="rounded-xl"
              >
                <Sparkles className="h-4 w-4" />
                {isLoading ? "Evaluating..." : evaluateLabel}
              </Button>
            ) : null}

            {result ? (
              <Button variant="default" size="sm" className="rounded-xl" onClick={() => setDetailsOpen(true)}>
                <Expand className="h-4 w-4" />
                Detailed analysis
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {detailsOpen && result ? (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailsOpen(false)}
            />

            <motion.section
              role="dialog"
              aria-label="Detailed answer analysis"
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
            >
              <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-border/80 bg-background shadow-2xl shadow-black/50">
                <div className="flex items-start justify-between border-b border-border/80 px-5 py-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Answer Analysis</p>
                    <h3 className="mt-1 text-lg font-semibold">Detailed AI Evaluation</h3>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setDetailsOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="max-h-[80dvh] space-y-4 overflow-y-auto p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <ScoreCircle score={result.score} size={148} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm text-muted-foreground">Question</p>
                      <p className="rounded-xl border border-border/80 bg-secondary/40 px-3 py-2 text-sm">
                        {result.question}
                      </p>
                      <p className="text-sm text-muted-foreground">Your answer</p>
                      <p className="rounded-xl border border-border/80 bg-secondary/40 px-3 py-2 text-sm">
                        {result.userAnswer}
                      </p>
                    </div>
                  </div>

                  <Card className="rounded-2xl border-border/80 bg-card/70">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Feedback Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FeedbackBreakdown
                        clarity={result.clarity}
                        accuracy={result.accuracy}
                        depth={result.depth}
                      />
                    </CardContent>
                  </Card>

                  <ImprovementTipsCard
                    tips={result.improvementTips}
                    strengths={result.strengths}
                    weaknesses={result.weaknesses}
                  />

                  {result.modelAnswer ? (
                    <Card className="rounded-2xl border-border/80 bg-card/70">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Model Answer</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-foreground/90">{result.modelAnswer}</p>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </div>
            </motion.section>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
