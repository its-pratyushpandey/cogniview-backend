"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlarmClockCheck, CheckCircle2, Hourglass, Send } from "lucide-react";

import { CompanyTestResponse, TestSubmissionResult } from "@/features/company-prep/types";
import { WhyThisQuestionCard } from "@/features/intelligence/components/WhyThisQuestionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface TestPanelProps {
  data: CompanyTestResponse | null;
  loading: boolean;
  submitting: boolean;
  result: TestSubmissionResult | null;
  onSubmit: (answers: Record<string, string | number>) => Promise<TestSubmissionResult | null>;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export default function TestPanel(props: TestPanelProps) {
  const { data, loading, submitting, result, onSubmit } = props;

  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [started, setStarted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  const sections = useMemo(() => data?.test.sections ?? [], [data?.test.sections]);
  const currentSection = sections[activeSectionIndex] ?? null;

  useEffect(() => {
    setActiveSectionIndex(0);
    setAnswers({});
    setStarted(false);
    setAutoSubmitted(false);
    setRemainingSeconds((data?.test.duration ?? 75) * 60);
  }, [data?.test.id, data?.test.duration]);

  useEffect(() => {
    if (!started || remainingSeconds <= 0 || autoSubmitted) {
      return;
    }

    const interval = window.setInterval(() => {
      setRemainingSeconds((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [started, remainingSeconds, autoSubmitted]);

  useEffect(() => {
    if (!started || remainingSeconds > 0 || autoSubmitted) {
      return;
    }

    setAutoSubmitted(true);
    void onSubmit(answers);
  }, [answers, autoSubmitted, onSubmit, remainingSeconds, started]);

  const totalQuestions = useMemo(
    () => sections.reduce((sum, section) => sum + section.questions.length, 0),
    [sections]
  );

  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) => String(value).trim().length > 0).length,
    [answers]
  );

  const completion = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }

    await onSubmit(answers);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Test configuration appears after selecting a company and role.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
            <span className="flex items-center gap-2">
              <AlarmClockCheck className="h-5 w-5 text-primary" />
              Full Test Interface
            </span>
            <Badge variant="muted" className="font-semibold">
              <Hourglass className="mr-1 h-3.5 w-3.5" />
              {formatTime(remainingSeconds)}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-background/60 p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span>Completion</span>
              <span className="font-medium">{completion}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full bg-primary"
                animate={{ width: `${completion}%` }}
                transition={{ duration: 0.25 }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {sections.map((section, index) => {
              const active = index === activeSectionIndex;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSectionIndex(index)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background"
                  }`}
                >
                  {section.title}
                </button>
              );
            })}
          </div>

          {!started ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
              Start the test to begin countdown. Timer auto-submits when it reaches zero.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={started ? "secondary" : "gradient"} onClick={() => setStarted((value) => !value)}>
              {started ? "Pause Timer" : "Start Test"}
            </Button>

            <Button type="button" variant="outline" onClick={() => setAnswers({})} disabled={submitting}>
              Reset Answers
            </Button>
          </div>

          {currentSection ? (
            <div className="space-y-3 rounded-2xl border border-border/70 p-4">
              <h4 className="text-sm font-semibold">
                {currentSection.title} ({currentSection.questions.length} questions)
              </h4>

              <div className="space-y-3">
                {currentSection.questions.map((question, index) => {
                  const key = question.id;

                  return (
                    <div key={key} className="space-y-2 rounded-xl border bg-card/50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          Q{index + 1}. {question.question}
                        </p>
                        <Badge variant="outline" className="capitalize">
                          {question.difficulty}
                        </Badge>
                      </div>

                      {question.mistakePriority ? (
                        <WhyThisQuestionCard
                          metadata={question.mistakePriority}
                          moduleLabel="Company test adaptive"
                          topic={question.tags?.[0] || currentSection.title}
                          difficulty={question.difficulty}
                        />
                      ) : null}

                      <Input
                        value={String(answers[key] ?? "")}
                        onChange={(event) =>
                          setAnswers((previous) => ({
                            ...previous,
                            [key]: event.target.value,
                          }))
                        }
                        placeholder="Type your answer"
                        className="h-10 rounded-xl"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <Button type="button" className="w-full" onClick={handleSubmit} disabled={submitting}>
            <Send className="h-4 w-4" />
            {submitting ? "Submitting Test..." : "Submit Test"}
          </Button>
        </CardContent>
      </Card>

      {result ? (
        <Card className="border-accent/35 bg-accent/10">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-accent">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-semibold">Test submitted successfully</p>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-card/70 p-3">
                <p className="text-muted-foreground">Score</p>
                <p className="text-lg font-semibold">{result.score}%</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/70 p-3">
                <p className="text-muted-foreground">Correct</p>
                <p className="text-lg font-semibold">
                  {result.correctAnswers}/{result.totalQuestions}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/70 p-3">
                <p className="text-muted-foreground">Weak Areas</p>
                <p className="text-lg font-semibold">{result.weakAreas.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
