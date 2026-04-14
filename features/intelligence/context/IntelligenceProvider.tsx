"use client";

import * as React from "react";
import useSWR from "swr";

import type {
  IntelligenceEventType,
  IntelligenceRecommendedAction,
  UserIntelligenceSnapshot,
} from "@/features/intelligence/types";
import { api } from "@/lib/api-client";

const LOW_PRIORITY_EVENT_TYPES = new Set<IntelligenceEventType>([
  "interview.realtime.signal",
  "learning.behavior.tracked",
]);

const LOW_PRIORITY_EVENT_MIN_INTERVAL_MS = 30_000;
const LOW_PRIORITY_EVENT_MIN_GAP_MS = 8_000;

type SnapshotApiResponse =
  | {
      success: true;
      snapshot: UserIntelligenceSnapshot;
      recommendedActions?: IntelligenceRecommendedAction[];
    }
  | { success: false; error?: string };

interface IntelligenceContextValue {
  snapshot: UserIntelligenceSnapshot | null;
  recommendations: IntelligenceRecommendedAction[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  emitEvent: (eventType: IntelligenceEventType, payload: Record<string, unknown>, source?: string) => Promise<void>;
  updateContext: (payload: {
    companyId?: string | null;
    roleId?: string | null;
    companyType?: string | null;
    targetRole?: string | null;
    targetCompanies?: string[];
  }) => Promise<void>;
}

const IntelligenceContext = React.createContext<IntelligenceContextValue | null>(null);

export function IntelligenceProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const [eventError, setEventError] = React.useState<string | null>(null);
  const lowPriorityEventStateRef = React.useRef(
    new Map<IntelligenceEventType, { signature: string; sentAt: number }>()
  );
  const snapshotKey = userId
    ? (["/api/intelligence/snapshot", userId] as const)
    : null;

  const {
    data,
    error: swrError,
    isLoading,
    mutate,
  } = useSWR<SnapshotApiResponse>(
    snapshotKey,
    async ([endpoint, resolvedUserId]: readonly [string, string]) => {
      const result = await api.get<SnapshotApiResponse>(
        `${endpoint}?userId=${encodeURIComponent(resolvedUserId)}`,
        {
        cache: "default",
        maxRetries: 2,
        retryDelay: 800,
        timeout: 20000,
        }
      );

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to load intelligence snapshot");
      }

      return result.data;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      keepPreviousData: true,
    }
  );

  const snapshot = React.useMemo<UserIntelligenceSnapshot | null>(() => {
    if (!data || data.success !== true) {
      return null;
    }

    return data.snapshot;
  }, [data]);

  const recommendations = React.useMemo<IntelligenceRecommendedAction[]>(() => {
    if (!data || data.success !== true || !Array.isArray(data.recommendedActions)) {
      return [];
    }

    return data.recommendedActions;
  }, [data]);

  const refresh = React.useCallback(async () => {
    setEventError(null);
    await mutate();
  }, [mutate]);

  const error = React.useMemo(() => {
    if (eventError) {
      return eventError;
    }

    if (swrError instanceof Error) {
      return swrError.message;
    }

    if (data && data.success === false) {
      return data.error || "Failed to load intelligence snapshot";
    }

    return null;
  }, [data, eventError, swrError]);

  const loading = isLoading && !snapshot;

  const emitEvent = React.useCallback(
    async (eventType: IntelligenceEventType, payload: Record<string, unknown>, source = "client") => {
      if (!userId) return;

      if (LOW_PRIORITY_EVENT_TYPES.has(eventType)) {
        const now = Date.now();
        const signature = JSON.stringify(payload);
        const previous = lowPriorityEventStateRef.current.get(eventType);

        if (previous) {
          const elapsed = now - previous.sentAt;
          if (elapsed < LOW_PRIORITY_EVENT_MIN_GAP_MS) {
            return;
          }

          if (elapsed < LOW_PRIORITY_EVENT_MIN_INTERVAL_MS && previous.signature === signature) {
            return;
          }
        }

        lowPriorityEventStateRef.current.set(eventType, { signature, sentAt: now });

        void api.post<{ success: boolean }>(
          "/api/intelligence/events?mode=ack",
          {
            userId,
            eventType,
            payload,
            source,
          },
          {
            maxRetries: 0,
            timeout: 9000,
          }
        );

        return;
      }

      try {
        const result = await api.post<SnapshotApiResponse>(
          "/api/intelligence/events",
          {
            userId,
            eventType,
            payload,
            source,
          },
          {
            maxRetries: 1,
            retryDelay: 700,
            timeout: 20000,
          }
        );

        const data = result.data;

        if (!result.success || !data || data.success !== true) {
          throw new Error((data && "error" in data && data.error) || result.error || "Failed to emit intelligence event");
        }

        setEventError(null);
        await mutate(data, { revalidate: false });
      } catch (eventError) {
        setEventError(eventError instanceof Error ? eventError.message : "Failed to emit intelligence event");
      }
    },
    [mutate, userId]
  );

  const updateContext = React.useCallback(
    async (payload: {
      companyId?: string | null;
      roleId?: string | null;
      companyType?: string | null;
      targetRole?: string | null;
      targetCompanies?: string[];
    }) => {
      await emitEvent("context.selection.updated", payload, "client/context");
    },
    [emitEvent]
  );

  const value = React.useMemo<IntelligenceContextValue>(
    () => ({
      snapshot,
      recommendations,
      loading,
      error,
      refresh,
      emitEvent,
      updateContext,
    }),
    [snapshot, recommendations, loading, error, refresh, emitEvent, updateContext]
  );

  return <IntelligenceContext.Provider value={value}>{children}</IntelligenceContext.Provider>;
}

export function useIntelligence() {
  const context = React.useContext(IntelligenceContext);
  if (!context) {
    throw new Error("useIntelligence must be used within an IntelligenceProvider");
  }

  return context;
}
