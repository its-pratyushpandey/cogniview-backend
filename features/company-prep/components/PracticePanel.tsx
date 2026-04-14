"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookText, BrainCircuit, ChevronsUpDown, Lightbulb } from "lucide-react";

import { AdaptiveContext, CompanyQuestion, Difficulty, QuestionType } from "@/features/company-prep/types";
import { WhyThisQuestionCard } from "@/features/intelligence/components/WhyThisQuestionCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PracticePanelProps {
  questions: CompanyQuestion[];
  adaptive: AdaptiveContext | null;
  loading: boolean;
  selectedDifficulty: Difficulty | "adaptive";
  selectedQuestionType: QuestionType | "all";
  onDifficultyChange: (value: Difficulty | "adaptive") => void;
  onQuestionTypeChange: (value: QuestionType | "all") => void;
}

function getDifficultyBadgeClass(difficulty: Difficulty): string {
  switch (difficulty) {
    case "easy":
      return "border-accent/35 bg-accent/12 text-accent";
    case "medium":
      return "border-warning/35 bg-warning/12 text-warning";
    case "hard":
    default:
      return "border-danger/35 bg-danger/12 text-danger";
  }
}

function PracticeSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={`practice-skeleton-${index}`}>
          <CardContent className="space-y-4 p-5">
            <Skeleton className="h-5 w-4/5" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PracticePanel(props: PracticePanelProps) {
  const {
    questions,
    adaptive,
    loading,
    selectedDifficulty,
    selectedQuestionType,
    onDifficultyChange,
    onQuestionTypeChange,
  } = props;

  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const emptyStateText = useMemo(() => {
    if (selectedQuestionType !== "all") {
      return `No ${selectedQuestionType} questions found for this filter.`;
    }

    return "No questions available for this selection yet.";
  }, [selectedQuestionType]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookText className="h-5 w-5 text-primary" />
            Adaptive Practice
          </CardTitle>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onDifficultyChange("adaptive")}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                selectedDifficulty === "adaptive"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background"
              }`}
            >
              Adaptive
            </button>
            {(["easy", "medium", "hard"] as Difficulty[]).map((difficulty) => (
              <button
                key={difficulty}
                type="button"
                onClick={() => onDifficultyChange(difficulty)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  selectedDifficulty === difficulty
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background"
                }`}
              >
                {difficulty}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "mcq", "coding", "theory"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onQuestionTypeChange(type)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  selectedQuestionType === type
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {adaptive ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="muted" className="capitalize">
                  Recommended: {adaptive.recommendedDifficulty}
                </Badge>
                <span className="text-muted-foreground">Weak Areas:</span>
                {adaptive.weakAreas.length > 0 ? (
                  adaptive.weakAreas.slice(0, 4).map((tag) => (
                    <Badge key={`weak-${tag}`} variant="outline" className="capitalize">
                      {tag.replace(/-/g, " ")}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">No weak areas detected yet.</span>
                )}
              </div>
            </div>
          ) : null}
        </CardHeader>
      </Card>

      {loading ? <PracticeSkeleton /> : null}

      {!loading && questions.length === 0 ? (
        <Card>
          <CardContent className="grid place-items-center gap-3 p-8 text-center">
            <BrainCircuit className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{emptyStateText}</p>
          </CardContent>
        </Card>
      ) : null}

      {!loading && questions.length > 0 ? (
        <div className="space-y-3">
          {questions.map((question, index) => {
            const expanded = expandedQuestionId === question.id;

            return (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.25) }}
              >
                <Card className="overflow-hidden border-border/70">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="text-sm font-medium leading-relaxed">{question.question}</p>
                      <div className="flex gap-2">
                        <Badge variant="outline" className={getDifficultyBadgeClass(question.difficulty)}>
                          {question.difficulty}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {question.type}
                        </Badge>
                      </div>
                    </div>

                    {question.mistakePriority ? (
                      <WhyThisQuestionCard
                        metadata={question.mistakePriority}
                        moduleLabel="Company prep adaptive"
                        topic={question.tags[0] || question.type}
                        difficulty={question.difficulty}
                      />
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      {question.tags.slice(0, 6).map((tag) => (
                        <Badge key={`${question.id}-${tag}`} variant="muted" className="capitalize">
                          {tag.replace(/-/g, " ")}
                        </Badge>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedQuestionId(expanded ? null : question.id)}
                      className="flex w-full items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm font-medium"
                    >
                      <span className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        {expanded ? "Hide answer and explanation" : "View answer and explanation"}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                    </button>

                    <AnimatePresence initial={false}>
                      {expanded ? (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-3 overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-4"
                        >
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Answer
                            </h4>
                            <p className="mt-1 text-sm">{question.answer}</p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Explanation
                            </h4>
                            <p className="mt-1 text-sm text-muted-foreground">{question.explanation}</p>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
