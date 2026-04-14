"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIntelligence } from "@/features/intelligence/context/IntelligenceProvider";
import type {
  IntelligenceRecommendationPriority,
  IntelligenceRecommendedAction,
} from "@/features/intelligence/types";
import { cn } from "@/lib/utils";

function priorityBadgeClass(priority: IntelligenceRecommendationPriority): string {
  if (priority === "urgent") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (priority === "medium") return "border-amber-500/40 bg-amber-500/10 text-amber-600";
  return "border-emerald-500/35 bg-emerald-500/10 text-emerald-500";
}

function actionCardClass(priority: IntelligenceRecommendationPriority): string {
  if (priority === "urgent") return "border-destructive/30 bg-destructive/[0.04]";
  if (priority === "medium") return "border-amber-500/30 bg-amber-500/[0.04]";
  return "border-emerald-500/25 bg-emerald-500/[0.04]";
}

function priorityIcon(priority: IntelligenceRecommendationPriority) {
  if (priority === "urgent") return <AlertTriangle className="h-4 w-4 text-destructive" />;
  if (priority === "medium") return <Clock3 className="h-4 w-4 text-amber-500" />;
  return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
}

function ctaLabel(route: string): string {
  if (route.startsWith("/code-playground")) return "Start Coding Practice";
  if (route.startsWith("/interview")) return "Start Mock Interview";
  if (route.startsWith("/company-prep")) return "Open Company Prep";
  if (route.startsWith("/aptitude")) return "Practice Aptitude";
  if (route.startsWith("/revision")) return "Open Revision";
  if (route.startsWith("/company-mode")) return "Set Company Target";
  return "Take Action";
}

const FALLBACK_ACTIONS: IntelligenceRecommendedAction[] = [
  {
    action: "Run a Focused Interview Session",
    reason: "Build a fresh signal baseline so recommendations can become fully personalized.",
    priority: "medium",
    route: "/interview",
  },
  {
    action: "Practice One Coding Topic",
    reason: "A short coding drill helps improve problem-solving consistency.",
    priority: "optional",
    route: "/code-playground",
  },
  {
    action: "Set Company Target",
    reason: "Selecting your company target unlocks more relevant and role-specific guidance.",
    priority: "optional",
    route: "/company-mode",
  },
];

export default function RecommendedActionsPanel() {
  const { recommendations, loading, error } = useIntelligence();

  const topActions = recommendations.slice(0, 3);
  const actions = topActions.length > 0 ? topActions : FALLBACK_ACTIONS;

  return (
    <Card className="border-border/80 bg-card/75 shadow-lg shadow-black/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Recommended Actions
        </CardTitle>
        <CardDescription>
          Actionable next steps based on weak areas, recent performance trends, and company context.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {loading && recommendations.length === 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-44 animate-pulse rounded-2xl border border-border/70 bg-muted/35" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {actions.map((action) => (
              <div
                key={`${action.action}:${action.route}`}
                className={cn("flex h-full flex-col rounded-2xl border p-4", actionCardClass(action.priority))}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Badge variant="outline" className={priorityBadgeClass(action.priority)}>
                    {action.priority}
                  </Badge>
                  {priorityIcon(action.priority)}
                </div>

                <h3 className="text-sm font-semibold leading-snug">{action.action}</h3>
                <p className="mt-2 flex-1 text-xs text-muted-foreground">{action.reason}</p>

                <Button asChild variant="outline" size="sm" className="mt-4 w-full justify-between">
                  <Link href={action.route}>
                    {ctaLabel(action.route)}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}

        {error ? <p className="mt-3 text-xs text-muted-foreground">Using fallback actions. {error}</p> : null}
      </CardContent>
    </Card>
  );
}
