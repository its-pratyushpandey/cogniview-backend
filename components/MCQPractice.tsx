"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/firebase/client";
import { useAdaptiveEngine } from "@/features/intelligence/hooks/useAdaptiveEngine";
import { useCompanyContext } from "@/features/intelligence/hooks/useCompanyContext";
import { useStreamingCoach } from "@/features/intelligence/hooks/useStreamingCoach";
import { useAnswerScoring } from "@/features/intelligence/hooks/useAnswerScoring";
import { WhyThisQuestionCard } from "@/features/intelligence/components/WhyThisQuestionCard";
import { AnswerScorePanel } from "@/components/answer-scoring";

const SUBJECTS = [
  { id: "OS", name: "Operating Systems", icon: "💻" },
  { id: "DBMS", name: "Database Management", icon: "🗄️" },
  { id: "OOPS", name: "Object Oriented Programming", icon: "🎯" },
  { id: "CN", name: "Computer Networks", icon: "🌐" },
  { id: "DSA", name: "Data Structures & Algorithms", icon: "🧮" },
];

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced", "Tricky"];
const COMPANY_TYPES = ["Service-based", "Product-based", "Startup"];
const FOCUS_TYPES = ["Conceptual", "Tricky", "GATE-style", "Company-specific"];

type MCQDifficulty = (typeof DIFFICULTIES)[number];
type MCQCompanyType = (typeof COMPANY_TYPES)[number];
type MCQFocusType = (typeof FOCUS_TYPES)[number];

interface MCQInitialConfig {
  source?: string;
  roleLabel?: string;
  subject?: string;
  topic?: string;
  count?: number;
  difficulty?: string;
  companyType?: string;
  focus?: string;
  autostart?: boolean;
}

function toAllowedOrFallback<T extends string>(input: string | undefined, allowed: readonly T[], fallback: T): T {
  if (!input) {
    return fallback;
  }

  const normalized = input.trim().toLowerCase();
  const matched = allowed.find((value) => value.toLowerCase() === normalized);
  return matched ?? fallback;
}

function toAllowedCount(value: number | undefined): number {
  if (value === 10 || value === 15 || value === 20) {
    return value;
  }

  return 5;
}

function toDifficultyPreference(value: string): "easy" | "medium" | "hard" | "adaptive" {
  if (value === "Beginner") return "easy";
  if (value === "Intermediate") return "medium";
  if (value === "Advanced" || value === "Tricky") return "hard";
  return "adaptive";
}

function getAdjustedDifficulty(current: string, direction: 1 | -1): string {
  const order = ["Beginner", "Intermediate", "Advanced", "Tricky"];
  const index = order.indexOf(current);
  if (index < 0) return current;
  const nextIndex = Math.max(0, Math.min(order.length - 1, index + direction));
  return order[nextIndex];
}

