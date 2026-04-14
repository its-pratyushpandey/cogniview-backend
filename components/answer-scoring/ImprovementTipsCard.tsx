"use client";

import { Lightbulb, CheckCircle2, AlertTriangle } from "lucide-react";

interface ImprovementTipsCardProps {
  tips: string[];
  strengths: string[];
  weaknesses: string[];
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of items) {
    const cleaned = item.trim();
    if (!cleaned) continue;

    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    output.push(cleaned);
  }

  return output;
}

export function ImprovementTipsCard({ tips, strengths, weaknesses }: ImprovementTipsCardProps) {
  const cleanTips = dedupe(tips).slice(0, 6);
  const cleanStrengths = dedupe(strengths).slice(0, 6);
  const cleanWeaknesses = dedupe(weaknesses).slice(0, 6);

  return (
    <div className="space-y-4">
      {cleanTips.length > 0 ? (
        <section className="rounded-2xl border border-border/80 bg-card/70 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            Improvement Tips
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {cleanTips.map((tip, index) => (
              <li key={`tip-${index}-${tip}`} className="rounded-lg border border-border/70 bg-secondary/50 px-3 py-2">
                {tip}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {cleanStrengths.length > 0 ? (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Strengths
          </h4>
          <ul className="space-y-1.5 text-sm">
            {cleanStrengths.map((item, index) => (
              <li key={`strength-${index}-${item}`}>• {item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {cleanWeaknesses.length > 0 ? (
        <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-400">
            <AlertTriangle className="h-4 w-4" />
            Priority Improvements
          </h4>
          <ul className="space-y-1.5 text-sm">
            {cleanWeaknesses.map((item, index) => (
              <li key={`weak-${index}-${item}`}>• {item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
