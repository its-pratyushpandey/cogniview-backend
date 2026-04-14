"use client";

import * as React from "react";

type PerformanceProfilerProps = {
  id: string;
  children: React.ReactNode;
  thresholdMs?: number;
};

export default function PerformanceProfiler({
  id,
  children,
  thresholdMs = 16,
}: PerformanceProfilerProps) {
  const enablePerfLogs =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ENABLE_PERF_LOGS === "1";

  const onRender: React.ProfilerOnRenderCallback = (
    profileId,
    phase,
    actualDuration,
    baseDuration
  ) => {
    if (actualDuration > thresholdMs) {
      console.warn(
        `[perf] slow render detected id=${profileId} phase=${phase} actual=${actualDuration.toFixed(1)}ms base=${baseDuration.toFixed(1)}ms`
      );
    }
  };

  if (!enablePerfLogs) {
    return <>{children}</>;
  }

  return (
    <React.Profiler id={id} onRender={onRender}>
      {children}
    </React.Profiler>
  );
}
