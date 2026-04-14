"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clock3, Mic, PlayCircle, SkipBack, SkipForward } from "lucide-react";

import { CompanyMockResponse } from "@/features/company-prep/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface MockInterviewPanelProps {
  data: CompanyMockResponse | null;
  loading: boolean;
  launching: boolean;
  onStartVoiceMock: () => Promise<void>;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

export default function MockInterviewPanel(props: MockInterviewPanelProps) {
  const { data, loading, launching, onStartVoiceMock } = props;

  const [currentStep, setCurrentStep] = useState(0);
  const [simulationStarted, setSimulationStarted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const questions = data?.mock.questions ?? [];
  const totalQuestions = Math.max(questions.length, 1);

  useEffect(() => {
    setCurrentStep(0);
    setSimulationStarted(false);
    setRemainingSeconds((data?.mock.durationMinutes ?? 30) * 60);
  }, [data?.mock.durationMinutes, data?.mock.id]);

  useEffect(() => {
    if (!simulationStarted || remainingSeconds <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      setRemainingSeconds((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [simulationStarted, remainingSeconds]);

  const progressPercentage = useMemo(() => {
    if (totalQuestions <= 1) {
      return 100;
    }

    return Math.round((currentStep / (totalQuestions - 1)) * 100);
  }, [currentStep, totalQuestions]);

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-36" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Mock interview data will appear after selecting company and role.
        </CardContent>
      </Card>
    );
  }

  const currentQuestion = questions[currentStep] ?? "Start to load your mock interview flow.";

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-lg">
            <span className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-primary" />
              Step-Based Mock Interview
            </span>
            <Badge variant="muted">{data.mock.durationMinutes} min</Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-background/70 p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span>Question Progress</span>
              <span className="font-medium">
                {Math.min(currentStep + 1, totalQuestions)} / {totalQuestions}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full bg-primary"
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
              <span>Current Interview Prompt</span>
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                {formatTime(remainingSeconds)}
              </span>
            </div>
            <p className="text-sm leading-relaxed">{currentQuestion}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep((value) => Math.max(0, value - 1))}
              disabled={currentStep <= 0}
            >
              <SkipBack className="h-4 w-4" />
              Previous
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep((value) => Math.min(totalQuestions - 1, value + 1))}
              disabled={currentStep >= totalQuestions - 1}
            >
              Next
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant={simulationStarted ? "secondary" : "gradient"}
              onClick={() => setSimulationStarted((started) => !started)}
            >
              <PlayCircle className="h-4 w-4" />
              {simulationStarted ? "Pause Simulation" : "Start Simulation"}
            </Button>
          </div>

          <div className="rounded-xl border bg-card/70 p-4">
            <h4 className="mb-2 text-sm font-semibold">Evaluation Schema</h4>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>Communication: {data.mock.evaluationSchema.communicationWeight}%</div>
              <div>Technical: {data.mock.evaluationSchema.technicalWeight}%</div>
              <div>Problem Solving: {data.mock.evaluationSchema.problemSolvingWeight}%</div>
              <div>Confidence: {data.mock.evaluationSchema.confidenceWeight}%</div>
            </div>
          </div>

          <Button type="button" className="w-full" onClick={onStartVoiceMock} disabled={launching}>
            <Mic className="h-4 w-4" />
            {launching ? "Launching Company Mock..." : "Start Voice Mock Interview"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