const MCQPractice = ({
  userId,
  initialConfig,
}: {
  userId: string;
  userName: string;
  initialConfig?: MCQInitialConfig;
}) => {
  const router = useRouter();
  const [step, setStep] = useState<"setup" | "practice" | "results">("setup");
  const [selectedSubject, setSelectedSubject] = useState(() =>
    toAllowedOrFallback(initialConfig?.subject, SUBJECTS.map((subject) => subject.id), "")
  );
  const [topic, setTopic] = useState(() => initialConfig?.topic?.trim() ?? "");
  const [count, setCount] = useState(() => toAllowedCount(initialConfig?.count));
  const [difficulty, setDifficulty] = useState<MCQDifficulty>(() =>
    toAllowedOrFallback(initialConfig?.difficulty, DIFFICULTIES, "Intermediate")
  );
  const [companyType, setCompanyType] = useState<MCQCompanyType>(() =>
    toAllowedOrFallback(initialConfig?.companyType, COMPANY_TYPES, "Product-based")
  );
  const [focus, setFocus] = useState<MCQFocusType>(() =>
    toAllowedOrFallback(initialConfig?.focus, FOCUS_TYPES, "Conceptual")
  );
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [responseTimesMs, setResponseTimesMs] = useState<number[]>([]);
  const [latestMicroSummary, setLatestMicroSummary] = useState("");
  const [resumePresetApplied, setResumePresetApplied] = useState(Boolean(initialConfig?.source === "resume"));
  const sessionSummaryRequestedRef = useRef(false);
  const sessionScoreRequestedRef = useRef(false);
  const autoStartRef = useRef(Boolean(initialConfig?.autostart));
  const [latestEvaluationPayload, setLatestEvaluationPayload] = useState<{
    question: string;
    userAnswer: string;
  } | null>(null);

  const { trackLearning, markTopicProgress, setDifficultyPreference } = useAdaptiveEngine("mcq");
  const { setCompanyPreference } = useCompanyContext();
  const liveCoach = useStreamingCoach();
  const {
    result: answerScoreResult,
    isLoading: isAnswerScoring,
    isOptimistic: isAnswerScoringOptimistic,
    error: answerScoringError,
    evaluateAnswer,
    resetScore,
  } = useAnswerScoring({ debounceMs: 420 });

  const buildSessionSummaryPayload = useCallback(() => {
    if (questions.length === 0) {
      return null;
    }

    const correctAnswers = questions.reduce(
      (acc, question) => (userAnswers[question.id] === question.correctAnswer ? acc + 1 : acc + 0),
      0
    );
    const score = Math.round((correctAnswers / questions.length) * 100);

    return {
      question: `MCQ Session Summary: ${selectedSubject || "Subject"} ${topic ? `- ${topic}` : ""}`,
      userAnswer: `I solved ${correctAnswers} out of ${questions.length} questions correctly. Final score: ${score}%. Difficulty: ${difficulty}. Focus: ${focus}. Total time: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s.`,
    };
  }, [difficulty, focus, questions, selectedSubject, topic, totalTime, userAnswers]);

  const evaluateSessionSummary = useCallback(
    (immediate = false) => {
      const payload = buildSessionSummaryPayload();
      if (!payload) {
        return;
      }

      setLatestEvaluationPayload(payload);
      evaluateAnswer(payload, { immediate });
    },
    [buildSessionSummaryPayload, evaluateAnswer]
  );

  useEffect(() => {
    const preference = toDifficultyPreference(difficulty);
    void setDifficultyPreference(preference);
    void setCompanyPreference({
      companyType,
      targetCompanies: [companyType],
      difficultyPreference: preference,
    });
  }, [companyType, difficulty, setCompanyPreference, setDifficultyPreference]);

  useEffect(() => {
    if (step === "practice" && !showExplanation && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, showExplanation, timeLeft]);

  const generateMCQs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/mcq/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          subject: selectedSubject,
          topic,
          count,
          difficulty,
          companyType,
          focus,
        }),
      });

      const data = await response.json();
      if (data.success && data.mcqs.length > 0) {
        setQuestions(data.mcqs);
        setStep("practice");
        setTimeLeft(120); // 2 minutes per question
        setTotalTime(0);
        setCorrectStreak(0);
        setResponseTimesMs([]);
        setLatestMicroSummary("");
        liveCoach.reset();
        sessionSummaryRequestedRef.current = false;
        sessionScoreRequestedRef.current = false;
        setLatestEvaluationPayload(null);
        resetScore();
        setResumePresetApplied(false);
      }
    } catch (error) {
      console.error("Error generating MCQs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [companyType, count, difficulty, focus, liveCoach, resetScore, selectedSubject, topic, userId]);

  useEffect(() => {
    if (!autoStartRef.current || step !== "setup" || isLoading) {
      return;
    }

    if (!selectedSubject || !topic.trim()) {
      return;
    }

    autoStartRef.current = false;
    void generateMCQs();
  }, [generateMCQs, isLoading, selectedSubject, step, topic]);

  const handleAnswerSelect = (answerIndex: number) => {
    if (showExplanation) return;
    
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrectAnswer = answerIndex === currentQuestion.correctAnswer;
    const responseTimeMs = Math.max(1000, (120 - timeLeft) * 1000);
    const answerScore = isCorrectAnswer ? 100 : 32;
    const answeredBefore = Object.keys(userAnswers).length;
    const correctBefore = questions.reduce(
      (acc, question) => (userAnswers[question.id] === question.correctAnswer ? acc + 1 : acc + 0),
      0
    );
    const nextAnswered = answeredBefore + 1;
    const nextCorrect = correctBefore + (isCorrectAnswer ? 1 : 0);
    const nextAccuracy = Math.round((nextCorrect / nextAnswered) * 100);
    const avgResponseMs = Math.round(
      (responseTimesMs.reduce((sum, value) => sum + value, 0) + responseTimeMs) /
        Math.max(1, responseTimesMs.length + 1)
    );

    setResponseTimesMs((prev) => [...prev, responseTimeMs]);
    setLatestMicroSummary(
      `${isCorrectAnswer ? "Correct" : "Incorrect"} • Accuracy ${nextAccuracy}% • ${Math.round(responseTimeMs / 1000)}s response`
    );

    void markTopicProgress({
      subject: selectedSubject,
      topicName: currentQuestion.conceptTags[0] || topic || selectedSubject,
      score: answerScore,
      responseTimeMs,
      retries: 0,
    });

    void trackLearning({
      topicName: currentQuestion.conceptTags[0] || topic || selectedSubject,
      score: answerScore,
      responseTimeMs,
      retries: 0,
      confidence: isCorrectAnswer ? 84 : 38,
      difficultyPreference: toDifficultyPreference(difficulty),
    });

    if (isCorrectAnswer) {
      const nextStreak = correctStreak + 1;
      setCorrectStreak(nextStreak);
      if (nextStreak >= 2) {
        setDifficulty((prev) => getAdjustedDifficulty(prev, 1));
      }
    } else {
      setCorrectStreak(0);
      setDifficulty((prev) => getAdjustedDifficulty(prev, -1));
    }

    void liveCoach.streamFeedback({
      userId,
      module: "mcq",
      event: "question_answered",
      metrics: {
        topic: currentQuestion.conceptTags[0] || topic || selectedSubject,
        score: answerScore,
        accuracy: nextAccuracy,
        responseTimeMs,
        retries: 0,
        difficulty,
        companyType,
        targetRole: selectedSubject,
        focus,
        question: currentQuestion.question,
        averageResponseTimeMs: avgResponseMs,
      },
      history: questions
        .slice(Math.max(0, currentQuestionIndex - 2), currentQuestionIndex + 1)
        .map((question) => question.conceptTags[0] || question.question),
    });

    const selectedOption = currentQuestion.options[answerIndex] || "";
    const evaluationPayload = {
      question: currentQuestion.question,
      userAnswer: `Selected option: ${selectedOption}`,
    };

    setLatestEvaluationPayload(evaluationPayload);
    evaluateAnswer(evaluationPayload);

    setUserAnswers({
      ...userAnswers,
      [currentQuestion.id]: answerIndex,
    });
    setShowExplanation(true);
    setTotalTime((prev) => prev + (120 - timeLeft));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setShowExplanation(false);
      setTimeLeft(120);
      setLatestEvaluationPayload(null);
      resetScore();
    } else {
      setStep("results");
      saveResults();
    }
  };

  const saveResults = async () => {
    const finalScore = calculateScore();
    const correctAnswers = questions.reduce(
      (acc, question) => (userAnswers[question.id] === question.correctAnswer ? acc + 1 : acc + 0),
      0
    );

    try {
      await addDoc(collection(db, "mcqSessions"), {
        userId,
        subject: selectedSubject,
        topic,
        difficulty,
        companyType,
        focus,
        questions: questions.map((q) => q.id),
        userAnswers,
        score: calculateScore(),
        totalTime,
        createdAt: new Date().toISOString(),
      });

      void markTopicProgress({
        subject: selectedSubject,
        topicName: topic || selectedSubject,
        score: finalScore,
        responseTimeMs: totalTime * 1000,
        retries: Math.max(0, questions.length - correctAnswers),
      });

      void trackLearning({
        topicName: topic || selectedSubject,
        score: finalScore,
        responseTimeMs: totalTime * 1000,
        retries: Math.max(0, questions.length - correctAnswers),
        confidence: finalScore,
        difficultyPreference: toDifficultyPreference(difficulty),
      });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };

      if (err?.code === "permission-denied") {
        console.warn("Firebase permissions not configured. Session not saved.");
      } else {
        console.error("Error saving results:", error);
      }
    }
  };

  const calculateScore = () => {
    if (questions.length === 0) return 0;
    let correct = 0;
    questions.forEach((q) => {
      if (userAnswers[q.id] === q.correctAnswer) correct++;
    });
    return (correct / questions.length) * 100;
  };

  const answeredCount = Object.keys(userAnswers).length;
  const correctAnswersLive = useMemo(
    () =>
      questions.reduce(
        (acc, question) => (userAnswers[question.id] === question.correctAnswer ? acc + 1 : acc + 0),
        0
      ),
    [questions, userAnswers]
  );
  const liveAccuracy = answeredCount > 0 ? Math.round((correctAnswersLive / answeredCount) * 100) : 0;
  const avgResponseSeconds =
    responseTimesMs.length > 0
      ? Math.round(responseTimesMs.reduce((sum, value) => sum + value, 0) / responseTimesMs.length / 1000)
      : 0;

  useEffect(() => {
    if (step !== "results" || questions.length === 0 || sessionSummaryRequestedRef.current) {
      return;
    }

    sessionSummaryRequestedRef.current = true;

    const correctAnswers = questions.reduce(
      (acc, question) => (userAnswers[question.id] === question.correctAnswer ? acc + 1 : acc + 0),
      0
    );
    const finalAccuracy = Math.round((correctAnswers / questions.length) * 100);

    void liveCoach.streamFeedback({
      userId,
      module: "mcq",
      event: "session_summary",
      metrics: {
        topic: topic || selectedSubject,
        score: finalAccuracy,
        accuracy: finalAccuracy,
        responseTimeMs: totalTime * 1000,
        retries: Math.max(0, questions.length - correctAnswers),
        difficulty,
        companyType,
        targetRole: selectedSubject,
        focus,
      },
      history: questions.slice(0, 6).map((question) => question.conceptTags[0] || question.question),
    });
  }, [
    companyType,
    difficulty,
    focus,
    liveCoach,
    questions,
    selectedSubject,
    step,
    topic,
    totalTime,
    userAnswers,
    userId,
  ]);

  useEffect(() => {
    if (step !== "results" || questions.length === 0 || sessionScoreRequestedRef.current) {
      return;
    }

    sessionScoreRequestedRef.current = true;
    evaluateSessionSummary(true);
  }, [evaluateSessionSummary, questions.length, step]);

  const currentQuestion = questions[currentQuestionIndex];
  const userAnswer = userAnswers[currentQuestion?.id];
  const isCorrect = userAnswer === currentQuestion?.correctAnswer;

  if (step === "setup") {
    return (
      <div className="mcq-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mcq-setup"
        >
          <h2 className="text-3xl font-bold text-center mb-2">
            📝 MCQ Practice Generator
          </h2>
          <p className="mb-8 text-center text-muted-foreground">
            Generate placement-level MCQs tailored to your needs
          </p>

          {resumePresetApplied ? (
            <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary-foreground">
              Resume preset applied{initialConfig?.roleLabel ? ` for ${initialConfig.roleLabel}` : ""}. You can edit these
              values before starting the test.
            </div>
          ) : null}

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
              <h3 className="setup-label">Topic</h3>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Deadlock, Normalization, Trees..."
                className="setup-input"
              />
            </motion.div>
          )}

          {topic && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="grid grid-cols-2 gap-4"
            >
              <div className="setup-section">
                <h3 className="setup-label">Number of Questions</h3>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="setup-select"
                >
                  {[5, 10, 15, 20].map((num) => (
                    <option key={num} value={num}>
                      {num} Questions
                    </option>
                  ))}
                </select>
              </div>

              <div className="setup-section">
                <h3 className="setup-label">Difficulty</h3>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="setup-select"
                >
                  {DIFFICULTIES.map((diff) => (
                    <option key={diff} value={diff}>
                      {diff}
                    </option>
                  ))}
                </select>
              </div>

              <div className="setup-section">
                <h3 className="setup-label">Company Type</h3>
                <select
                  value={companyType}
                  onChange={(e) => setCompanyType(e.target.value)}
                  className="setup-select"
                >
                  {COMPANY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="setup-section">
                <h3 className="setup-label">Focus</h3>
                <select
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  className="setup-select"
                >
                  {FOCUS_TYPES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}

          {topic && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={generateMCQs}
              disabled={isLoading}
              className="generate-btn"
            >
              {isLoading ? "Generating... ⏳" : "Generate MCQs 🚀"}
            </motion.button>
          )}
        </motion.div>
      </div>
    );
  }

  if (step === "practice" && currentQuestion) {
    return (
      <div className="mcq-container">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mcq-practice"
        >
          {/* Header */}
          <div className="mcq-header">
            <div className="mcq-progress">
              <span className="font-semibold">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <div className="progress-bar-thin">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                  }}
                  className="progress-fill-thin"
                />
              </div>
            </div>
            <div className="timer">
              <span className={timeLeft < 30 ? "text-red-500" : ""}>
                ⏱️ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
              </span>
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-primary/30 bg-card/80 p-4 text-foreground shadow-lg shadow-black/20">
            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <div className="rounded-lg border border-border/70 bg-secondary/60 px-2 py-1.5">
                <p className="text-xs text-muted-foreground">Live Accuracy</p>
                <p className="font-semibold tabular-nums">{liveAccuracy}%</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-secondary/60 px-2 py-1.5">
                <p className="text-xs text-muted-foreground">Avg Response</p>
                <p className="font-semibold tabular-nums">{avgResponseSeconds > 0 ? `${avgResponseSeconds}s` : "--"}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-secondary/60 px-2 py-1.5">
                <p className="text-xs text-muted-foreground">Correct Streak</p>
                <p className="font-semibold tabular-nums">{correctStreak}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-secondary/60 px-2 py-1.5">
                <p className="text-xs text-muted-foreground">Adaptive Difficulty</p>
                <p className="font-semibold">{difficulty}</p>
              </div>
            </div>

            {latestMicroSummary ? (
              <p className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs text-accent">
                {latestMicroSummary}
              </p>
            ) : null}

            {liveCoach.bullets.length > 0 ? (
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                {liveCoach.bullets.map((bullet, index) => (
                  <li key={`${index}-${bullet}`} className="rounded-lg border border-border/70 bg-secondary/55 px-2 py-1.5">
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}

            {liveCoach.isStreaming ? (
              <p className="mt-2 text-xs text-primary/80">Updating live coaching cues...</p>
            ) : null}

            {liveCoach.error ? (
              <p className="mt-2 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs text-danger">
                {liveCoach.error}
              </p>
            ) : null}
          </div>

          {/* Question */}
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="question-card"
          >
            <div className="question-header">
              <span className="difficulty-badge">
                {currentQuestion.difficulty}
              </span>
              <div className="concept-tags">
                {currentQuestion.conceptTags.map((tag, idx) => (
                  <span key={idx} className="concept-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <h3 className="question-text">{currentQuestion.question}</h3>

            <WhyThisQuestionCard
              metadata={currentQuestion.mistakePriority}
              moduleLabel="MCQ adaptive"
              topic={currentQuestion.conceptTags[0] || topic || selectedSubject}
              difficulty={currentQuestion.difficulty}
              className="mt-3"
            />

            {/* Options */}
            <div className="options-grid">
              {currentQuestion.options.map((option, index) => {
                const isSelected = userAnswer === index;
                const isCorrectOption = index === currentQuestion.correctAnswer;
                const showCorrect = showExplanation && isCorrectOption;
                const showWrong = showExplanation && isSelected && !isCorrect;

                return (
                  <motion.button
                    key={index}
                    whileHover={!showExplanation ? { scale: 1.02 } : {}}
                    whileTap={!showExplanation ? { scale: 0.98 } : {}}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={showExplanation}
                    className={`option-btn ${
                      isSelected ? "selected" : ""
                    } ${showCorrect ? "correct" : ""} ${
                      showWrong ? "wrong" : ""
                    }`}
                  >
                    <span className="option-letter">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="option-text">{option}</span>
                    {showCorrect && <span className="ml-auto">✓</span>}
                    {showWrong && <span className="ml-auto">✗</span>}
                  </motion.button>
                );
              })}
            </div>

            {/* Explanation */}
            <AnimatePresence>
              {showExplanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`explanation-box ${isCorrect ? "correct-box" : "wrong-box"}`}
                >
                  <h4 className="explanation-title">
                    {isCorrect ? "✅ Correct!" : "❌ Incorrect"}
                  </h4>
                  <p className="explanation-text">
                    <strong>Correct Answer:</strong>{" "}
                    {currentQuestion.options[currentQuestion.correctAnswer]}
                  </p>
                  <p className="explanation-text">
                    {currentQuestion.explanation.correct}
                  </p>

                  {!isCorrect && userAnswer !== undefined && (
                    <p className="explanation-text mt-2">
                      <strong>Why your answer is wrong:</strong>{" "}
                      {currentQuestion.explanation.why_others_wrong[userAnswer]}
                    </p>
                  )}

                  <div className="interview-tip">
                    💡 <strong>Interview Tip:</strong> {currentQuestion.interviewTip}
                  </div>

                  <div className="company-tags">
                    <span className="text-sm font-semibold">Asked by:</span>
                    {currentQuestion.companyAskedBy.map((company, idx) => (
                      <span key={idx} className="company-tag">
                        {company}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {showExplanation ? (
              <AnswerScorePanel
                result={answerScoreResult}
                isLoading={isAnswerScoring}
                isOptimistic={isAnswerScoringOptimistic}
                error={answerScoringError}
                title="Submission Score Breakdown"
                description="AI quality evaluation generated right after your submission."
                onEvaluate={
                  latestEvaluationPayload
                    ? () => evaluateAnswer(latestEvaluationPayload, { immediate: true })
                    : undefined
                }
                evaluateLabel="Re-evaluate"
                className="mt-4"
              />
            ) : null}

            {/* Next Button */}
            {showExplanation && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleNext}
                className="next-btn"
              >
                {currentQuestionIndex < questions.length - 1
                  ? "Next Question →"
                  : "View Results 🎯"}
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (step === "results") {
    const score = calculateScore();
    const correctAnswers = Object.values(userAnswers).filter(
      (answer, index) => answer === questions[index].correctAnswer
    ).length;

    return (
      <div className="mcq-container">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="results-card"
        >
          <h2 className="text-3xl font-bold text-center mb-4">
            🎉 Practice Complete!
          </h2>

          <div className="score-circle">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="score-value"
            >
              {score.toFixed(0)}%
            </motion.div>
          </div>

          <div className="results-stats">
            <div className="stat-item">
              <span className="stat-label">Correct</span>
              <span className="stat-value text-accent">{correctAnswers}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Wrong</span>
              <span className="stat-value text-danger">
                {questions.length - correctAnswers}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Time</span>
              <span className="stat-value">
                {Math.floor(totalTime / 60)}m {totalTime % 60}s
              </span>
            </div>
          </div>

          {liveCoach.bullets.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-primary/30 bg-card/80 p-4 text-left text-foreground">
              <p className="mb-2 text-sm font-semibold">Adaptive Session Summary</p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {liveCoach.bullets.map((bullet, index) => (
                  <li key={`${index}-${bullet}`} className="rounded-lg border border-border/70 bg-secondary/55 px-3 py-2">
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <AnswerScorePanel
            result={answerScoreResult}
            isLoading={isAnswerScoring}
            isOptimistic={isAnswerScoringOptimistic}
            error={answerScoringError}
            title="Session Score Breakdown"
            description="Post-submission clarity, accuracy, and depth evaluation."
            onEvaluate={() => evaluateSessionSummary(true)}
            evaluateLabel="Re-evaluate session"
            className="mt-4"
          />

          <div className="results-actions">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setStep("setup");
                setCurrentQuestionIndex(0);
                setUserAnswers({});
                setQuestions([]);
                setCorrectStreak(0);
                setResponseTimesMs([]);
                setLatestMicroSummary("");
                liveCoach.reset();
                sessionSummaryRequestedRef.current = false;
                sessionScoreRequestedRef.current = false;
                setLatestEvaluationPayload(null);
                resetScore();
              }}
              className="btn-secondary"
            >
              Practice Again
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

export default MCQPractice;
