"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, RefreshCcw } from "lucide-react";

import type { AdaptiveQuestion, QuestionGenerationMode } from "@/features/resume-analysis/types";
import styles from "@/features/resume-analysis/components/resume-analysis.module.css";

interface QuestionGeneratorSectionProps {
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
  mode: QuestionGenerationMode;
  setMode: (mode: QuestionGenerationMode) => void;
  customTopicsText: string;
  setCustomTopicsText: (value: string) => void;
  questions: AdaptiveQuestion[];
  focusAreas: string[];
  onGenerate: (modeOverride?: QuestionGenerationMode) => void;
}

function difficultyClass(level: "Beginner" | "Intermediate" | "Advanced"): string {
  if (level === "Advanced") {
    return styles.weak;
  }

  if (level === "Intermediate") {
    return styles.moderate;
  }

  return styles.strong;
}

export function QuestionGeneratorSection(props: QuestionGeneratorSectionProps) {
  const {
    status,
    error,
    mode,
    setMode,
    customTopicsText,
    setCustomTopicsText,
    questions,
    focusAreas,
    onGenerate,
  } = props;

  const [openCard, setOpenCard] = useState<string | null>(null);

  const grouped = useMemo(
    () => ({
      MCQ: questions.filter((question) => question.type === "MCQ"),
      Coding: questions.filter((question) => question.type === "Coding"),
      Conceptual: questions.filter((question) => question.type === "Conceptual"),
    }),
    [questions]
  );

  const tabItems: Array<{ key: QuestionGenerationMode; label: string }> = [
    { key: "weak-areas", label: "Weak Areas" },
    { key: "all-skills", label: "All Skills" },
    { key: "custom", label: "Custom" },
  ];

  const hasQuestions = questions.length > 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.14 }}
      className={`${styles.glassCard} ${styles.questionSection}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.8rem" }}>
        <h3 className={styles.panelTitle} style={{ marginBottom: 0 }}>
          Step 4: Adaptive Question Generator
        </h3>

        <button className={styles.ghostButton} type="button" onClick={() => onGenerate()} disabled={status === "loading"}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
            <RefreshCcw size={14} />
            Regenerate
          </span>
        </button>
      </div>

      <div className={styles.tabRow}>
        {tabItems.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`${styles.tabButton} ${mode === tab.key ? styles.tabActive : ""}`}
            onClick={() => {
              setMode(tab.key);
              onGenerate(tab.key);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "custom" ? (
        <textarea
          className={styles.textarea}
          value={customTopicsText}
          onChange={(event) => setCustomTopicsText(event.target.value)}
          style={{ minHeight: "90px", marginBottom: "0.8rem" }}
          placeholder="Type custom topics separated by commas. Example: caching, concurrency, db indexing"
        />
      ) : null}

      {focusAreas.length > 0 ? (
        <div className={styles.badges} style={{ marginBottom: "0.65rem" }}>
          {focusAreas.map((area) => (
            <span key={area} className={`${styles.skillBadge} ${styles.moderate}`}>
              {area}
            </span>
          ))}
        </div>
      ) : null}

      {status === "loading" ? (
        <div className={styles.questionGrid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`skeleton-${index}`} className={styles.questionCard}>
              <div className={styles.skeleton} style={{ width: "42%", height: "0.78rem" }} />
              <div className={styles.skeleton} style={{ marginTop: "0.52rem", width: "100%", height: "0.92rem" }} />
              <div className={styles.skeleton} style={{ marginTop: "0.42rem", width: "76%", height: "0.9rem" }} />
            </div>
          ))}
        </div>
      ) : null}

      {status === "error" && error ? <div className={styles.alert}>{error}</div> : null}

      {status !== "loading" && hasQuestions ? (
        <>
          <p className={styles.meta} style={{ marginBottom: "0.5rem" }}>
            {questions.length} questions generated: {grouped.MCQ.length} MCQ, {grouped.Coding.length} coding, {grouped.Conceptual.length}{" "}
            conceptual.
          </p>

          <div className={styles.questionGrid}>
            {questions.map((question, index) => {
              const isOpen = openCard === question.id;
              return (
                <motion.article
                  key={question.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.04, 0.4) }}
                  className={styles.questionCard}
                  whileHover={{ y: -2, scale: 1.005 }}
                >
                  <div className={styles.questionTop}>
                    <span className={`${styles.skillBadge} ${difficultyClass(question.difficulty)}`}>
                      {question.type} • {question.difficulty}
                    </span>
                    <button
                      className={styles.ghostButton}
                      type="button"
                      onClick={() => setOpenCard(isOpen ? null : question.id)}
                    >
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  <p className={styles.questionText}>{question.questionText}</p>

                  <p className={styles.meta}>
                    Topic: {question.topic} • Source: {question.source}
                  </p>

                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className={styles.questionAnswer}
                      >
                        {question.options && question.options.length > 0 ? (
                          <ul style={{ margin: "0 0 0.5rem", paddingLeft: "1rem" }}>
                            {question.options.map((option) => (
                              <li key={`${question.id}-${option}`} style={{ marginBottom: "0.25rem" }}>
                                {option}
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        <p style={{ margin: "0 0 0.4rem" }}>
                          <strong>Answer idea:</strong> {question.answerSnippet || "Explain using an interview-ready structure."}
                        </p>
                        <p style={{ margin: 0 }}>
                          <strong>Why this question:</strong> {question.explanation}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.article>
              );
            })}
          </div>

          <div style={{ marginTop: "0.8rem", display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
            <Link href="/company-prep" className={styles.linkButton}>
              Use Weaknesses in Company Prep
            </Link>
            <Link href="/interview" className={styles.linkButton}>
              Start AI Interview with these areas
            </Link>
          </div>
        </>
      ) : null}
    </motion.section>
  );
}
