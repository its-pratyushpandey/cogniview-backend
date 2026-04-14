"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { collection, addDoc, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/firebase/client";
import { useAdaptiveEngine } from "@/features/intelligence/hooks/useAdaptiveEngine";
import { useAnswerScoring } from "@/features/intelligence/hooks/useAnswerScoring";
import { WhyThisQuestionCard } from "@/features/intelligence/components/WhyThisQuestionCard";
import { AnswerScorePanel } from "@/components/answer-scoring";

const TOPICS = [
  { id: "speed-distance-time", name: "Time, Speed & Distance", icon: "🚄", color: "#3b82f6" },
  { id: "work-time", name: "Time & Work", icon: "⚙️", color: "#8b5cf6" },
  { id: "profit-loss", name: "Profit & Loss", icon: "💰", color: "#10b981" },
  { id: "percentage", name: "Percentages", icon: "📊", color: "#f59e0b" },
  { id: "ratio-proportion", name: "Ratio & Proportion", icon: "⚖️", color: "#ef4444" },
  { id: "probability", name: "Probability", icon: "🎲", color: "#06b6d4" },
  { id: "permutation-combination", name: "Permutation & Combination", icon: "🔢", color: "#ec4899" },
  { id: "number-series", name: "Number Series", icon: "🔗", color: "#6366f1" },
];

const DIFFICULTIES = ["Easy", "Medium", "Hard", "Expert"];

function toDifficultyPreference(value: string): "easy" | "medium" | "hard" | "adaptive" {
  if (value === "Easy") return "easy";
  if (value === "Medium") return "medium";
  if (value === "Hard" || value === "Expert") return "hard";
  return "adaptive";
}

function getAdjustedDifficulty(current: string, direction: 1 | -1): string {
  const order = ["Easy", "Medium", "Hard", "Expert"];
  const index = order.indexOf(current);
  if (index < 0) return current;
  const nextIndex = Math.max(0, Math.min(order.length - 1, index + direction));
  return order[nextIndex];
}

interface PerformanceData {
  userId: string;
  topic: string;
  difficulty: string;
  problemId: string;
  userAnswer: string;
  correctAnswer: string;
  timeSpent: number;
  hintsUsed: number;
  isCorrect: boolean;
  createdAt: string;
}

