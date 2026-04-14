"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isOffTopic?: boolean;
}

interface EngineeringChatbotProps {
  userId: string;
}

const EngineeringChatbot = ({ userId }: EngineeringChatbotProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sessionStarted, setSessionStarted] = useState(false);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const startSession = () => {
    setSessionStarted(true);
    const welcomeMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "assistant",
      content: `👋 Hello! I'm your Engineering Placement Assistant.

I can help you with:
• Operating Systems (OS)
• Database Management Systems (DBMS)
• Object-Oriented Programming (OOPS)
• Computer Networks (CN)
• Data Structures & Algorithms (DSA)
• Interview preparation strategies
• Coding problem explanations

Ask me any computer science engineering question!`,
      timestamp: new Date().toISOString(),
    };
    setMessages([welcomeMessage]);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat/engineering-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          message: input.trim(),
          conversationHistory: messages.slice(-5),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date().toISOString(),
        isOffTopic: data.isOffTopic,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Chatbot error:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSessionStarted(false);
  };

  const quickQuestions = [
    "Trigger my resume analysis summary",
    "Explain process vs thread in OS",
    "What is normalization in DBMS?",
    "Difference between stack and queue",
    "How does TCP 3-way handshake work?",
    "What are the 4 pillars of OOPS?",
  ];

  if (!sessionStarted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="chatbot-welcome"
      >
        <div className="welcome-card">
          <div className="welcome-icon">🤖</div>
          <h1 className="text-3xl font-bold mb-3">Engineering Placement Assistant</h1>
          <p className="text-gray-600 mb-6">
            Your AI companion for CS fundamentals, interview prep, and technical doubts.
            Strictly focused on computer science engineering topics.
          </p>
          
          <div className="allowed-topics-box">
            <h3 className="font-bold mb-3">✅ I Can Help With:</h3>
            <div className="topics-grid">
              <div className="topic-badge">OS</div>
              <div className="topic-badge">DBMS</div>
              <div className="topic-badge">OOPS</div>
              <div className="topic-badge">CN</div>
              <div className="topic-badge">DSA</div>
              <div className="topic-badge">Interviews</div>
            </div>
          </div>

          <div className="forbidden-box">
            <h3 className="font-bold mb-2">❌ Not Available:</h3>
            <p className="text-sm text-gray-600">
              General chat, non-engineering subjects, homework solutions
            </p>
          </div>

          <button onClick={startSession} className="start-chat-btn">
            <span>💬</span>
            <span>Start Learning</span>
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="engineering-chatbot-container">
      {/* Header */}
      <div className="chatbot-header">
        <div className="header-left">
          <div className="bot-avatar">🤖</div>
          <div>
            <h2 className="font-bold text-lg">Engineering Assistant</h2>
            <p className="text-sm text-gray-600">CS Topics Only</p>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={clearChat} className="clear-btn" title="Clear Chat">
            🗑️
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="chatbot-messages">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`message-wrapper ${message.role}`}
            >
              <div className={`chat-message ${message.role} ${message.isOffTopic ? "off-topic" : ""}`}>
                {message.role === "assistant" && (
                  <div className="message-avatar">🤖</div>
                )}
                <div className="message-content">
                  {message.content.split("\n").map((line, idx) => (
                    <p key={idx} className={line.startsWith("•") ? "bullet-point" : ""}>
                      {line}
                    </p>
                  ))}
                </div>
                {message.role === "user" && (
                  <div className="message-avatar user">👤</div>
                )}
              </div>
              <div className="message-time">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="typing-indicator"
          >
            <div className="chat-message assistant">
              <div className="message-avatar">🤖</div>
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      {messages.length <= 1 && (
        <div className="quick-questions">
          <p className="text-sm font-semibold mb-2">💡 Quick Questions:</p>
          <div className="questions-scroll">
            {quickQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => {
                  setInput(question);
                  setTimeout(() => sendMessage(), 100);
                }}
                className="quick-question-chip"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="chatbot-input-area">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about OS, DBMS, DSA, CN, OOPS..."
          className="chat-textarea"
          rows={2}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          className="send-btn"
        >
          {loading ? "⏳" : "📤"}
        </button>
      </div>

      {/* Footer Info */}
      <div className="chatbot-footer">
        <p className="text-xs text-gray-500">
          💡 This bot only answers CS engineering questions. Off-topic queries will be rejected.
        </p>
      </div>
    </div>
  );
};

export default EngineeringChatbot;
