/**
 * LLM API Utilities
 *
 * Originally implemented for Gemini; now backed by Groq's OpenAI-compatible API.
 * Keeps the existing exported function names to avoid widespread refactors.
 */

import { createHash } from "crypto";

interface GeminiRequestConfig {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  model?: string;
}

interface GeminiResponse {
  text: string;
  success: boolean;
  error?: string;
  retries?: number;
}

export type GeminiStreamEvent =
  | { type: "delta"; text: string }
  | {
      type: "done";
      model: string;
      elapsedMs: number;
      ttfbMs: number | null;
      cached?: boolean;
      isFallback?: boolean;
    }
  | { type: "error"; error: string };

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

function getGroqApiKey(): string | undefined {
  // Backward-compatible fallback: if the user still has GEMINI_API_KEY set, treat it as the Groq key.
  const key = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
  return key ? key.trim() : undefined;
}

function mapToGroqModel(model?: string): string {
  const requested = (model || "").trim();
  if (!requested) return "llama-3.3-70b-versatile";

  // If user already passed a Groq model ID, use it as-is.
  if (
    requested.includes("llama") ||
    requested.includes("mixtral") ||
    requested.includes("gemma")
  ) {
    return requested;
  }

  const lowered = requested.toLowerCase();
  // Heuristic mapping from previous Gemini naming.
  if (lowered.includes("pro")) return "llama-3.3-70b-versatile";
  if (lowered.includes("flash")) return "llama-3.1-8b-instant";

  return "llama-3.3-70b-versatile";
}

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequestsPerMinute: 15,
  maxConcurrent: 3,
};

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 32000,
  backoffMultiplier: 2,
};

// Request queue management
class RequestQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = 0;
  private requestTimestamps: number[] = [];

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing >= RATE_LIMIT.maxConcurrent) {
      return;
    }

    // Clean old timestamps (older than 1 minute)
    const oneMinuteAgo = Date.now() - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => ts > oneMinuteAgo
    );

    // Check if we're within rate limit
    if (this.requestTimestamps.length >= RATE_LIMIT.maxRequestsPerMinute) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = 60000 - (Date.now() - oldestTimestamp);
      if (waitTime > 0) {
        setTimeout(() => this.processQueue(), waitTime);
        return;
      }
    }

    const task = this.queue.shift();
    if (!task) return;

    this.processing++;
    this.requestTimestamps.push(Date.now());

    try {
      await task();
    } finally {
      this.processing--;
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }
}

const requestQueue = new RequestQueue();

const LLM_CACHE = {
  maxEntries: 200,
  ttlMs: 5 * 60 * 1000,
};

const responseCache = new Map<string, { value: GeminiResponse; expiresAt: number }>();
const inflightRequests = new Map<string, Promise<GeminiResponse>>();

function makeCacheKey(input: {
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  topP: number;
  model: string;
}): string {
  const hash = createHash("sha256");
  hash.update(input.model);
  hash.update("\n");
  hash.update(String(input.temperature));
  hash.update("\n");
  hash.update(String(input.maxOutputTokens));
  hash.update("\n");
  hash.update(String(input.topP));
  hash.update("\n");
  hash.update(input.prompt);
  return hash.digest("hex");
}

function getCachedResponse(key: string): GeminiResponse | null {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedResponse(key: string, value: GeminiResponse): void {
  if (!value.success || !value.text) return;

  if (responseCache.size >= LLM_CACHE.maxEntries) {
    const firstKey = responseCache.keys().next().value as string | undefined;
    if (firstKey) responseCache.delete(firstKey);
  }

  responseCache.set(key, { value, expiresAt: Date.now() + LLM_CACHE.ttlMs });
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function getBackoffDelay(attemptNumber: number): number {
  const delay = Math.min(
    RETRY_CONFIG.initialDelayMs *
      Math.pow(RETRY_CONFIG.backoffMultiplier, attemptNumber),
    RETRY_CONFIG.maxDelayMs
  );
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.floor(delay + jitter);
}

/**
 * Make a request to Groq API with retry logic
 */
async function makeGroqRequest(
  body: Record<string, unknown>,
  retryCount = 0
): Promise<Response> {
  try {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      throw new Error("GROQ_API_KEY not configured");
    }

    const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    // Handle rate limiting (429) and server errors (5xx) with retry
    if (response.status === 429 || response.status >= 500) {
      if (retryCount < RETRY_CONFIG.maxRetries) {
        const delay = getBackoffDelay(retryCount);
        console.warn(
          `Groq API ${response.status}: Retrying in ${delay}ms (attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries})`
        );
        await sleep(delay);
        return makeGroqRequest(body, retryCount + 1);
      }
    }

    return response;
  } catch (error: unknown) {
    // Handle network errors and timeouts
    if (
      retryCount < RETRY_CONFIG.maxRetries &&
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.name === "TypeError" ||
        error.message.includes("fetch"))
    ) {
      const delay = getBackoffDelay(retryCount);
      console.warn(
        `Network error: Retrying in ${delay}ms (attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries})`
      );
      await sleep(delay);
      return makeGroqRequest(body, retryCount + 1);
    }
    throw error;
  }
}

