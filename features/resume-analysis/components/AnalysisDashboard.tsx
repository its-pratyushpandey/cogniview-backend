"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ShieldCheck, TrendingUp } from "lucide-react";

import type { ResumeIntelligence } from "@/features/resume-analysis/types";
import styles from "@/features/resume-analysis/components/resume-analysis.module.css";

interface AnalysisDashboardProps {
  intelligence: ResumeIntelligence;
}

function confidenceClass(confidence: "High" | "Moderate" | "Low"): string {
  if (confidence === "High") {
    return styles.strong;
  }

  if (confidence === "Moderate") {
    return styles.moderate;
  }

  return styles.weak;
}

function severityChip(severity: "high" | "medium" | "low"): string {
  if (severity === "high") {
    return "High";
  }

  if (severity === "medium") {
    return "Medium";
  }

  return "Low";
}

function AnalysisDashboardComponent({ intelligence }: AnalysisDashboardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.08 }}
      className={styles.dashboardGrid}
    >
      <div className={`${styles.glassCard} ${styles.panel}`}>
        <h3 className={styles.panelTitle}>Step 2: Skills Overview</h3>
        <div className={styles.badges}>
          {intelligence.skills.map((skill) => (
            <span key={skill.name} className={`${styles.skillBadge} ${confidenceClass(skill.confidence)}`}>
              {skill.name}
              <span style={{ marginLeft: "0.35rem", opacity: 0.8 }}>{skill.confidence}</span>
            </span>
          ))}
        </div>

        <div style={{ marginTop: "0.75rem" }}>
          <h4 style={{ margin: "0 0 0.45rem" }}>Strength Signals</h4>
          <div className={styles.badges}>
            {intelligence.strengths.length > 0 ? (
              intelligence.strengths.map((strength) => (
                <span key={strength} className={`${styles.skillBadge} ${styles.strong}`}>
                  {strength}
                </span>
              ))
            ) : (
              <span className={styles.meta}>No explicit strengths detected yet.</span>
            )}
          </div>
        </div>
      </div>

      <div className={`${styles.glassCard} ${styles.panel}`}>
        <h3 className={styles.panelTitle}>Step 3: Weakness Detection</h3>

        <div className={styles.experienceCard}>
          <p className={styles.meta} style={{ margin: 0 }}>
            Experience Level
          </p>
          <div className={styles.experienceLevel}>{intelligence.experienceLevel}</div>
          <p className={styles.meta} style={{ marginTop: "0.3rem" }}>
            Recommended roles: {intelligence.recommendedRoles.join(", ") || "Software Engineer"}
          </p>
        </div>

        <div style={{ marginTop: "0.78rem" }} className={styles.weaknessList}>
          {intelligence.weaknesses.length === 0 ? (
            <div className={styles.weaknessItem}>
              <div className={styles.weaknessHeader}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                  <ShieldCheck size={15} />
                  No critical weakness found
                </span>
              </div>
              <p className={styles.weaknessReason}>
                Resume coverage looks balanced. Continue with all-skills question mode for deeper calibration.
              </p>
            </div>
          ) : (
            intelligence.weaknesses.map((weakness) => (
              <div key={weakness.id} className={styles.weaknessItem}>
                <div className={styles.weaknessHeader}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                    <AlertTriangle size={14} />
                    {weakness.topic}
                  </span>
                  <span className={`${styles.skillBadge} ${weakness.severity === "high" ? styles.weak : styles.moderate}`}>
                    {severityChip(weakness.severity)}
                  </span>
                </div>
                <p className={styles.weaknessReason}>{weakness.reason}</p>
                <p className={styles.meta} style={{ marginTop: "0.25rem" }}>
                  Why weak: {weakness.whyWeak}
                </p>
              </div>
            ))
          )}
        </div>

        {intelligence.missingKeySkills.length > 0 ? (
          <div style={{ marginTop: "0.75rem" }}>
            <p className={styles.meta}>
              <TrendingUp size={14} style={{ marginRight: "0.35rem", verticalAlign: "text-top" }} />
              Missing key skills: {intelligence.missingKeySkills.join(", ")}
            </p>
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}

export const AnalysisDashboard = memo(AnalysisDashboardComponent);
