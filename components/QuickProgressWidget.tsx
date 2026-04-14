"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { api } from "@/lib/api-client";

interface QuickProgressWidgetProps {
  userId: string;
}

interface SubjectSummary {
  subject: string;
  strength: number;
  strongTopics: number;
  totalTopics: number;
}

function isUserProgressResponse(value: unknown): value is UserProgress {
  return (
    typeof value === "object" &&
    value !== null &&
    "subject" in value &&
    "topics" in value
  );
}

const QuickProgressWidget = ({ userId }: QuickProgressWidgetProps) => {
  const [summaries, setSummaries] = useState<SubjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const fetchProgressSummary = async () => {
      try {
        if (isActive) {
          setLoading(true);
        }

        const result = await api.get<unknown>(
          `/api/progress/get-heatmap?userId=${encodeURIComponent(userId)}`,
          {
            maxRetries: 2,
            retryDelay: 800,
            timeout: 18000,
          }
        );

        if (!result.success) {
          throw new Error(result.error || "Failed to fetch progress summary");
        }

        const allProgress = Array.isArray(result.data)
          ? result.data.filter(isUserProgressResponse)
          : [];

        const summaries = allProgress.map((progress) => {
          const topics = Object.values(progress.topics);
          return {
            subject: progress.subject,
            strength: progress.overallStrength || 0,
            strongTopics: topics.filter((t) => t.status === "STRONG").length,
            totalTopics: topics.length,
          };
        });

        if (isActive) {
          setSummaries(summaries);
        }
      } catch (error) {
        console.error("Error fetching progress summary:", error);
        if (isActive) {
          setSummaries([]);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void fetchProgressSummary();

    return () => {
      isActive = false;
    };
  }, [userId]);

  const getStrengthColor = (strength: number): string => {
    if (strength >= 75) return "var(--success-500)";
    if (strength >= 50) return "var(--orange-500)";
    if (strength > 0) return "var(--error-500)";
    return "var(--gray-300)";
  };

  const overallStrength =
    summaries.length > 0
      ? summaries.reduce((sum, s) => sum + s.strength, 0) / summaries.length
      : 0;

  if (loading) {
    return (
      <div className="quick-progress-widget loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="quick-progress-widget"
    >
      <div className="widget-header">
        <h3 className="widget-title">📊 Your Progress</h3>
        <Link href="/progress" className="view-all-link">
          View Heatmap →
        </Link>
      </div>

      <div className="overall-strength-bar">
        <div className="strength-label">
          <span>Overall Mastery</span>
          <span className="strength-value">{Math.round(overallStrength)}%</span>
        </div>
        <div className="strength-track">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${overallStrength}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="strength-fill"
            style={{ background: getStrengthColor(overallStrength) }}
          />
        </div>
      </div>

      <div className="subjects-grid">
        {summaries.map((summary, index) => (
          <motion.div
            key={summary.subject}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="subject-mini-card"
          >
            <div className="subject-name">{summary.subject}</div>
            <div className="subject-stats">
              <div
                className="strength-circle"
                style={{ borderColor: getStrengthColor(summary.strength) }}
              >
                <span
                  className="strength-text"
                  style={{ color: getStrengthColor(summary.strength) }}
                >
                  {Math.round(summary.strength)}%
                </span>
              </div>
              <div className="topic-count">
                <span className="strong-count">{summary.strongTopics}</span>
                <span className="total-count">/{summary.totalTopics}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {summaries.length === 0 && (
        <div className="empty-state">
          <p>🎯 Start learning to track your progress!</p>
        </div>
      )}
    </motion.div>
  );
};

export default QuickProgressWidget;
