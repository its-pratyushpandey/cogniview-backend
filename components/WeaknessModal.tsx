"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface WeaknessModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: WeaknessAnalysis | null;
}

const WeaknessModal = ({ isOpen, onClose, analysis }: WeaknessModalProps) => {
  const router = useRouter();

  if (!analysis) return null;

  const handleStartTutor = (topic: WeakTopic) => {
    router.push(
      `/tutor?subject=${encodeURIComponent(topic.subject)}&topic=${encodeURIComponent(topic.topic)}`
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return "var(--error-500)";
      case "MEDIUM":
        return "var(--warning-500)";
      case "LOW":
        return "var(--success-500)";
      default:
        return "var(--gray-500)";
    }
  };

  const getReadinessColor = (score: number) => {
    if (score >= 75) return "var(--success-500)";
    if (score >= 50) return "var(--warning-500)";
    return "var(--error-500)";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="modal-overlay"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="weakness-modal"
          >
            <div className="modal-header">
              <h2 className="text-2xl font-bold modal-title">📊 Interview Analysis</h2>
              <button onClick={onClose} className="modal-close">
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Overall Readiness */}
              <div className="readiness-score">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold">Overall Readiness</span>
                  <span
                    className="text-2xl font-bold"
                    style={{ color: getReadinessColor(analysis.overallReadiness) }}
                  >
                    {analysis.overallReadiness}%
                  </span>
                </div>
                <div className="progress-bar">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${analysis.overallReadiness}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="progress-fill"
                    style={{ backgroundColor: getReadinessColor(analysis.overallReadiness) }}
                  />
                </div>
              </div>

              {/* Recommendation */}
              {analysis.recommendedAction === "START_TUTOR" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="recommendation-banner"
                >
                  <span className="text-2xl mr-2">🎓</span>
                  <div>
                    <p className="font-semibold">Recommendation: Start AI Tutor</p>
                    <p className="text-sm modal-muted">
                      You have weak areas that need focused learning. Our AI Tutor can help you improve!
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Weak Topics */}
              {analysis.weakTopics.length > 0 && (
                <div className="weak-topics-section">
                  <h3 className="text-lg font-semibold mb-3">
                    Areas for Improvement ({analysis.weakTopics.length})
                  </h3>
                  <div className="weak-topics-list">
                    {analysis.weakTopics.map((topic, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index }}
                        className="weak-topic-card"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-semibold text-lg">
                              {topic.subject} - {topic.topic}
                            </h4>
                            <p className="text-sm modal-muted mt-1">{topic.reason}</p>
                          </div>
                          <span
                            className="severity-badge"
                            style={{
                              backgroundColor: `${getSeverityColor(topic.severity)}20`,
                              color: getSeverityColor(topic.severity),
                            }}
                          >
                            {topic.severity}
                          </span>
                        </div>

                        <div className="suggested-focus">
                          <span className="text-sm font-medium">💡 Suggested Focus:</span>
                          <p className="text-sm modal-muted-strong mt-1">{topic.suggestedFocus}</p>
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleStartTutor(topic)}
                          className="start-tutor-btn"
                        >
                          🎓 Start Learning {topic.topic}
                        </motion.button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Priority Subject */}
              {analysis.prioritySubject && (
                <div className="priority-subject">
                  <span className="text-lg">🎯 Priority Focus: </span>
                  <span className="font-bold text-xl" style={{ color: "var(--primary-600)" }}>
                    {analysis.prioritySubject}
                  </span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={onClose} className="btn-secondary">
                Maybe Later
              </button>
              {analysis.weakTopics.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleStartTutor(analysis.weakTopics[0])}
                  className="btn-primary"
                >
                  Start AI Tutor Now 🚀
                </motion.button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WeaknessModal;
