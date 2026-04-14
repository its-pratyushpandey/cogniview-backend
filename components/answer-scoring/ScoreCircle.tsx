"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate, motion } from "framer-motion";

import { cn } from "@/lib/utils";

interface ScoreCircleProps {
  score: number;
  label?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function scoreTone(score: number): string {
  if (score >= 80) return "hsl(142 71% 45%)";
  if (score >= 60) return "hsl(239 84% 67%)";
  if (score >= 40) return "hsl(38 92% 50%)";
  return "hsl(0 84% 60%)";
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function ScoreCircle({
  score,
  label = "AI Score",
  size = 132,
  strokeWidth = 10,
  className,
}: ScoreCircleProps) {
  const normalizedScore = clamp(score);
  const [animatedScore, setAnimatedScore] = useState(normalizedScore);
  const previousScoreRef = useRef(normalizedScore);

  useEffect(() => {
    const animation = animate(previousScoreRef.current, normalizedScore, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (latest) => {
        setAnimatedScore(Math.round(latest));
      },
    });

    previousScoreRef.current = normalizedScore;

    return () => {
      animation.stop();
    };
  }, [normalizedScore]);

  const radius = useMemo(() => (size - strokeWidth) / 2, [size, strokeWidth]);
  const circumference = useMemo(() => 2 * Math.PI * radius, [radius]);
  const strokeOffset = useMemo(
    () => circumference - (normalizedScore / 100) * circumference,
    [circumference, normalizedScore]
  );

  return (
    <div className={cn("inline-flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={scoreTone(normalizedScore)}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={false}
            animate={{ strokeDashoffset: strokeOffset }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          />
        </svg>

        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <p className="text-2xl font-semibold tabular-nums">{animatedScore}</p>
          <p className="-mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">/100</p>
        </div>
      </div>

      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
