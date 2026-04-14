"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAdaptiveEngine } from "@/features/intelligence/hooks/useAdaptiveEngine";
import { WhyThisQuestionCard } from "@/features/intelligence/components/WhyThisQuestionCard";

const SUBJECTS = [
  { id: "OS", name: "Operating Systems", icon: "💻", color: "#3b82f6" },
  { id: "DBMS", name: "Database Management", icon: "🗄️", color: "#8b5cf6" },
  { id: "OOPS", name: "Object Oriented Programming", icon: "🎯", color: "#10b981" },
  { id: "CN", name: "Computer Networks", icon: "🌐", color: "#f59e0b" },
  { id: "DSA", name: "Data Structures & Algorithms", icon: "🧮", color: "#ef4444" },
];

interface VivaChainProps {
  userId: string;
  userName: string;
}

type VivaHistoryMessage = VivaSession["conversationHistory"][number];

type EvaluationColors = {
  bg: string;
  border: string;
  text: string;
};

function toDifficultyPreference(level: number): "easy" | "medium" | "hard" | "adaptive" {
  if (level <= 4) return "easy";
  if (level <= 7) return "medium";
  return "hard";
}

const AIVivaChain = ({ userId }: VivaChainProps) => {
  const router = useRouter();
  const [step, setStep] = useState<"setup" | "viva">("setup");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [baseTopic, setBaseTopic] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<VivaHistoryMessage[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<VivaQuestion | null>(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [stats, setStats] = useState({
    questionsAsked: 0,
    goodAnswers: 0,
    averageAnswers: 0,
    poorAnswers: 0,
    currentDifficulty: 3,
  });
  
  const questionPresentedAtRef = useRef<number>(Date.now());

  const { trackLearning, markTopicProgress, setDifficultyPreference } = useAdaptiveEngine("viva");

  useEffect(() => {
    setSelectedOptionIndex(null);
  }, [currentQuestion?.nextQuestion]);

  useEffect(() => {
    if (step === "viva" && currentQuestion) {
      questionPresentedAtRef.current = Date.now();
      void setDifficultyPreference(toDifficultyPreference(currentQuestion.difficulty));
    }
  }, [currentQuestion, setDifficultyPreference, step]);

  const startVivaSession = async () => {
    if (!selectedSubject || !baseTopic.trim()) return;

    setIsLoading(true);
    try {
      // Create session via API
      const sessionResponse = await fetch("/api/viva/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          subject: selectedSubject,
          baseTopic: baseTopic.trim(),
        }),
      });

      const sessionData = await sessionResponse.json();
      if (!sessionData.success) {
        throw new Error("Failed to create viva session");
      }

      setSessionId(sessionData.sessionId);

      // Get first question
      const response = await fetch("/api/interview/viva-chain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          subject: selectedSubject,
          baseTopic: baseTopic.trim(),
          conversationHistory: [],
          isFirstQuestion: true,
        }),
      });

      const data = await response.json();
      if (data.success && data.viva) {
        setCurrentQuestion(data.viva);
        setConversationHistory([
          {
            role: "assistant",
            content: data.viva.nextQuestion,
            timestamp: new Date().toISOString(),
          },
        ]);
        setStats(prev => ({ ...prev, questionsAsked: 1, currentDifficulty: data.viva.difficulty }));
        void setDifficultyPreference(toDifficultyPreference(data.viva.difficulty));
        setStep("viva");
      }
    } catch (error) {
      console.error("Error starting viva session:", error);
      alert("Failed to start viva session. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (selectedOptionIndex === null || isLoading || !sessionId || !currentQuestion) return;

    const selectedOption = currentQuestion.mcqOptions[selectedOptionIndex];
    if (!selectedOption) return;

    const answerContent = `${String.fromCharCode(65 + selectedOptionIndex)}. ${selectedOption}`;

    setIsLoading(true);
    setShowHint(false);
    setCurrentHintIndex(0);

    const userMessage: VivaHistoryMessage = {
      role: "user",
      content: answerContent,
      timestamp: new Date().toISOString(),
    };

    const updatedHistory: VivaHistoryMessage[] = [...conversationHistory, userMessage];
    setConversationHistory(updatedHistory);
    setSelectedOptionIndex(null);

    try {
      // Get next question with evaluation
      const response = await fetch("/api/interview/viva-chain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          subject: selectedSubject,
          baseTopic,
          conversationHistory: updatedHistory,
          isFirstQuestion: false,
        }),
      });

      const data = await response.json();
      if (data.success && data.viva) {
        const evaluation = data.viva.evaluationOfPreviousAnswer;
        const responseTimeMs = Math.max(0, Date.now() - questionPresentedAtRef.current);

        // Add evaluation to the last user message
        const historyWithEval = [...updatedHistory];
        if (evaluation && historyWithEval.length > 0) {
          historyWithEval[historyWithEval.length - 1].evaluation = evaluation;
        }

        // Add next question
        const assistantMessage: VivaHistoryMessage = {
          role: "assistant",
          content: data.viva.nextQuestion,
          timestamp: new Date().toISOString(),
        };

        const finalHistory = [...historyWithEval, assistantMessage];
        setConversationHistory(finalHistory);
        setCurrentQuestion(data.viva);

        // Update stats
        const newStats = { ...stats, questionsAsked: stats.questionsAsked + 1 };
        if (evaluation) {
          if (evaluation.quality === "GOOD") newStats.goodAnswers++;
          else if (evaluation.quality === "AVERAGE") newStats.averageAnswers++;
          else if (evaluation.quality === "POOR") newStats.poorAnswers++;
          newStats.currentDifficulty = data.viva.difficulty;
        }
        setStats(newStats);

        const evaluatedScore = Math.max(0, Math.min(100, Math.round((evaluation?.score ?? 5.5) * 10)));
        const difficultyPreference = toDifficultyPreference(data.viva.difficulty);

        void markTopicProgress({
          subject: selectedSubject,
          topicName: baseTopic,
          score: evaluatedScore,
          responseTimeMs,
          retries: currentHintIndex,
        });

        void trackLearning({
          topicName: baseTopic,
          score: evaluatedScore,
          responseTimeMs,
          retries: currentHintIndex,
          confidence: evaluatedScore,
          difficultyPreference,
        });

        void setDifficultyPreference(difficultyPreference);

        // Update session via API
        await fetch("/api/viva/update-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            userId,
            subject: selectedSubject,
            topic: baseTopic,
            conversationHistory: finalHistory,
            stats: newStats,
          }),
        });
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      alert("Failed to submit answer. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const revealNextHint = () => {
    if (currentQuestion && currentHintIndex < currentQuestion.hints.length) {
      setShowHint(true);
      setCurrentHintIndex(prev => prev + 1);
    }
  };

  const getEvaluationColor = (quality?: VivaEvaluation["quality"]): EvaluationColors => {
    if (quality === "GOOD") {
      return {
        bg: "var(--success-50)",
        border: "var(--success-500)",
        text: "var(--success-700)",
      };
    }
    if (quality === "AVERAGE") {
      return {
        bg: "var(--orange-50)",
        border: "var(--orange-500)",
        text: "var(--orange-700)",
      };
    }
    if (quality === "POOR") {
      return {
        bg: "var(--error-50)",
        border: "var(--error-500)",
        text: "var(--error-700)",
      };
    }
    return {
      bg: "var(--gray-50)",
      border: "var(--gray-300)",
      text: "var(--gray-700)",
    };
  };

  const getQuestionTypeIcon = (type?: string) => {
    switch (type) {
      case "BASE": return "📚";
      case "FOLLOWUP": return "🔗";
      case "TRAP": return "🎯";
      case "SCENARIO": return "💼";
      case "CLARIFICATION": return "❓";
      default: return "💬";
    }
  };

  if (step === "setup") {
    return (
      <div className="viva-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="viva-setup"
        >
          <h2 className="text-3xl font-bold text-center mb-2">
            🎓 AI Quiz + Follow-up Chain
          </h2>
          <p className="text-center text-gray-600 mb-8">
            Adaptive questioning system that adjusts based on your answers
          </p>

          {/* Subject Selection */}
          <div className="setup-section">
            <h3 className="setup-label">Select Subject</h3>
            <div className="subjects-grid-small">
              {SUBJECTS.map((subject) => (
                <motion.button
                  key={subject.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedSubject(subject.id)}
                  className={`subject-card-small ${
                    selectedSubject === subject.id ? "selected" : ""
                  }`}
                  style={{ borderColor: subject.color }}
                >
                  <span className="text-3xl">{subject.icon}</span>
                  <span className="text-sm font-semibold">{subject.id}</span>
                </motion.button>
              ))}
            </div>
          </div>

          {selectedSubject && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="setup-section"
            >
              <h3 className="setup-label">Base Topic</h3>
              <input
                type="text"
                value={baseTopic}
                onChange={(e) => setBaseTopic(e.target.value)}
                placeholder="e.g., Deadlock, Normalization, Polymorphism..."
                className="setup-input"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && baseTopic.trim()) {
                    startVivaSession();
                  }
                }}
              />
              <p className="text-sm text-gray-500 mt-2">
                💡 The AI will start with fundamentals and adapt based on your answers
              </p>
            </motion.div>
          )}

          {selectedSubject && baseTopic.trim() && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={startVivaSession}
              disabled={isLoading}
              className="generate-btn"
            >
              {isLoading ? "Starting Viva... ⏳" : "Start Adaptive Viva 🚀"}
            </motion.button>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="viva-container">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="viva-session"
      >
        {/* Header with Stats */}
        <div className="viva-header">
          <div className="viva-title">
            <span className="text-3xl">{SUBJECTS.find(s => s.id === selectedSubject)?.icon}</span>
            <div>
              <h3 className="font-semibold text-xl">{selectedSubject} - {baseTopic}</h3>
              <p className="text-sm text-gray-600">Adaptive AI Quiz Session</p>
            </div>
          </div>
          <div className="viva-stats-compact">
            <div className="stat-compact">
              <span className="stat-label">Q{stats.questionsAsked}</span>
            </div>
            <div className="stat-compact">
              <span className="stat-label">Diff: {stats.currentDifficulty}/10</span>
            </div>
            <div className="stat-compact good">
              <span>✓ {stats.goodAnswers}</span>
            </div>
            <div className="stat-compact average">
              <span>~ {stats.averageAnswers}</span>
            </div>
            <div className="stat-compact poor">
              <span>✗ {stats.poorAnswers}</span>
            </div>
          </div>
        </div>

        {/* Conversation Thread */}
        <div className="viva-conversation">
          {conversationHistory.map((message, index) => {
            const isUser = message.role === "user";
            const colors = getEvaluationColor(message.evaluation?.quality);

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`viva-message ${isUser ? "user" : "assistant"}`}
              >
                {!isUser && currentQuestion && index === conversationHistory.length - 1 && (
                  <>
                    <div className="question-meta">
                      <span className="question-type-badge">
                        {getQuestionTypeIcon(currentQuestion.questionType)} {currentQuestion.questionType}
                      </span>
                      <span className="difficulty-indicator">
                        Level: {currentQuestion.difficulty}/10
                      </span>
                    </div>
                    <WhyThisQuestionCard
                      metadata={currentQuestion.mistakePriority}
                      moduleLabel="Viva adaptive"
                      topic={baseTopic || selectedSubject}
                      difficulty={`${currentQuestion.difficulty}/10`}
                      className="mb-2"
                    />
                  </>
                )}
                
                <div 
                  className="message-bubble"
                  style={isUser ? { backgroundColor: colors.bg, borderColor: colors.border } : {}}
                >
                  {message.content}
                </div>

                {isUser && message.evaluation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="evaluation-card"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                  >
                    <div className="evaluation-header">
                      <span 
                        className="evaluation-quality"
                        style={{ color: colors.text }}
                      >
                        {message.evaluation.quality === "GOOD" && "✅ Great Answer!"}
                        {message.evaluation.quality === "AVERAGE" && "🔶 Decent, but..."}
                        {message.evaluation.quality === "POOR" && "❌ Needs Work"}
                      </span>
                      <span className="evaluation-score">{message.evaluation.score}/10</span>
                    </div>
                    <p className="evaluation-reasoning">{message.evaluation.reasoning}</p>
                    {message.evaluation.keyIssues.length > 0 && (
                      <div className="key-issues">
                        <strong>Key Issues:</strong>
                        <ul>
                          {message.evaluation.keyIssues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })}

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="viva-message assistant"
            >
              <div className="message-bubble loading">
                <span className="loading-dots">Analyzing & generating next question</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Answer Input Area */}
        <div className="viva-input-area">
          {currentQuestion && showHint && currentHintIndex > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="hint-display"
            >
              <span className="hint-icon">💡</span>
              <p>{currentQuestion.hints[currentHintIndex - 1]}</p>
            </motion.div>
          )}

          <div className="input-with-actions">
            {currentQuestion ? (
              <div className="mcq-card">
                <p className="mcq-title">Select the best answer:</p>
                <div className="mcq-options-grid">
                  {currentQuestion.mcqOptions.map((option, index) => {
                    const isSelected = selectedOptionIndex === index;
                    const label = String.fromCharCode(65 + index);

                    return (
                      <button
                        key={`${currentQuestion.nextQuestion}-${label}`}
                        type="button"
                        onClick={() => setSelectedOptionIndex(index)}
                        className={`mcq-option ${isSelected ? "selected" : ""}`}
                        disabled={isLoading}
                        aria-pressed={isSelected}
                      >
                        <span className="mcq-option-letter">{label}</span>
                        <span className="mcq-option-text">{option}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="input-actions">
              {currentQuestion && currentHintIndex < currentQuestion.hints.length && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={revealNextHint}
                  className="hint-btn"
                >
                  💡 Hint ({currentHintIndex}/{currentQuestion.hints.length})
                </motion.button>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={submitAnswer}
                disabled={isLoading || selectedOptionIndex === null}
                className="submit-answer-btn"
              >
                {isLoading ? "⏳" : "Submit →"}
              </motion.button>
            </div>
          </div>

          {currentQuestion && (
            <div className="expected-keywords">
              <strong>Concept focus:</strong>
              {currentQuestion.expectedAnswerKeywords.slice(0, 3).map((keyword, idx) => (
                <span key={idx} className="keyword-tag">{keyword}</span>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="viva-actions">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (confirm("Are you sure? Your progress will be saved.")) {
                router.push("/");
              }
            }}
            className="btn-secondary"
          >
            End Session
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default AIVivaChain;