async function makeGroqStreamingRequest(
  body: Record<string, unknown>,
  signal: AbortSignal,
  retryCount = 0
): Promise<Response> {
  try {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      throw new Error("GROQ_API_KEY not configured");
    }

    const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (response.status === 429 || response.status >= 500) {
      if (retryCount < RETRY_CONFIG.maxRetries) {
        const delay = getBackoffDelay(retryCount);
        console.warn(
          `Groq API ${response.status}: Retrying in ${delay}ms (attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries})`
        );
        await sleep(delay);
        return makeGroqStreamingRequest(body, signal, retryCount + 1);
      }
    }

    return response;
  } catch (error: unknown) {
    if (
      retryCount < RETRY_CONFIG.maxRetries &&
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.name === "TypeError" ||
        error.message.includes("fetch"))
    ) {
      const delay = getBackoffDelay(retryCount);
      console.warn(
        `Network error: Retrying in ${delay}ms (attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries})`
      );
      await sleep(delay);
      return makeGroqStreamingRequest(body, signal, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Call Gemini API with rate limiting, queuing, and retry logic
 */
export async function callGeminiAPI(
  config: GeminiRequestConfig
): Promise<GeminiResponse> {
  const {
    prompt,
    temperature = 0.7,
    maxOutputTokens = 2048,
    topP = 0.95,
    model = "gemini-2.0-flash-exp",
  } = config;

  if (!getGroqApiKey()) {
    return {
      success: false,
      text: "",
      error: "GROQ_API_KEY not configured",
    };
  }

  const resolvedModel = mapToGroqModel(model);
  const normalized = {
    prompt,
    temperature: Math.min(Math.max(temperature, 0), 2),
    maxOutputTokens: Math.max(1, Math.min(maxOutputTokens, 8192)),
    topP: Math.min(Math.max(topP, 0), 1),
    model: resolvedModel,
  };

  const cacheKey = makeCacheKey(normalized);
  const cached = getCachedResponse(cacheKey);
  if (cached) {
    return cached;
  }

  const inflight = inflightRequests.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  // Add to queue to manage rate limiting
  const promise = requestQueue.add(async () => {
    const retries = 0;

    try {
      const requestBody: Record<string, unknown> = {
        model: resolvedModel,
        messages: [{ role: "user", content: prompt }],
        temperature: normalized.temperature,
        max_tokens: normalized.maxOutputTokens,
        top_p: normalized.topP,
        // Groq/OpenAI chat completions don't support topK.
      };

      const response = await makeGroqRequest(requestBody);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Groq API error (${response.status}):`,
          errorText
        );

        // Parse error for better user feedback
        let errorMessage = response.statusText;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage =
            errorData.error?.message || errorMessage;
        } catch {}

        return {
          success: false,
          text: "",
          error: `Groq API error: ${errorMessage}`,
        };
      }

      const data = await response.json();
      const text =
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        "";

      if (!text) {
        return {
          success: false,
          text: "",
          error: "Empty response from Groq API",
        };
      }

      const result: GeminiResponse = {
        success: true,
        text,
        retries,
      };

      setCachedResponse(cacheKey, result);
      return result;
    } catch (error: unknown) {
      console.error("Groq API call failed:", error);
      return {
        success: false,
        text: "",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  });

  inflightRequests.set(cacheKey, promise);
  promise.finally(() => {
    inflightRequests.delete(cacheKey);
  });
  return promise;
}

export function createGeminiNDJSONStream(config: GeminiRequestConfig & {
  models?: string[];
  signal?: AbortSignal;
}): ReadableStream<Uint8Array> {
  const {
    prompt,
    temperature = 0.7,
    maxOutputTokens = 2048,
    topP = 0.95,
    model = "gemini-2.0-flash-exp",
    models,
    signal,
  } = config;

  const startedAt = Date.now();
  const encoder = new TextEncoder();

  const abortController = new AbortController();
  if (signal) {
    if (signal.aborted) {
      abortController.abort(signal.reason);
    } else {
      signal.addEventListener(
        "abort",
        () => abortController.abort(signal.reason),
        { once: true }
      );
    }
  }

  const candidateModels = (models && models.length > 0 ? models : [model]).map(
    (m) => mapToGroqModel(m)
  );

  const normalized = {
    prompt,
    temperature: Math.min(Math.max(temperature, 0), 2),
    maxOutputTokens: Math.max(1, Math.min(maxOutputTokens, 8192)),
    topP: Math.min(Math.max(topP, 0), 1),
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const writeEvent = (evt: GeminiStreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(evt) + "\n"));
      };

      // Fast path: cache hit for any candidate model
      for (const m of candidateModels) {
        const key = makeCacheKey({ ...normalized, model: m });
        const cached = getCachedResponse(key);
        if (cached?.success && cached.text) {
          writeEvent({ type: "delta", text: cached.text });
          writeEvent({
            type: "done",
            model: m,
            elapsedMs: Date.now() - startedAt,
            ttfbMs: 0,
            cached: true,
          });
          controller.close();
          return;
        }
      }

      const run = async () => {
        try {
          if (!getGroqApiKey()) {
            writeEvent({ type: "error", error: "GROQ_API_KEY not configured" });
            controller.close();
            return;
          }

          if (abortController.signal.aborted) {
            controller.close();
            return;
          }

          let selectedModel: string | null = null;
          let lastError: string | null = null;
          let fullText = "";
          let firstTokenAt: number | null = null;

          for (const m of candidateModels) {
            try {
              const requestBody: Record<string, unknown> = {
                model: m,
                messages: [{ role: "user", content: prompt }],
                temperature: normalized.temperature,
                max_tokens: normalized.maxOutputTokens,
                top_p: normalized.topP,
                stream: true,
              };

              const response = await makeGroqStreamingRequest(
                requestBody,
                abortController.signal
              );

              if (!response.ok || !response.body) {
                const errorText = await response.text().catch(() => "");
                lastError =
                  errorText ||
                  `Groq API error: ${response.status} ${response.statusText}`;
                continue;
              }

              selectedModel = m;
              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              let buffer = "";

              while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() ?? "";

                for (const rawLine of lines) {
                  const line = rawLine.trim();
                  if (!line.startsWith("data:")) continue;

                  const data = line.slice("data:".length).trim();
                  if (!data) continue;
                  if (data === "[DONE]") {
                    break;
                  }

                  try {
                    const parsed = JSON.parse(data) as {
                      choices?: Array<{
                        delta?: { content?: string };
                      }>;
                    };

                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (!delta) continue;

                    if (firstTokenAt === null) {
                      firstTokenAt = Date.now();
                    }

                    fullText += delta;
                    writeEvent({ type: "delta", text: delta });
                  } catch {
                    // Ignore malformed stream chunks
                  }
                }
              }

              if (selectedModel) {
                const cacheKey = makeCacheKey({ ...normalized, model: selectedModel });
                setCachedResponse(cacheKey, {
                  success: true,
                  text: fullText,
                  retries: 0,
                });
              }

              writeEvent({
                type: "done",
                model: selectedModel ?? m,
                elapsedMs: Date.now() - startedAt,
                ttfbMs: firstTokenAt ? firstTokenAt - startedAt : null,
              });
              controller.close();
              return;
            } catch (err: unknown) {
              lastError = err instanceof Error ? err.message : String(err);
              continue;
            }
          }

          const fallbackText =
            "I'm having trouble connecting to my AI service right now. Please try again in a moment.";
          writeEvent({ type: "delta", text: fallbackText });
          writeEvent({
            type: "done",
            model: "fallback",
            elapsedMs: Date.now() - startedAt,
            ttfbMs: null,
            isFallback: true,
          });
          controller.close();

          if (lastError) {
            console.error("Streaming LLM failed:", lastError);
          }
        } catch (err: unknown) {
          writeEvent({
            type: "error",
            error: err instanceof Error ? err.message : String(err),
          });
          controller.close();
        }
      };

      void requestQueue.add(run);
    },
    cancel() {
      abortController.abort();
    },
  });
}

/**
 * Extract JSON from Gemini response (handles markdown code blocks)
 */
export function extractJSON(text: string): string {
  const jsonStr = text.trim();
  
  // Find JSON block if it's wrapped in triple backticks
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch && jsonMatch[1]) {
    return jsonMatch[1].trim();
  }

  // If no backticks, try to find the start and end of the JSON object or array
  const objStart = jsonStr.indexOf('{');
  const arrStart = jsonStr.indexOf('[');
  
  const startIdx = objStart !== -1 && arrStart !== -1 ? Math.min(objStart, arrStart) : Math.max(objStart, arrStart);
  
  if (startIdx !== -1) {
    const objEnd = jsonStr.lastIndexOf('}');
    const arrEnd = jsonStr.lastIndexOf(']');
    const endIdx = Math.max(objEnd, arrEnd);
    
    if (endIdx > startIdx) {
      return jsonStr.substring(startIdx, endIdx + 1).trim();
    }
  }

  return jsonStr;
}

/**
 * Parse JSON response from Gemini with error handling
 */
export function parseGeminiJSON<T = unknown>(text: string): T | null {
  try {
    const cleaned = extractJSON(text);
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.error("Failed to parse Gemini JSON response:", error);
    console.error("Raw text:", text);
    return null;
  }
}
