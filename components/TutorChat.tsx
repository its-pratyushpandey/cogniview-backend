"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "@/firebase/client";
import { useAdaptiveEngine } from "@/features/intelligence/hooks/useAdaptiveEngine";
import { useAnswerScoring } from "@/features/intelligence/hooks/useAnswerScoring";
import { AnswerScorePanel } from "@/components/answer-scoring";

const SUBJECTS = [
  { id: "OS", name: "Operating Systems", icon: "💻", color: "#3b82f6" },
  { id: "DBMS", name: "Database Management", icon: "🗄️", color: "#8b5cf6" },
  { id: "OOPS", name: "Object Oriented Programming", icon: "🎯", color: "#10b981" },
  { id: "CN", name: "Computer Networks", icon: "🌐", color: "#f59e0b" },
  { id: "DSA", name: "Data Structures & Algorithms", icon: "🧮", color: "#ef4444" },
];

const TutorChat = ({
  userId,
  userName,
  initialSubject,
  initialTopic,
}: {
  userId: string;
  userName: string;
  initialSubject?: string;
  initialTopic?: string;
}) => {
  const router = useRouter();
  const [selectedSubject, setSelectedSubject] = useState(initialSubject || "");
  const [topic, setTopic] = useState(initialTopic || "");
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [weakConcepts, setWeakConcepts] = useState<string[]>([]);
  const [masteredConcepts, setMasteredConcepts] = useState<string[]>([]);
  const [difficultyLevel, setDifficultyLevel] = useState(5);
  const [showSubjectSelector, setShowSubjectSelector] = useState(!initialSubject);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageStartRef = useRef<number | null>(null);

  const { trackLearning, markTopicProgress, setDifficultyPreference } = useAdaptiveEngine("tutor");
  const {
    result: answerScoreResult,
    isLoading: isAnswerScoring,
    isOptimistic: isAnswerScoringOptimistic,
    error: answerScoringError,
    evaluateAnswer,
    resetScore,
  } = useAnswerScoring({ debounceMs: 500 });

  const latestAssistantPrompt =
    [...messages].reverse().find((entry) => entry.role === "assistant")?.content ||
    `Tutor checkpoint for ${selectedSubject || "subject"} ${topic ? `- ${topic}` : ""}`;

  const latestUserAnswer =
    [...messages].reverse().find((entry) => entry.role === "user")?.content || "";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initializeSession = useCallback(async () => {
    try {
      const sessionRef = await addDoc(collection(db, "tutorSessions"), {
        userId,
        subject: selectedSubject,
        topic,
        conversationHistory: [],
        conceptsMastered: [],
        conceptsWeak: [],
        currentDifficulty: 5,
        adaptiveLevel: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setSessionId(sessionRef.id);
      void setDifficultyPreference("medium");

      // Send welcome message
      const welcomeMessage: TutorMessage = {
        role: "assistant",
        content: `Hello ${userName}! 👋 I'm your AI Tutor for ${selectedSubject}. Let's master ${topic} together! I'll adapt my teaching based on your performance. Ready to start? Ask me anything about ${topic}, or I can give you an overview first.`,
        timestamp: new Date().toISOString(),
      };
      setMessages([welcomeMessage]);
      resetScore();
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err?.code === "permission-denied") {
        console.warn("Firebase permissions not configured. Session not saved to database.");
        setSessionId(`local_${Date.now()}`);
        void setDifficultyPreference("medium");
        // Still allow the UI to function
        const welcomeMessage: TutorMessage = {
          role: "assistant",
          content: `Hello ${userName}! 👋 I'm your AI Tutor for ${selectedSubject}. Let's master ${topic} together! I'll adapt my teaching based on your performance. Ready to start? Ask me anything about ${topic}, or I can give you an overview first.`,
          timestamp: new Date().toISOString(),
        };
        setMessages([welcomeMessage]);
        resetScore();
      } else {
        console.error("Error initializing session:", error);
      }
    }
  }, [resetScore, selectedSubject, setDifficultyPreference, topic, userId, userName]);

  useEffect(() => {
    if (selectedSubject && topic && !sessionId) {
      void initializeSession();
    }
  }, [initializeSession, selectedSubject, sessionId, topic]);

  const handleSubjectSelect = (subjectId: string) => {
    setSelectedSubject(subjectId);
    setShowSubjectSelector(false);
  };

  const handleTopicSubmit = () => {
    if (topic.trim()) {
      setShowSubjectSelector(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !sessionId) return;

    const userMessage: TutorMessage = {
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    messageStartRef.current = Date.now();

    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          subject: selectedSubject,
          topic,
          message: input,
          sessionId,
          weakConcepts,
          masteredConcepts,
          difficultyLevel,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const aiMessage: TutorMessage = {
          role: "assistant",
          content: data.response,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMessage]);

        const responseLower = data.response.toLowerCase();
        let score = 68;

        if (/(great|excellent|correct|well done|perfect)/.test(responseLower)) {
          score = 86;
        } else if (/(good|nice|solid)/.test(responseLower)) {
          score = 74;
        } else if (/(not quite|incorrect|mistake|revise|wrong|revisit)/.test(responseLower)) {
          score = 44;
        }

        const responseTimeMs = messageStartRef.current
          ? Math.max(0, Date.now() - messageStartRef.current)
          : Math.max(1400, input.length * 120);

        const nextDifficulty =
          score >= 80 ? Math.min(10, difficultyLevel + 1) : score <= 45 ? Math.max(1, difficultyLevel - 1) : difficultyLevel;
        setDifficultyLevel(nextDifficulty);

        const difficultyPreference = nextDifficulty <= 4 ? "easy" : nextDifficulty <= 7 ? "medium" : "hard";

        await Promise.all([
          markTopicProgress({
            subject: selectedSubject,
            topicName: topic,
            score,
            responseTimeMs,
            retries: 0,
          }),
          trackLearning({
            topicName: topic,
            score,
            responseTimeMs,
            retries: 0,
            confidence: score,
            difficultyPreference,
          }),
          setDifficultyPreference(difficultyPreference),
        ]);

        if (score >= 78) {
          setMasteredConcepts((prev) => (prev.includes(topic) ? prev : [...prev, topic]));
          setWeakConcepts((prev) => prev.filter((entry) => entry !== topic));
        } else if (score <= 45) {
          setWeakConcepts((prev) => (prev.includes(topic) ? prev : [...prev, topic]));
        }

        // Update Firestore
        if (!sessionId.startsWith("local_")) {
          try {
            const sessionRef = doc(db, "tutorSessions", sessionId);
            await updateDoc(sessionRef, {
              conversationHistory: [...messages, userMessage, aiMessage],
              currentDifficulty: nextDifficulty,
              updatedAt: new Date().toISOString(),
            });
          } catch (updateError) {
            console.warn("Failed to update tutor session document", updateError);
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: TutorMessage = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEvaluateAnswer = () => {
    const candidateAnswer = input.trim() || latestUserAnswer.trim();
    if (!candidateAnswer) {
      return;
    }

    evaluateAnswer(
      {
        question: latestAssistantPrompt,
        userAnswer: candidateAnswer,
      },
      { immediate: true }
    );
  };

  if (showSubjectSelector) {
    return (
      <div className="tutor-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="subject-selector"
        >
          <h2 className="text-3xl font-bold text-center mb-2">
            🎓 Choose Your Subject
          </h2>
          <p className="text-center text-muted-foreground mb-8">
            Select a subject to start your personalized learning journey
          </p>

          <div className="subjects-grid">
            {SUBJECTS.map((subject, index) => (
              <motion.button
                key={subject.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSubjectSelect(subject.id)}
                className="subject-card"
                style={{ borderColor: subject.color }}
              >
                <span className="text-5xl mb-3">{subject.icon}</span>
                <h3 className="font-semibold text-lg mb-1">{subject.name}</h3>
                <span
                  className="subject-tag"
                  style={{ backgroundColor: `${subject.color}20`, color: subject.color }}
                >
                  {subject.id}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (selectedSubject && !topic) {
    return (
      <div className="tutor-container">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="topic-selector"
        >
          <button
            onClick={() => {
              setSelectedSubject("");
              setShowSubjectSelector(true);
            }}
            className="back-button"
          >
            ← Back to Subjects
          </button>

          <div className="text-center mb-8">
            <span className="text-6xl mb-4 inline-block">
              {SUBJECTS.find((s) => s.id === selectedSubject)?.icon}
            </span>
            <h2 className="text-3xl font-bold mb-2">
              {SUBJECTS.find((s) => s.id === selectedSubject)?.name}
            </h2>
            <p className="text-gray-600">What topic would you like to learn?</p>
          </div>

          <div className="topic-input-container">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleTopicSubmit()}
              placeholder="e.g., Process Synchronization, Normalization, Inheritance..."
              className="topic-input"
              autoFocus
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleTopicSubmit}
              disabled={!topic.trim()}
              className="topic-submit-btn"
            >
              Start Learning 🚀
            </motion.button>
          </div>

          <div className="popular-topics">
            <p className="text-sm text-gray-500 mb-3">Popular topics:</p>
            <div className="flex flex-wrap gap-2">
              {selectedSubject === "OS" && (
                <>
                  <button onClick={() => setTopic("Process Synchronization")} className="topic-chip">Deadlock</button>
                  <button onClick={() => setTopic("Scheduling Algorithms")} className="topic-chip">Scheduling</button>
                  <button onClick={() => setTopic("Memory Management")} className="topic-chip">Memory</button>
                </>
              )}
              {selectedSubject === "DBMS" && (
                <>
                  <button onClick={() => setTopic("Normalization")} className="topic-chip">Normalization</button>
                  <button onClick={() => setTopic("Transactions")} className="topic-chip">Transactions</button>
                  <button onClick={() => setTopic("Indexing")} className="topic-chip">Indexing</button>
                </>
              )}
              {selectedSubject === "OOPS" && (
                <>
                  <button onClick={() => setTopic("Inheritance")} className="topic-chip">Inheritance</button>
                  <button onClick={() => setTopic("Polymorphism")} className="topic-chip">Polymorphism</button>
                  <button onClick={() => setTopic("Abstraction")} className="topic-chip">Abstraction</button>
                </>
              )}
              {selectedSubject === "CN" && (
                <>
                  <button onClick={() => setTopic("TCP/IP Model")} className="topic-chip">TCP/IP</button>
                  <button onClick={() => setTopic("Routing Algorithms")} className="topic-chip">Routing</button>
                  <button onClick={() => setTopic("Network Security")} className="topic-chip">Security</button>
                </>
              )}
              {selectedSubject === "DSA" && (
                <>
                  <button onClick={() => setTopic("Binary Trees")} className="topic-chip">Trees</button>
                  <button onClick={() => setTopic("Dynamic Programming")} className="topic-chip">DP</button>
                  <button onClick={() => setTopic("Graph Algorithms")} className="topic-chip">Graphs</button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="tutor-container flex flex-col h-full bg-background p-4 sm:p-6 lg:p-8">
      <div className="tutor-chat flex flex-col h-full bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="tutor-header"
        >
          <button onClick={() => router.push("/")} className="back-button-small">
            ← Back
          </button>
          <div className="tutor-info">
            <span className="text-3xl">
              {SUBJECTS.find((s) => s.id === selectedSubject)?.icon}
            </span>
            <div>
              <h3 className="font-bold text-lg">{selectedSubject}</h3>
              <p className="text-sm text-gray-600">{topic}</p>
            </div>
          </div>
          <div className="difficulty-badge">
            Level {difficultyLevel}/10
          </div>
        </motion.div>

        {/* Messages */}
        <div className="tutor-messages">
          <AnimatePresence>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`message ${message.role}`}
              >
                {message.role === "assistant" && (
                  <Image
                    src="/ai.png"
                    alt="AI"
                    width={32}
                    height={32}
                    className="message-avatar"
                  />
                )}
                <div className="message-content">
                  {message.content}
                </div>
                {message.role === "user" && (
                  <Image
                    src="/user.png"
                    alt="You"
                    width={32}
                    height={32}
                    className="message-avatar"
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="message assistant"
            >
              <Image src="/ai.png" alt="AI" width={32} height={32} className="message-avatar" />
              <div className="message-content typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="tutor-input-container"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question or request an explanation..."
            className="tutor-input"
            disabled={isLoading}
          />
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleEvaluateAnswer}
            disabled={(!input.trim() && !latestUserAnswer.trim()) || isAnswerScoring}
            className="rounded-xl border border-border/80 bg-secondary/70 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
            title="Evaluate your latest answer"
          >
            {isAnswerScoring ? "Scoring..." : "Evaluate Answer"}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="send-button"
          >
            {isLoading ? "⏳" : "📤"}
          </motion.button>
        </motion.div>

        <AnswerScorePanel
          result={answerScoreResult}
          isLoading={isAnswerScoring}
          isOptimistic={isAnswerScoringOptimistic}
          error={answerScoringError}
          title="Tutor Answer Evaluation"
          description="Evaluate your latest tutor response for interview readiness."
          onEvaluate={handleEvaluateAnswer}
          evaluateLabel="Evaluate again"
        />

        {/* Stats Footer */}
        <div className="tutor-stats">
          <div className="stat">
            <span className="stat-label">Mastered:</span>
            <span className="stat-value">{masteredConcepts.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Weak:</span>
            <span className="stat-value">{weakConcepts.length}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Messages:</span>
            <span className="stat-value">{messages.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorChat;
