"use client";

import { useCallback, useMemo } from "react";

import type { IntelligenceDifficultyPreference } from "@/features/intelligence/types";
import { useIntelligence } from "@/features/intelligence/context/IntelligenceProvider";

interface SyncCompanyContextInput {
  companyId?: string | null;
  roleId?: string | null;
  companyType?: string | null;
  targetRole?: string | null;
  targetCompanies?: string[];
}

interface TrackCompanyInteractionInput {
  topicName?: string;
  score?: number;
  responseTimeMs?: number;
  retries?: number;
  confidence?: number;
  difficultyPreference?: IntelligenceDifficultyPreference;
}

export function useCompanyContext() {
  const { snapshot, emitEvent } = useIntelligence();

  const syncCompanyContext = useCallback(
    async (input: SyncCompanyContextInput) => {
      await emitEvent(
        "context.selection.updated",
        {
          companyId: input.companyId ?? null,
          roleId: input.roleId ?? null,
          companyType: input.companyType ?? null,
          targetRole: input.targetRole ?? null,
          targetCompanies: input.targetCompanies ?? [],
        },
        "hooks/useCompanyContext"
      );
    },
    [emitEvent]
  );

  const setCompanyPreference = useCallback(
    async (input: { companyType?: string | null; targetCompanies?: string[]; difficultyPreference?: IntelligenceDifficultyPreference }) => {
      await emitEvent(
        "company.preference.updated",
        {
          companyType: input.companyType ?? null,
          targetCompanies: input.targetCompanies ?? [],
          difficultyPreference: input.difficultyPreference,
        },
        "hooks/useCompanyContext"
      );
    },
    [emitEvent]
  );

  const trackCompanyInteraction = useCallback(
    async (input: TrackCompanyInteractionInput) => {
      await emitEvent(
        "learning.behavior.tracked",
        {
          module: "company-prep",
          topicName: input.topicName,
          score: input.score,
          responseTimeMs: input.responseTimeMs,
          retries: input.retries,
          confidence: input.confidence,
          difficultyPreference: input.difficultyPreference,
        },
        "hooks/useCompanyContext"
      );
    },
    [emitEvent]
  );

  const companyAwareWeakAreas = useMemo(() => {
    if (!snapshot) return [];

    const roleHint = snapshot.context.targetRole?.toLowerCase() ?? "";
    const prioritized = snapshot.weakAreas.filter((area) => area.toLowerCase().includes(roleHint));

    if (prioritized.length > 0) {
      return prioritized.slice(0, 6);
    }

    return snapshot.weakAreas.slice(0, 6);
  }, [snapshot]);

  return {
    context: snapshot?.context ?? null,
    recommendedDifficulty: snapshot?.difficultyPreference ?? "adaptive",
    companyAwareWeakAreas,
    syncCompanyContext,
    setCompanyPreference,
    trackCompanyInteraction,
  };
}
