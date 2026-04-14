"use client";

import { useMemo } from "react";
import { BarChart3, Flame, Trophy } from "lucide-react";

import { AdaptiveContext, CompanyPrepProgressNode } from "@/features/company-prep/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProgressPanelProps {
  progress: CompanyPrepProgressNode | null;
  adaptive: AdaptiveContext | null;
}

export function ProgressPanel(props: ProgressPanelProps) {
  const { progress, adaptive } = props;

  const scoreBars = useMemo(() => {
    if (!progress) {
      return [] as Array<{ key: string; value: number }>;
    }

    return progress.scores.slice(-8).map((score, index) => ({
      key: `score-${index}`,
      value: score,
    }));
  }, [progress]);

  if (!progress) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Progress metrics will appear after your first mock or test submission.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Average Score</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-2xl font-semibold">
            {progress.stats.averageScore}%
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tests Completed</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-2xl font-semibold">
            {progress.stats.testsCompleted}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Mocks Completed</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-2xl font-semibold">
            {progress.stats.mockCompleted}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Recommended Level</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-2xl font-semibold capitalize">
            {adaptive?.recommendedDifficulty ?? progress.lastDifficulty ?? "medium"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />
            Score Trend
          </CardTitle>
        </CardHeader>

        <CardContent>
          {scoreBars.length > 0 ? (
            <div className="flex h-32 items-end gap-2">
              {scoreBars.map((bar) => (
                <div key={bar.key} className="flex flex-1 flex-col items-center gap-2">
                  <div className="w-full rounded-t-md bg-primary/20" style={{ height: `${Math.max(bar.value, 8)}%` }}>
                    <div className="h-full w-full rounded-t-md bg-gradient-to-t from-primary to-primary/60" />
                  </div>
                  <span className="text-xs text-muted-foreground">{bar.value}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No scores recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5 text-warning" />
            Weak Areas To Focus
          </CardTitle>
        </CardHeader>

        <CardContent>
          {progress.weakAreas.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {progress.weakAreas.map((area) => (
                <Badge key={area} variant="outline" className="capitalize">
                  {area.replace(/-/g, " ")}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No persistent weak areas detected yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-5">
          <Trophy className="mt-0.5 h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">
            Keep iterating with adaptive practice and full tests. Difficulty auto-adjusts from your recent scores
            and weak-topic profile.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
