"use client";

import { motion } from "framer-motion";

interface FeedbackBreakdownProps {
  clarity: number;
  accuracy: number;
  depth: number;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-primary";
  if (score >= 40) return "bg-amber-500";
  return "bg-destructive";
}

export function FeedbackBreakdown({ clarity, accuracy, depth }: FeedbackBreakdownProps) {
  const rows = [
    { label: "Clarity", score: clamp(clarity) },
    { label: "Accuracy", score: clamp(accuracy) },
    { label: "Depth", score: clamp(depth) },
  ];

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.label} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{row.label}</span>
            <span className="tabular-nums">{row.score}</span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary/70">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${row.score}%` }}
              transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
              className={`h-full rounded-full ${scoreColor(row.score)}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
