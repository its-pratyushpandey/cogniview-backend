"use client";

interface QuestionPriorityMetadata {
  targetedWeakArea?: boolean;
  priorityScore?: number;
  threshold?: number;
  matchedTag?: string | null;
  reason?: string;
}

interface WhyThisQuestionCardProps {
  metadata?: QuestionPriorityMetadata | null;
  moduleLabel: string;
  topic?: string;
  difficulty?: string | number;
  className?: string;
}

function formatScore(value: number | undefined): string {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const raw = Number(value);
  const scaled = raw <= 1 ? raw * 100 : raw;
  const clamped = Math.max(0, Math.min(100, Math.round(scaled)));
  return `${clamped}%`;
}

export function WhyThisQuestionCard({
  metadata,
  moduleLabel,
  topic,
  difficulty,
  className,
}: WhyThisQuestionCardProps) {
  const isTargeted = Boolean(metadata?.targetedWeakArea);

  const explanation = metadata?.reason?.trim()
    ? metadata.reason.trim()
    : isTargeted
      ? "This question targets a recently weak concept to improve retention and confidence."
      : "This question balances your current level with topic coverage to keep progress steady.";

  const containerClassName = [
    "rounded-xl border px-3 py-3",
    isTargeted ? "border-amber-400/50 bg-amber-500/10" : "border-border/80 bg-secondary/50",
    className ?? "",
  ]
    .join(" ")
    .trim();

  const strategyLabel = isTargeted ? "Weak-area targeting" : "Adaptive coverage";

  return (
    <div className={containerClassName}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this question?</p>
        <span className="rounded-full border border-border/70 bg-card/70 px-2 py-0.5 text-[11px] font-medium">
          {strategyLabel}
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed">{explanation}</p>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-lg border border-border/70 bg-card/70 px-2 py-1.5">
          <p className="text-muted-foreground">Topic</p>
          <p className="mt-0.5 truncate font-medium">{topic || "Current focus"}</p>
        </div>

        <div className="rounded-lg border border-border/70 bg-card/70 px-2 py-1.5">
          <p className="text-muted-foreground">Priority</p>
          <p className="mt-0.5 font-medium tabular-nums">{formatScore(metadata?.priorityScore)}</p>
        </div>

        <div className="rounded-lg border border-border/70 bg-card/70 px-2 py-1.5">
          <p className="text-muted-foreground">Difficulty</p>
          <p className="mt-0.5 truncate font-medium">{difficulty || "Adaptive"}</p>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Logic: {moduleLabel} engine {metadata?.threshold !== undefined ? `(threshold ${formatScore(metadata.threshold)})` : ""}
      </p>
    </div>
  );
}
