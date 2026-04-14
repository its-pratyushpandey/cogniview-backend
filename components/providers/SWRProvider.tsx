"use client";

import * as React from "react";
import { SWRConfig } from "swr";

import { api } from "@/lib/api-client";

async function swrFetcher<T>(url: string): Promise<T> {
  const result = await api.get<T>(url, {
    cache: "default",
    maxRetries: 1,
    retryDelay: 600,
    timeout: 15000,
  });

  if (!result.success) {
    throw new Error(result.error || `Request failed for ${url}`);
  }

  return result.data as T;
}

export default function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        refreshWhenHidden: false,
        keepPreviousData: true,
        dedupingInterval: 15000,
        errorRetryCount: 1,
      }}
    >
      {children}
    </SWRConfig>
  );
}
