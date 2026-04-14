"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { useAdaptiveEngine } from "@/features/intelligence/hooks/useAdaptiveEngine";
import { useCompanyContext } from "@/features/intelligence/hooks/useCompanyContext";

interface RevisionSession {
  id: string;
  subject: string;
  topic: string;
  revisionType: string;
  content: string;
  createdAt: string;
}

const SUBJECTS = ["DSA", "DBMS", "OS", "OOPS", "CN", "System Design"];
const REVISION_TYPES = [
  {
    id: "5-minute-quick",
    name: "5-Minute Quick",
    icon: "⚡",
    description: "Fast review for quick recall",
    color: "#3b82f6",
  },
  {
    id: "last-day-notes",
    name: "Last Day Notes",
    icon: "📋",
    description: "Comprehensive last-minute prep",
    color: "#f59e0b",
  },
  {
    id: "one-pager",
    name: "One-Pager",
    icon: "📄",
    description: "Visual single-page summary",
    color: "#8b5cf6",
  },
  {
    id: "most-asked-questions",
    name: "Most Asked Questions",
    icon: "❓",
    description: "Top interview questions",
    color: "#10b981",
  },
];

const COMPANY_TYPES = [
  { id: "product-based", name: "Product-Based", icon: "🏢" },
  { id: "service-based", name: "Service-Based", icon: "💼" },
  { id: "startup", name: "Startup", icon: "🚀" },
];

