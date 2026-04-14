"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  RefreshCcw,
  Target,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface InterviewSuggestionItem {
  questionAsked: string;
  userAnswer: string;
  issues: string[];
  modelAnswer: string;
  rephrasingSuggestion: string;
  additionalConcepts: string[];
  improvementScore: number;
}

interface SuggestionsData {
  suggestions: InterviewSuggestionItem[];
  overallFeedback: string;
  keyAreas: string[];
}

interface InterviewSuggestionsProps {
  transcript: Array<{ role: string; content: string }>;
  interviewId: string;
  feedback: Feedback | null;
  weakAreas: string[];
  suggestedTopics: string[];
}

function scoreTone(score: number): string {
  if (score >= 8) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
  if (score >= 6) return "border-primary/40 bg-primary/10 text-primary";
  if (score >= 4) return "border-amber-500/40 bg-amber-500/10 text-amber-400";

  return "border-destructive/40 bg-destructive/10 text-destructive";
}

export default function InterviewSuggestions(props: InterviewSuggestionsProps) {
  const { transcript, interviewId, feedback, weakAreas, suggestedTopics } = props;

  const [suggestions, setSuggestions] = useState<SuggestionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const canGenerate = transcript.length >= 2;
  const transcriptHash = useMemo(
    () => transcript.map((entry) => `${entry.role}:${entry.content}`).join("||"),
    [transcript]
  );

  const sessionScore = feedback?.sessionSummary?.overallScore ?? feedback?.totalScore ?? null;
  const generatedAt = feedback?.createdAt
    ? new Date(feedback.createdAt).toLocaleString()
    : "Not available";

  const practiceActions = useMemo(() => {
    const firstWeakArea = weakAreas[0];
    const secondWeakArea = weakAreas[1] || firstWeakArea;

    return [
      {
        title: "Targeted Tutor Session",
        description: firstWeakArea
          ? `Rebuild fundamentals around ${firstWeakArea} in AI Tutor.`
          : "Use AI Tutor to strengthen core interview fundamentals.",
        href: firstWeakArea
          ? `/tutor?topic=${encodeURIComponent(firstWeakArea)}`
          : "/tutor",
      },
      {
        title: "MCQ Reinforcement",
        description: secondWeakArea
          ? `Practice objective questions focused on ${secondWeakArea}.`
          : "Reinforce conceptual accuracy using timed MCQ practice.",
        href: "/mcq",
      },
      {
        title: "Mock Interview Retry",
        description: "Run another interview loop and validate improvements.",
        href: `/interview/${interviewId}`,
      },
      {
        title: "Re-evaluate Answers",
        description: "Run answer-level AI scoring with detailed breakdown.",
        href: `/answer-scoring?interviewId=${encodeURIComponent(interviewId)}`,
      },
    ];
  }, [interviewId, weakAreas]);

  const generateSuggestions = useCallback(async () => {
    if (!canGenerate) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/interview/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      const payload = (await response.json()) as SuggestionsData | { error?: string };
      if (!response.ok) {
        const message =
          "error" in payload && payload.error
            ? payload.error
            : "Failed to generate suggestions";
        throw new Error(message);
      }

      setSuggestions(payload as SuggestionsData);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Failed to generate suggestions. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [canGenerate, transcript]);

  useEffect(() => {
    setSuggestions(null);
    setError(null);
    setExpandedIndex(null);

    if (!canGenerate) return;
    void generateSuggestions();
  }, [canGenerate, generateSuggestions, transcriptHash]);

  if (!canGenerate) {
    return (
      <Card className="rounded-2xl border-border/80 bg-card/75 shadow-lg shadow-black/20">
        <CardHeader>
          <CardTitle>No Transcript Available</CardTitle>
          <CardDescription>
            Complete an interview to get suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/interview">Start Interview</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 md:grid-cols-3"
      >
        <Card className="rounded-2xl border-border/80 bg-card/75 shadow-lg shadow-black/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              Key Weak Areas
            </CardTitle>
            <CardDescription>Topics needing the most attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {weakAreas.length > 0 ? (
              weakAreas.slice(0, 6).map((area) => (
                <Badge key={area} variant="outline" className="mb-2 mr-2 rounded-xl">
                  {area}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Weak areas will appear after your interview feedback is generated.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card/75 shadow-lg shadow-black/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              Suggested Topics
            </CardTitle>
            <CardDescription>Recommended follow-up concepts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestedTopics.length > 0 ? (
              suggestedTopics.map((topic) => (
                <div
                  key={topic}
                  className="rounded-xl border border-border/80 bg-secondary/50 px-3 py-2 text-sm"
                >
                  {topic}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Suggested topics will be generated from your weak areas.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card/75 shadow-lg shadow-black/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4" />
              Recommended Practice Actions
            </CardTitle>
            <CardDescription>Next best actions for improvement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {practiceActions.map((action) => (
              <div
                key={action.title}
                className="rounded-xl border border-border/80 bg-secondary/50 p-3"
              >
                <p className="text-sm font-semibold">{action.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                <Button asChild variant="outline" size="sm" className="mt-3 rounded-xl">
                  <Link href={action.href} className="inline-flex items-center gap-2">
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-2xl border-border/80 bg-card/75 shadow-lg shadow-black/20">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Detailed Suggestions</CardTitle>
              <CardDescription>
                AI-generated answer improvements from your latest interview session.
              </CardDescription>
              <p className="mt-2 text-xs text-muted-foreground">
                Session score: {sessionScore ?? "N/A"} • Feedback updated: {generatedAt}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => void generateSuggestions()}
              disabled={loading}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <Card className="rounded-2xl border-border/80 bg-secondary/45">
                  <CardHeader>
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-64" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[90%]" />
                    <Skeleton className="h-4 w-[70%]" />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/80 bg-secondary/45">
                  <CardHeader>
                    <Skeleton className="h-5 w-56" />
                    <Skeleton className="h-4 w-72" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[88%]" />
                    <Skeleton className="h-4 w-[75%]" />
                  </CardContent>
                </Card>
              </div>
            ) : error ? (
              <Card className="rounded-2xl border-destructive/40 bg-destructive/10">
                <CardContent className="p-4">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    className="mt-3 rounded-xl"
                    variant="outline"
                    onClick={() => void generateSuggestions()}
                  >
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : suggestions ? (
              <div className="space-y-4">
                <Card className="rounded-2xl border-border/80 bg-secondary/45">
                  <CardHeader>
                    <CardTitle className="text-base">Overall Assessment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm leading-relaxed">{suggestions.overallFeedback}</p>
                    {suggestions.keyAreas.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {suggestions.keyAreas.map((area) => (
                          <Badge key={area} variant="outline" className="rounded-xl">
                            {area}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {suggestions.suggestions.map((item, index) => (
                  <motion.div
                    key={`${item.questionAsked}-${index}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="rounded-2xl border-border/80 bg-secondary/45">
                      <CardHeader className="space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <CardTitle className="text-base">Question {index + 1}</CardTitle>
                          <Badge className={scoreTone(item.improvementScore)}>
                            {item.improvementScore.toFixed(1)} / 10
                          </Badge>
                        </div>
                        <CardDescription className="text-sm">
                          {item.questionAsked}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Your Answer
                          </p>
                          <p className="mt-1 text-sm leading-relaxed">{item.userAnswer}</p>
                        </div>

                        {item.issues.length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Issues Identified
                            </p>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                              {item.issues.map((issue) => (
                                <li key={issue}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-xl"
                          onClick={() =>
                            setExpandedIndex((current) =>
                              current === index ? null : index
                            )
                          }
                        >
                          {expandedIndex === index
                            ? "Hide Details"
                            : "Show Improvements"}
                        </Button>

                        <AnimatePresence initial={false}>
                          {expandedIndex === index ? (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-3 overflow-hidden"
                            >
                              <div className="rounded-xl border border-border/80 bg-card/60 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Model Answer
                                </p>
                                <p className="mt-1 text-sm leading-relaxed">{item.modelAnswer}</p>
                              </div>

                              <div className="rounded-xl border border-border/80 bg-card/60 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Rephrasing Suggestion
                                </p>
                                <p className="mt-1 text-sm leading-relaxed">
                                  {item.rephrasingSuggestion}
                                </p>
                              </div>

                              {item.additionalConcepts.length > 0 ? (
                                <div className="rounded-xl border border-border/80 bg-card/60 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Additional Concepts
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {item.additionalConcepts.map((concept) => (
                                      <Badge
                                        key={concept}
                                        variant="outline"
                                        className="rounded-xl"
                                      >
                                        {concept}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border/80 bg-secondary/40 p-4 text-sm text-muted-foreground">
                Suggestions will appear here once analysis is complete.
              </div>
            )}
          </CardContent>
        </Card>
      </motion.section>
    </div>
  );
}