const AptitudeTrainer = ({ userId }: { userId: string; userName: string }) => {
  const router = useRouter();
  const [step, setStep] = useState<"setup" | "solving" | "solution">("setup");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [problem, setProblem] = useState<AptitudeProblem | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [showHints, setShowHints] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [performance, setPerformance] = useState<PerformanceData[]>([]);
  const [latestEvaluationPayload, setLatestEvaluationPayload] = useState<{
    question: string;
    userAnswer: string;
  } | null>(null);

  const { trackLearning, markTopicProgress, setDifficultyPreference } = useAdaptiveEngine("aptitude");
  const {
    result: answerScoreResult,
    isLoading: isAnswerScoring,
    isOptimistic: isAnswerScoringOptimistic,
    error: answerScoringError,
    evaluateAnswer,
    resetScore,
  } = useAnswerScoring({ debounceMs: 420 });

  useEffect(() => {
    void setDifficultyPreference(toDifficultyPreference(difficulty));
  }, [difficulty, setDifficultyPreference]);

  useEffect(() => {
    if (step === "solving") {
      const timer = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step]);

  useEffect(() => {
    loadPerformanceHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadPerformanceHistory = async () => {
    try {
      // Try compound query with orderBy (requires composite index)
      const q = query(
        collection(db, "aptitudeSessions"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map((doc) => doc.data() as PerformanceData);
      setPerformance(history);
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      const errorMessage = typeof err?.message === "string" ? err.message : String(error);
      
      // If index is missing, fall back to simpler query
      if (errorMessage.includes("index") || errorMessage.includes("FAILED_PRECONDITION")) {
        console.info("📊 Using fallback query for performance history (composite index not deployed yet)");
        
        try {
          // Fallback: Get all user sessions and sort in memory
          const simpleQuery = query(
            collection(db, "aptitudeSessions"),
            where("userId", "==", userId)
          );
          const snapshot = await getDocs(simpleQuery);
          const history = snapshot.docs
            .map((doc) => doc.data() as PerformanceData)
            .sort((a, b) => {
              const dateA = new Date(a.createdAt);
              const dateB = new Date(b.createdAt);
              return dateB.getTime() - dateA.getTime();
            })
            .slice(0, 10);
          setPerformance(history);
        } catch (fallbackError: unknown) {
          console.error("Fallback query also failed:", fallbackError);
          setPerformance([]);
        }
      } else if (err?.code === "permission-denied") {
        // Gracefully handle Firebase permission errors
        console.warn("Firebase permissions not configured yet. Using empty performance history.");
        setPerformance([]);
      } else {
        console.error("Error loading performance:", error);
        setPerformance([]);
      }
    }
  };

  const generateProblem = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/aptitude/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          topic: selectedTopic,
          difficulty,
          performance,
        }),
      });

      const data = await response.json();
      if (data.success && data.problem) {
        setProblem(data.problem);
        setStep("solving");
        setTimeElapsed(0);
        setShowHints([]);
        setUserAnswer("");
        setLatestEvaluationPayload(null);
        resetScore();
      }
    } catch (error) {
      console.error("Error generating problem:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const revealHint = (index: number) => {
    if (!showHints.includes(index)) {
      setShowHints([...showHints, index]);
    }
  };

  const submitAnswer = () => {
    if (problem) {
      const evaluationPayload = {
        question: problem.statement,
        userAnswer,
      };
      setLatestEvaluationPayload(evaluationPayload);
      evaluateAnswer(evaluationPayload, { immediate: true });
    }

    setStep("solution");
    saveProblemSession();
  };

  const saveProblemSession = async () => {
    if (!problem) return;

    const isCorrect = userAnswer.trim() === problem.answer.trim();
    const score = isCorrect ? 100 : Math.max(28, 62 - showHints.length * 9);
    const responseTimeMs = timeElapsed * 1000;
    const expectedSecondsRaw = Number(problem.expectedTime);
    const expectedSeconds = Number.isFinite(expectedSecondsRaw) && expectedSecondsRaw > 0 ? expectedSecondsRaw : 120;
    
    try {
      await addDoc(collection(db, "aptitudeSessions"), {
        userId,
        topic: selectedTopic,
        difficulty,
        problemId: problem.id,
        userAnswer,
        correctAnswer: problem.answer,
        timeSpent: timeElapsed,
        hintsUsed: showHints.length,
        isCorrect,
        createdAt: new Date().toISOString(),
      });

      void markTopicProgress({
        subject: "Aptitude",
        topicName: topicData?.name || selectedTopic,
        score,
        responseTimeMs,
        retries: showHints.length,
      });

      void trackLearning({
        topicName: topicData?.name || selectedTopic,
        score,
        responseTimeMs,
        retries: showHints.length,
        confidence: isCorrect ? 80 : 42,
        difficultyPreference: toDifficultyPreference(difficulty),
      });

      if (isCorrect && showHints.length === 0 && timeElapsed <= expectedSeconds) {
        setDifficulty((prev) => getAdjustedDifficulty(prev, 1));
      } else if (!isCorrect) {
        setDifficulty((prev) => getAdjustedDifficulty(prev, -1));
      }
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };

      if (err?.code === "permission-denied") {
        console.warn("Firebase permissions not configured. Session not saved to database.");
      } else {
        console.error("Error saving session:", error);
      }
    }
  };

  const topicData = TOPICS.find((t) => t.id === selectedTopic);

  if (step === "setup") {
    return (
      <div className="aptitude-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="aptitude-setup"
        >
          <h2 className="text-3xl font-bold text-center mb-2">
            🧠 Reasoning & Aptitude Trainer
          </h2>
          <p className="text-center text-gray-600 mb-8">
            Master aptitude with AI-powered step-by-step analysis
          </p>

          {/* Topic Selection */}
          <div className="setup-section">
            <h3 className="setup-label">Select Topic</h3>
            <div className="topics-grid">
              {TOPICS.map((topic) => (
                <motion.button
                  key={topic.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedTopic(topic.id)}
                  className={`topic-card ${
                    selectedTopic === topic.id ? "selected" : ""
                  }`}
                  style={{ borderColor: topic.color }}
                >
                  <span className="text-4xl">{topic.icon}</span>
                  <span className="text-sm font-semibold text-center">
                    {topic.name}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {selectedTopic && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="setup-section"
            >
              <h3 className="setup-label">Difficulty Level</h3>
              <div className="difficulty-selector">
                {DIFFICULTIES.map((diff) => (
                  <motion.button
                    key={diff}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setDifficulty(diff)}
                    className={`difficulty-btn ${
                      difficulty === diff ? "selected" : ""
                    }`}
                  >
                    {diff}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Performance Stats */}
          {performance.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="performance-summary"
            >
              <h3 className="text-lg font-semibold mb-3">Your Performance</h3>
              <div className="stats-row">
                <div className="stat-box">
                  <span className="stat-number">{performance.length}</span>
                  <span className="stat-label">Problems Solved</span>
                </div>
                <div className="stat-box">
                  <span className="stat-number">
                    {(
                      (performance.filter((p) => p.isCorrect).length /
                        performance.length) *
                      100
                    ).toFixed(0)}
                    %
                  </span>
                  <span className="stat-label">Accuracy</span>
                </div>
                <div className="stat-box">
                  <span className="stat-number">
                    {Math.floor(
                      performance.reduce((sum, p) => sum + p.timeSpent, 0) /
                        performance.length
                    )}
                    s
                  </span>
                  <span className="stat-label">Avg Time</span>
                </div>
              </div>
            </motion.div>
          )}

          {selectedTopic && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={generateProblem}
              disabled={isLoading}
              className="generate-btn"
            >
              {isLoading ? "Generating Problem... ⏳" : "Start Practice 🚀"}
            </motion.button>
          )}
        </motion.div>
      </div>
    );
  }

  if (step === "solving" && problem) {
    return (
      <div className="aptitude-container">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="problem-solver"
        >
          {/* Header */}
          <div className="problem-header">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{topicData?.icon}</span>
              <div>
                <h3 className="font-semibold">{topicData?.name}</h3>
                <span className="text-sm text-gray-600">{problem.difficulty}</span>
              </div>
            </div>
            <div className="timer">
              <span>⏱️ {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, "0")}</span>
            </div>
          </div>

          <WhyThisQuestionCard
            metadata={problem.mistakePriority}
            moduleLabel="Aptitude adaptive"
            topic={topicData?.name || selectedTopic}
            difficulty={problem.difficulty}
            className="mb-3"
          />

          {/* Problem Statement */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="problem-card"
          >
            <h3 className="problem-title">Problem Statement</h3>
            <p className="problem-text font-medium text-lg mb-6 whitespace-pre-wrap">{problem.statement}</p>

            {problem.options && problem.options.length > 0 ? (
              <div className="options-grid grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {problem.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => setUserAnswer(option)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      userAnswer === option
                        ? "border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500/20"
                        : "border-gray-200 hover:border-blue-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className="font-semibold text-blue-600 dark:text-blue-400 mr-2">{String.fromCharCode(65 + index)}.</span>
                    <span className="text-gray-800 dark:text-gray-200">
                      {option.replace(/^[A-D]\)\s*/, '')}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              /* Answer Input (Fallback if no options) */
              <div className="answer-section">
                <h4 className="text-lg font-semibold mb-3">Your Answer</h4>
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Enter your answer..."
                  className="answer-input"
                />
                <p className="text-sm text-gray-600 mt-2">
                  💡 Expected time: {problem.expectedTime} | Format: {problem.answerFormat}
                </p>
              </div>
            )}

            {/* Hints */}
            <div className="hints-section">
              <h4 className="text-lg font-semibold mb-3">
                Hints ({showHints.length}/{problem.hints.length})
              </h4>
              <AnimatePresence>
                {problem.hints.map((hint, index) => {
                  const isRevealed = showHints.includes(index);
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="hint-item"
                    >
                      {isRevealed ? (
                        <div className="hint-revealed">
                          <span className="hint-number">Hint {index + 1}</span>
                          <p className="hint-text">{hint}</p>
                        </div>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => revealHint(index)}
                          className="hint-button"
                        >
                          🔓 Reveal Hint {index + 1}
                        </motion.button>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={submitAnswer}
              disabled={!userAnswer.trim()}
              className="submit-btn"
            >
              Submit Answer & View Solution 🎯
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (step === "solution" && problem) {
    const isCorrect = userAnswer.trim() === problem.answer.trim();

    return (
      <div className="aptitude-container">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="solution-view"
        >
          {/* Result Banner */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`result-banner ${isCorrect ? "correct" : "wrong"}`}
          >
            <span className="text-4xl">{isCorrect ? "✅" : "❌"}</span>
            <div>
              <h3 className="text-2xl font-bold">
                {isCorrect ? "Correct Answer!" : "Keep Practicing!"}
              </h3>
              <p className="text-sm">
                Time taken: {Math.floor(timeElapsed / 60)}m {timeElapsed % 60}s | Hints
                used: {showHints.length}/{problem.hints.length}
              </p>
            </div>
          </motion.div>

          {/* Answer Comparison */}
          <div className="answer-comparison">
            <div className="comparison-row">
              <div className="comparison-box user">
                <h4>Your Answer</h4>
                <p className={isCorrect ? "text-green-600" : "text-red-600"}>
                  {userAnswer || "No answer provided"}
                </p>
              </div>
              <div className="comparison-box correct">
                <h4>Correct Answer</h4>
                <p className="text-green-600">{problem.answer}</p>
              </div>
            </div>
          </div>

          <AnswerScorePanel
            result={answerScoreResult}
            isLoading={isAnswerScoring}
            isOptimistic={isAnswerScoringOptimistic}
            error={answerScoringError}
            title="Submission Score Breakdown"
            description="AI scoring on clarity, accuracy, and depth after your submission."
            onEvaluate={
              latestEvaluationPayload
                ? () => evaluateAnswer(latestEvaluationPayload, { immediate: true })
                : undefined
            }
            evaluateLabel="Re-evaluate answer"
            className="mt-4"
          />

          {/* Solution Methods */}
          <div className="solutions-grid">
            {problem.solutionMethods.map((method: { name: string; steps: string[]; time: string }, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="solution-method-card"
              >
                <div className="method-header">
                  <h4 className="method-title">{method.name}</h4>
                  <span className="method-time">⏱️ {method.time}</span>
                </div>
                <ol className="method-steps">
                  {method.steps.map((step: string, stepIdx: number) => (
                    <li key={stepIdx} className="method-step">
                      {step}
                    </li>
                  ))}
                </ol>
              </motion.div>
            ))}
          </div>

          {/* Learning Tip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="learning-tip-box"
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl">💡</span>
              <div>
                <h4 className="font-semibold text-lg mb-2">Key Learning</h4>
                <p className="text-gray-700">{problem.learningTip}</p>
              </div>
            </div>
          </motion.div>

          {/* Related Topics */}
          <div className="related-topics">
            <h4 className="text-lg font-semibold mb-3">Related Topics</h4>
            <div className="flex flex-wrap gap-2">
              {problem.relatedTopics.map((topic: string, idx: number) => (
                <span key={idx} className="related-tag">
                  {topic}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="solution-actions">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setStep("setup");
                setProblem(null);
                setUserAnswer("");
                setShowHints([]);
                setLatestEvaluationPayload(null);
                resetScore();
              }}
              className="btn-secondary"
            >
              Practice Another Problem
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/")}
              className="btn-primary"
            >
              Back to Home
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
};

export default AptitudeTrainer;