export default function SmartRevisionMode({ userId }: { userId: string }) {
  const [selectedSubject, setSelectedSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [weakTopics, setWeakTopics] = useState<string[]>([]);
  const [weakTopicInput, setWeakTopicInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [savedRevisions, setSavedRevisions] = useState<RevisionSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { trackLearning, markTopicProgress, setDifficultyPreference } = useAdaptiveEngine("revision");
  const { setCompanyPreference } = useCompanyContext();

  const fetchRevisions = useCallback(async () => {
    try {
      const response = await fetch(`/api/revision/list?userId=${userId}`);
      const data = await response.json();
      if (data.success) {
        setSavedRevisions(data.revisions);
      }
    } catch (error) {
      console.error("Error fetching revisions:", error);
    }
  }, [userId]);

  useEffect(() => {
    // GSAP entrance animation
    if (containerRef.current) {
      gsap.from(containerRef.current.children, {
        opacity: 0,
        y: 30,
        stagger: 0.1,
        duration: 0.8,
        ease: "power3.out",
      });
    }

    // Fetch saved revisions
    void fetchRevisions();
  }, [fetchRevisions]);

  useEffect(() => {
    // Animate content when generated
    if (generatedContent && contentRef.current) {
      gsap.from(contentRef.current, {
        opacity: 0,
        scale: 0.95,
        duration: 0.5,
        ease: "back.out(1.7)",
      });
    }
  }, [generatedContent]);

  useEffect(() => {
    if (!companyType) {
      return;
    }

    void setCompanyPreference({
      companyType,
      targetCompanies: [companyType],
      difficultyPreference: "medium",
    });
    void setDifficultyPreference("medium");
  }, [companyType, setCompanyPreference, setDifficultyPreference]);

  const handleAddWeakTopic = () => {
    if (weakTopicInput.trim() && !weakTopics.includes(weakTopicInput.trim())) {
      setWeakTopics([...weakTopics, weakTopicInput.trim()]);
      setWeakTopicInput("");
    }
  };

  const handleRemoveWeakTopic = (topic: string) => {
    setWeakTopics(weakTopics.filter((t) => t !== topic));
  };

  const handleGenerate = async () => {
    if (!selectedSubject || !topic || !selectedType) {
      alert("Please fill in all required fields");
      return;
    }

    setIsGenerating(true);
    setGeneratedContent("");

    try {
      const response = await fetch("/api/revision/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          subject: selectedSubject,
          topic,
          revisionType: selectedType,
          companyType: companyType || undefined,
          weakTopics,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedContent(data.content);
        void fetchRevisions(); // Refresh the list

        const score = Math.max(40, 78 - weakTopics.length * 5);
        void markTopicProgress({
          subject: selectedSubject,
          topicName: topic,
          score,
          responseTimeMs: Math.max(1200, data.content.length * 2),
          retries: 0,
        });

        void trackLearning({
          topicName: topic,
          score,
          responseTimeMs: Math.max(1200, data.content.length * 2),
          retries: 0,
          confidence: score,
          difficultyPreference: "medium",
        });
      } else {
        alert("Failed to generate revision material");
      }
    } catch (error) {
      console.error("Error generating revision:", error);
      alert("An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div ref={containerRef} className="revision-mode-container">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="revision-header"
      >
        <h1>
          <span className="gradient-text">🧠 Smart Revision Mode</span>
        </h1>
        <p className="subtitle">
          AI-powered revision materials tailored to your needs
        </p>
      </motion.div>

      {/* Main Content */}
      <div className="revision-layout">
        {/* Left Panel - Configuration */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="revision-config-panel"
        >
          <h2>Create Revision Material</h2>

          {/* Subject Selection */}
          <div className="form-group">
            <label>Subject *</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="revision-select"
            >
              <option value="">Select Subject</option>
              {SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          {/* Topic Input */}
          <div className="form-group">
            <label>Topic *</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Binary Search Trees"
              className="revision-input"
            />
          </div>

          {/* Revision Type Selection */}
          <div className="form-group">
            <label>Revision Type *</label>
            <div className="revision-type-grid">
              {REVISION_TYPES.map((type) => (
                <motion.div
                  key={type.id}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedType(type.id)}
                  className={`revision-type-card ${
                    selectedType === type.id ? "selected" : ""
                  }`}
                  style={{
                    borderColor:
                      selectedType === type.id ? type.color : "transparent",
                  }}
                >
                  <span className="type-icon">{type.icon}</span>
                  <h4>{type.name}</h4>
                  <p>{type.description}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Company Type (Optional) */}
          {selectedType === "most-asked-questions" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="form-group"
            >
              <label>Target Company Type (Optional)</label>
              <div className="company-type-selector">
                {COMPANY_TYPES.map((company) => (
                  <motion.button
                    key={company.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      setCompanyType(
                        companyType === company.id ? "" : company.id
                      )
                    }
                    className={`company-btn ${
                      companyType === company.id ? "active" : ""
                    }`}
                  >
                    {company.icon} {company.name}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Weak Topics */}
          <div className="form-group">
            <label>Your Weak Areas (Optional)</label>
            <div className="weak-topics-input">
              <input
                type="text"
                value={weakTopicInput}
                onChange={(e) => setWeakTopicInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddWeakTopic()}
                placeholder="e.g., Graph Traversal"
                className="revision-input"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAddWeakTopic}
                className="add-btn"
              >
                Add
              </motion.button>
            </div>
            <div className="weak-topics-list">
              {weakTopics.map((topic) => (
                <motion.span
                  key={topic}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  className="weak-topic-tag"
                >
                  {topic}
                  <button onClick={() => handleRemoveWeakTopic(topic)}>
                    ×
                  </button>
                </motion.span>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGenerate}
            disabled={isGenerating}
            className="generate-btn"
          >
            {isGenerating ? (
              <>
                <span className="spinner"></span>
                Generating...
              </>
            ) : (
              <>✨ Generate Revision Material</>
            )}
          </motion.button>

          {/* History Toggle */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowHistory(!showHistory)}
            className="history-btn"
          >
            📚 {showHistory ? "Hide" : "Show"} History ({savedRevisions.length})
          </motion.button>
        </motion.div>

        {/* Right Panel - Generated Content */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="revision-content-panel"
        >
          {generatedContent ? (
            <div ref={contentRef} className="generated-content">
              <div className="content-header">
                <h2>📝 Your Revision Material</h2>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() =>
                    navigator.clipboard.writeText(generatedContent)
                  }
                  className="copy-btn"
                  title="Copy to clipboard"
                >
                  📋
                </motion.button>
              </div>
              <div className="content-body">
                <pre>{generatedContent}</pre>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <motion.div
                animate={{
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                📚
              </motion.div>
              <h3>No content generated yet</h3>
              <p>Configure your revision settings and click generate</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* History Panel */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="history-panel"
          >
            <h2>📚 Revision History</h2>
            <div className="history-grid">
              {savedRevisions.map((revision, index) => (
                <motion.div
                  key={revision.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  className="history-card"
                  onClick={() => setGeneratedContent(revision.content)}
                >
                  <div className="history-card-header">
                    <span className="subject-badge">{revision.subject}</span>
                    <span className="type-badge">{revision.revisionType}</span>
                  </div>
                  <h4>{revision.topic}</h4>
                  <p className="history-date">
                    {new Date(revision.createdAt).toLocaleDateString()}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .revision-mode-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
        }

        .revision-header {
          text-align: center;
          margin-bottom: 3rem;
        }

        .revision-header h1 {
          font-size: 2.5rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
        }

        .gradient-text {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .subtitle {
          font-size: 1.1rem;
          color: var(--gray-600);
        }

        .revision-layout {
          display: grid;
          grid-template-columns: 400px 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        @media (max-width: 1024px) {
          .revision-layout {
            grid-template-columns: 1fr;
          }
        }

        .revision-config-panel,
        .revision-content-panel {
          background: white;
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }

        .revision-config-panel h2 {
          font-size: 1.5rem;
          margin-bottom: 1.5rem;
          color: var(--gray-900);
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: var(--gray-700);
        }

        .revision-select,
        .revision-input {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid var(--gray-200);
          border-radius: 8px;
          font-size: 1rem;
          transition: all 0.3s ease;
        }

        .revision-select:focus,
        .revision-input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .revision-type-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .revision-type-card {
          padding: 1rem;
          border: 2px solid var(--gray-200);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: center;
        }

        .revision-type-card.selected {
          border-width: 3px;
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.2);
        }

        .type-icon {
          font-size: 2rem;
          display: block;
          margin-bottom: 0.5rem;
        }

        .revision-type-card h4 {
          font-size: 0.9rem;
          margin-bottom: 0.25rem;
          color: var(--gray-900);
        }

        .revision-type-card p {
          font-size: 0.75rem;
          color: var(--gray-600);
        }

        .company-type-selector {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .company-btn {
          padding: 0.5rem 1rem;
          border: 2px solid var(--gray-200);
          border-radius: 8px;
          background: white;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 0.9rem;
        }

        .company-btn:hover {
          border-color: #667eea;
        }

        .company-btn.active {
          border-color: #667eea;
          background: #667eea;
          color: white;
        }

        .weak-topics-input {
          display: flex;
          gap: 0.5rem;
        }

        .add-btn {
          padding: 0.75rem 1.5rem;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }

        .weak-topics-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        .weak-topic-tag {
          padding: 0.5rem 0.75rem;
          background: var(--purple-50);
          color: var(--purple-700);
          border-radius: 20px;
          font-size: 0.875rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .weak-topic-tag button {
          background: none;
          border: none;
          color: var(--purple-700);
          font-size: 1.2rem;
          cursor: pointer;
          line-height: 1;
        }

        .generate-btn,
        .history-btn {
          width: 100%;
          padding: 1rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .generate-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          margin-bottom: 1rem;
        }

        .generate-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .history-btn {
          background: var(--gray-100);
          color: var(--gray-700);
        }

        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          margin-right: 0.5rem;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .generated-content {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .content-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid var(--gray-100);
        }

        .content-header h2 {
          font-size: 1.5rem;
          color: var(--gray-900);
        }

        .copy-btn {
          padding: 0.5rem 1rem;
          background: var(--gray-100);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1.2rem;
        }

        .content-body {
          flex: 1;
          overflow-y: auto;
          background: var(--gray-50);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .content-body pre {
          white-space: pre-wrap;
          word-wrap: break-word;
          font-family: "Inter", sans-serif;
          line-height: 1.8;
          color: var(--gray-800);
        }

        .empty-state {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--gray-500);
          font-size: 3rem;
        }

        .empty-state h3 {
          font-size: 1.5rem;
          margin: 1rem 0 0.5rem;
          color: var(--gray-700);
        }

        .empty-state p {
          font-size: 1rem;
          color: var(--gray-600);
        }

        .history-panel {
          background: white;
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          margin-top: 2rem;
        }

        .history-panel h2 {
          font-size: 1.5rem;
          margin-bottom: 1.5rem;
          color: var(--gray-900);
        }

        .history-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 1rem;
        }

        .history-card {
          padding: 1.5rem;
          background: var(--gray-50);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          border: 2px solid transparent;
        }

        .history-card:hover {
          border-color: #667eea;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        }

        .history-card-header {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .subject-badge,
        .type-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .subject-badge {
          background: var(--blue-100);
          color: var(--blue-700);
        }

        .type-badge {
          background: var(--purple-100);
          color: var(--purple-700);
        }

        .history-card h4 {
          font-size: 1rem;
          margin-bottom: 0.5rem;
          color: var(--gray-900);
        }

        .history-date {
          font-size: 0.875rem;
          color: var(--gray-600);
        }
      `}</style>
    </div>
  );
}
