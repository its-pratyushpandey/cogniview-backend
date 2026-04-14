/**
 * API Client with automatic retry logic
 * Handles rate limiting and network errors gracefully
 */

interface ApiCallOptions {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  cache?: RequestCache;
  credentials?: RequestCredentials;
  onRetry?: (attemptNumber: number, error: unknown) => void;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  retryable?: boolean;
  statusCode?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff with jitter
 */
function getRetryDelay(attemptNumber: number, baseDelay: number): number {
  const delay = Math.min(baseDelay * Math.pow(2, attemptNumber), 10000);
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.floor(delay + jitter);
}

const ENABLE_API_TIMING_LOGS =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_API_TIMING_LOGS === "1";

function logSlowApiCall(method: string, url: string, startedAt: number, status?: number) {
  if (!ENABLE_API_TIMING_LOGS) {
    return;
  }

  const durationMs = Date.now() - startedAt;
  if (durationMs <= 300) {
    return;
  }

  console.warn(
    `[api] slow call detected (${durationMs}ms) ${method} ${url}${status ? ` [${status}]` : ""}`
  );
}

/**
 * Make an API call with automatic retry on rate limit or network errors
 */
export async function apiCall<T = unknown>(
  options: ApiCallOptions
): Promise<ApiResponse<T>> {
  const {
    url,
    method = "GET",
    body,
    maxRetries = 3,
    retryDelay = 1000,
    timeout = 30000,
    cache,
    credentials = "same-origin",
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const startedAt = Date.now();
      const requestCache = cache ?? (method === "GET" ? "default" : "no-store");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: requestCache,
        credentials,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      let data: unknown;
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Success
      if (response.ok) {
        logSlowApiCall(method, url, startedAt, response.status);
        return {
          success: true,
          data: data as T,
          statusCode: response.status,
        };
      }

      // Rate limited or transient server error - retry
      const isRetryableStatus = response.status === 429 || response.status === 503 || (response.status >= 500 && response.status <= 504);
      if (isRetryableStatus && attempt < maxRetries) {
        logSlowApiCall(method, url, startedAt, response.status);
        const delay = getRetryDelay(attempt, retryDelay);

        const message =
          (isRecord(data) && typeof data.error === "string" && data.error) ||
          "Rate limited";
        
        if (onRetry) {
          onRetry(attempt + 1, {
            status: response.status,
            message,
          });
        }

        if (ENABLE_API_TIMING_LOGS) {
          console.warn(
            `API rate limited (${response.status}). Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
          );
        }

        await sleep(delay);
        continue;
      }

      // Other errors
      logSlowApiCall(method, url, startedAt, response.status);
      return {
        success: false,
        error:
          (isRecord(data) && typeof data.error === "string" && data.error) ||
          (isRecord(data) && typeof data.details === "string" && data.details) ||
          `HTTP ${response.status}`,
        retryable: isRecord(data) && data.retryable === true,
        statusCode: response.status,
      };
    } catch (error: unknown) {
      lastError = error;

      // Network error or timeout - retry
      if (
        attempt < maxRetries &&
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.name === "TypeError" ||
          error.message.includes("fetch"))
      ) {
        const delay = getRetryDelay(attempt, retryDelay);
        
        if (onRetry) {
          onRetry(attempt + 1, error);
        }

        if (ENABLE_API_TIMING_LOGS) {
          console.warn(
            `Network error: ${error.message}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
          );
        }

        await sleep(delay);
        continue;
      }

      // Non-retryable error
      break;
    }
  }

  // All retries exhausted
  return {
    success: false,
    error:
      (lastError instanceof Error
        ? lastError.message
        : isRecord(lastError) && typeof lastError.message === "string"
          ? lastError.message
          : undefined) ||
      "Request failed after multiple retries. Please try again later.",
    retryable: true,
  };
}

/**
 * Convenience wrapper for common API calls
 */
export const api = {
  get: <T = unknown>(url: string, options?: Partial<ApiCallOptions>) =>
    apiCall<T>({ url, method: "GET", ...options }),

  post: <T = unknown>(
    url: string,
    body?: unknown,
    options?: Partial<ApiCallOptions>
  ) => apiCall<T>({ url, method: "POST", body, ...options }),

  put: <T = unknown>(
    url: string,
    body?: unknown,
    options?: Partial<ApiCallOptions>
  ) => apiCall<T>({ url, method: "PUT", body, ...options }),

  delete: <T = unknown>(url: string, options?: Partial<ApiCallOptions>) =>
    apiCall<T>({ url, method: "DELETE", ...options }),
};

/**
 * Hook for React components to show retry status
 */
export function useApiWithRetry() {
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);

  const callApi = async <T = unknown>(
    options: ApiCallOptions
  ): Promise<ApiResponse<T>> => {
    setIsRetrying(false);
    setRetryCount(0);

    const result = await apiCall<T>({
      ...options,
      onRetry: (attempt, error) => {
        setIsRetrying(true);
        setRetryCount(attempt);
        options.onRetry?.(attempt, error);
      },
    });

    setIsRetrying(false);
    return result;
  };

  return {
    callApi,
    isRetrying,
    retryCount,
  };
}

// For React import
import React from "react";
