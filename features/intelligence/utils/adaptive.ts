import type {
  IntelligenceDifficultyPreference,
  IntelligenceWeakSignal,
  UserIntelligenceSnapshot,
} from "@/features/intelligence/types";

export interface RealtimeHeuristicSignal {
  confidenceScore: number;
  clarityScore: number;
  readinessScore: number;
  weakHints: string[];
  fillerRatio: number;
  avgWordsPerAnswer: number;
}

function normalizeSeverityWeight(severity: IntelligenceWeakSignal["severity"]): number {
  if (severity === "high") return 100;
  if (severity === "medium") return 65;
  return 35;
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function difficultyFromScore(score: number): IntelligenceDifficultyPreference {
  const normalized = clampScore(score);
  if (normalized <= 45) return "easy";
  if (normalized <= 72) return "medium";
  return "hard";
}

export function getTopWeakAreas(snapshot: UserIntelligenceSnapshot | null, limit = 6): string[] {
  if (!snapshot) return [];

  const fromSignals = [...snapshot.weakSignals]
    .sort((a, b) => {
      const severity = normalizeSeverityWeight(b.severity) - normalizeSeverityWeight(a.severity);
      if (severity !== 0) return severity;
      return b.count - a.count;
    })
    .map((signal) => signal.topic);

  return dedupeStrings([...fromSignals, ...snapshot.weakAreas]).slice(0, limit);
}

export function getTopStrengthAreas(snapshot: UserIntelligenceSnapshot | null, limit = 6): string[] {
  if (!snapshot) return [];

  const fromStrengthSignals = [...snapshot.strengths]
    .sort((a, b) => b.score - a.score)
    .map((signal) => signal.topic);

  return dedupeStrings([...fromStrengthSignals, ...snapshot.strongAreas]).slice(0, limit);
}

export function computeRealtimeHeuristics(
  messages: Array<{ role: string; content: string }>
): RealtimeHeuristicSignal {
  const userMessages = messages.filter((msg) => msg.role === "user");
  if (userMessages.length === 0) {
    return {
      confidenceScore: 0,
      clarityScore: 0,
      readinessScore: 0,
      weakHints: [],
      fillerRatio: 0,
      avgWordsPerAnswer: 0,
    };
  }

  const fullText = userMessages.map((msg) => msg.content).join(" ").toLowerCase();
  const words = fullText.match(/\b[a-z']+\b/g) ?? [];
  const totalWords = Math.max(words.length, 1);

  const fillerTokens = new Set(["um", "uh", "hmm", "like", "actually", "basically", "literally"]);
  const fillerCount = words.reduce((acc, word) => acc + (fillerTokens.has(word) ? 1 : 0), 0);

  const lookupCount = (value: string) => (value.length > 0 ? fullText.split(value).length - 1 : 0);

  const hedgeCount =
    lookupCount("not sure") +
    lookupCount("i think") +
    lookupCount("i guess") +
    lookupCount("probably") +
    lookupCount("maybe") +
    lookupCount("i don't know");

  const structureCount =
    lookupCount("because") +
    lookupCount("therefore") +
    lookupCount("for example") +
    lookupCount("first") +
    lookupCount("second") +
    lookupCount("in summary") +
    lookupCount("to summarize");

  const avgWordsPerAnswer = totalWords / Math.max(userMessages.length, 1);
  const fillerRatio = fillerCount / totalWords;

  const confidenceScore = clampScore(76 - fillerRatio * 190 - hedgeCount * 5 + structureCount * 2);
  const clarityScore = clampScore(72 - fillerRatio * 160 - Math.max(0, avgWordsPerAnswer - 40) * 0.75 + structureCount * 3);
  const readinessScore = clampScore(confidenceScore * 0.55 + clarityScore * 0.45);

  const weakHints: string[] = [];
  if (fillerRatio > 0.06) weakHints.push("Fluency");
  if (hedgeCount >= 3) weakHints.push("Confidence");
  if (avgWordsPerAnswer > 45) weakHints.push("Conciseness");
  if (structureCount <= 1) weakHints.push("Answer Structure");

  return {
    confidenceScore,
    clarityScore,
    readinessScore,
    weakHints,
    fillerRatio,
    avgWordsPerAnswer: Number(avgWordsPerAnswer.toFixed(2)),
  };
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }

  return output;
}
