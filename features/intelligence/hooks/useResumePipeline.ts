"use client";

import { useCallback, useMemo } from "react";

import type { IntelligenceDifficultyPreference } from "@/features/intelligence/types";
import { useIntelligence } from "@/features/intelligence/context/IntelligenceProvider";

interface ResumeAnalysisSyncInput {
  selectedRole?: string;
  recommendedRoles?: string[];
  missingSkills?: string[];
  weakAreas?: string[];
  experienceLevel?: string;
}

interface ResumeQuestionPlanInput {
  selectedRole?: string;
  mode: "weak-areas" | "all-skills" | "custom";
  count: number;
  focusAreas: string[];
  difficultyPreference?: IntelligenceDifficultyPreference;
}

export function useResumePipeline() {
  const { snapshot, emitEvent } = useIntelligence();

  const syncResumeAnalysis = useCallback(
    async (input: ResumeAnalysisSyncInput) => {
      await emitEvent(
        "context.selection.updated",
        {
          targetRole: input.selectedRole ?? null,
          recommendedRoles: input.recommendedRoles ?? [],
        },
        "hooks/useResumePipeline"
      );

      const scoreFromExperience =
        input.experienceLevel?.toLowerCase() === "advanced"
          ? 82
          : input.experienceLevel?.toLowerCase() === "intermediate"
            ? 66
            : 48;

      await emitEvent(
        "learning.behavior.tracked",
        {
          module: "resume-pipeline",
          topicName: input.selectedRole,
          score: scoreFromExperience,
          confidence: scoreFromExperience,
        },
        "hooks/useResumePipeline"
      );
    },
    [emitEvent]
  );

  const recordQuestionPlan = useCallback(
    async (input: ResumeQuestionPlanInput) => {
      await emitEvent(
        "resume.questions.generated",
        {
          selectedRole: input.selectedRole,
          mode: input.mode,
          count: input.count,
          focusAreas: input.focusAreas,
          difficultyPreference: input.difficultyPreference,
        },
        "hooks/useResumePipeline"
      );
    },
    [emitEvent]
  );

  const pipeline = useMemo(() => {
    const recentTypes = new Set(snapshot?.recentEvents.map((event) => event.type) ?? []);

    const hasResumeAnalysis = recentTypes.has("resume.analysis.completed");
    const hasQuestionPlan = recentTypes.has("resume.questions.generated");
    const hasRoleSelection = Boolean(snapshot?.context.targetRole);

    return {
      hasResumeAnalysis,
      hasRoleSelection,
      hasQuestionPlan,
      readyForCompanyPrep: hasRoleSelection && hasQuestionPlan,
      weakAreas: snapshot?.weakAreas.slice(0, 6) ?? [],
      recommendedRoles: snapshot?.context.recommendedRoles.slice(0, 5) ?? [],
      targetRole: snapshot?.context.targetRole ?? null,
      nextActionPath:
        hasRoleSelection && hasQuestionPlan
          ? "/company-prep"
          : hasResumeAnalysis
            ? "/resume-analysis"
            : "/resume-analysis",
    };
  }, [snapshot]);

  return {
    pipeline,
    syncResumeAnalysis,
    recordQuestionPlan,
  };
}
