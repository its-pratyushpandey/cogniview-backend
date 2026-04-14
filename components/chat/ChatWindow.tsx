"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import MessageBubble from "./MessageBubble";
import InputBox from "./InputBox";
import TaskCard from "./TaskCard";
import TodoPanel from "./TodoPanel";
import { runAction } from "@/lib/chat-actions";
import { VoiceManager } from "@/lib/voice-manager";

interface ChatMessage {
  id: string;
  role: string;
  text: string;
  timestamp: string;
}

interface Task {
  id: string;
  action: string;
  params: Record<string, unknown>;
  status: "running" | "completed" | "error";
  result: unknown;
}

const STORAGE_KEY = "kiki_chat_history_v1";
const TODO_ACTIONS = new Set(["create_todo", "get_todos", "update_todo", "delete_todo"]);

type StreamEvent =
  | { type: "delta"; text: string }
  | {
      type: "done";
      model: string;
      elapsedMs: number;
      ttfbMs: number | null;
      cached?: boolean;
      isFallback?: boolean;
    }
  | { type: "error"; error: string };

type ActionPayload = {
  type: "action";
  action: string;
  params?: unknown;
};

function isActionPayload(value: unknown): value is ActionPayload {
  if (!value || typeof value !== "object") return false;
  const rec = value as Record<string, unknown>;
  return rec.type === "action" && typeof rec.action === "string";
}

function toActionParams(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export default function ChatWindow() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [taskQueue, setTaskQueue] = useState<Task[]>([]);
  const [todoRefreshKey, setTodoRefreshKey] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const voiceManager = useRef<VoiceManager | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  const refreshTodosIfNeeded = (action: string) => {
    if (TODO_ACTIONS.has(action)) {
      setTodoRefreshKey((prev) => prev + 1);
    }
  };

  // Initialize voice manager
  useEffect(() => {
    if (typeof window !== 'undefined') {
      voiceManager.current = new VoiceManager();
    }
  }, []);

  // Load conversation history
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setMessages(JSON.parse(saved));
      } else {
        // Welcome message
        setMessages([{
          id: String(Date.now()),
          role: "assistant",
          text: "👋 Hi! I'm Kiki, your AI assistant for Cogniview! I can help you with:\n\n• Interview preparation and tips\n• GitHub repository analysis\n• Weather updates\n• Todo management\n• Calculations\n• Time zones\n• Career advice and job search strategies\n\nWhat would you like to know about today?",
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  }, []);

  // Save conversation history
  useEffect(() => {
    if (messages.length > 0 && !isTyping) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages, isTyping]);

  // Scroll only when message count changes (not on every streamed token)
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // Handle sending messages
  async function handleSend(text: string) {
    if (!text?.trim()) return;

    // Cancel any in-flight request so the UI stays snappy
    if (activeRequest.current) {
      activeRequest.current.abort();
      activeRequest.current = null;
    }

    const userMsg: ChatMessage = {
      id: Date.now() + "-user",
      role: "user",
      text: text.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setIsConnected(true);

    const assistantMsgId = Date.now() + "-ai";
    const assistantTimestamp = new Date().toISOString();
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      role: "assistant",
      text: "",
      timestamp: assistantTimestamp,
    }]);

    const abortController = new AbortController();
    activeRequest.current = abortController;

    try {
      const response = await fetch("/api/chat/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          maxTokens: 1000,
          temperature: 0.7,
          stream: true
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";

      // Streaming path (NDJSON)
      if (contentType.includes("application/x-ndjson") && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";
        let pending = "";
        let flushScheduled = false;
        const startedAt = performance.now();
        let sawFirstDelta = false;

        const flush = () => {
          flushScheduled = false;
          if (!pending) return;
          const toAppend = pending;
          pending = "";
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, text: (m.text || "") + toAppend }
              : m
          ));
        };

        const scheduleFlush = () => {
          if (flushScheduled) return;
          flushScheduled = true;
          requestAnimationFrame(flush);
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            let evt: StreamEvent | null = null;
            try {
              evt = JSON.parse(line) as StreamEvent;
            } catch {
              continue;
            }

            if (evt.type === "delta") {
              if (!sawFirstDelta) {
                sawFirstDelta = true;
                const ttfbMs = Math.round(performance.now() - startedAt);
                // Lightweight client-side metric (dev visibility)
                console.log(`[kiki] stream ttfb: ${ttfbMs}ms`);
              }

              fullText += evt.text;
              pending += evt.text;
              scheduleFlush();
            } else if (evt.type === "error") {
              setIsConnected(false);
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                  ? { ...m, role: "error", text: `❌ ${evt.error}` }
                  : m
              ));
            } else if (evt.type === "done") {
              // Ensure final pending text is flushed
              flush();

              // If the assistant streamed an action JSON, execute it like before
              let parsedAction: unknown = null;
              try {
                parsedAction = JSON.parse(fullText) as unknown;
              } catch {
                parsedAction = null;
              }

              if (isActionPayload(parsedAction)) {
                const actionParams = toActionParams(parsedAction.params);

                if (parsedAction.action === "open_company_prep") {
                  setMessages(prev => prev.filter(m => m.id !== assistantMsgId));

                  const navMsg: ChatMessage = {
                    id: Date.now() + "-navigate",
                    role: "assistant",
                    text: "Opening Company-wise Preparation...",
                    timestamp: new Date().toISOString()
                  };

                  setMessages(prev => [...prev, navMsg]);
                  router.push("/company-prep");
                  setIsTyping(false);
                  activeRequest.current = null;
                  return;
                }

                // Remove the raw JSON output message
                setMessages(prev => prev.filter(m => m.id !== assistantMsgId));

                const intentMsg: ChatMessage = {
                  id: Date.now() + "-intent",
                  role: "assistant",
                  text: `🔄 Executing: ${parsedAction.action}`,
                  timestamp: new Date().toISOString()
                };
                setMessages(prev => [...prev, intentMsg]);

                const taskId = Date.now() + "-task";
                setTaskQueue(prev => [...prev, {
                  id: taskId,
                  action: parsedAction.action,
                  params: actionParams,
                  status: "running",
                  result: null
                }]);

                const actionResult = await runAction(parsedAction.action, actionParams);

                setTaskQueue(prev => prev.map(task =>
                  task.id === taskId
                    ? { ...task, status: "completed", result: actionResult }
                    : task
                ));

                refreshTodosIfNeeded(parsedAction.action);

                const resultMsg: ChatMessage = {
                  id: Date.now() + "-result",
                  role: "assistant",
                  text: `✅ Action completed!\n\n${typeof actionResult === 'string' ? actionResult : JSON.stringify(actionResult, null, 2)}`,
                  timestamp: new Date().toISOString()
                };
                setMessages(prev => [...prev, resultMsg]);

                if (voiceEnabled && voiceManager.current) {
                  voiceManager.current.speak(`Action completed: ${parsedAction.action}`);
                }
              } else {
                if (voiceEnabled && voiceManager.current && fullText.trim()) {
                  voiceManager.current.speak(fullText);
                }

                if (evt.isFallback) {
                  setIsConnected(false);
                }
              }

              setIsTyping(false);
              activeRequest.current = null;
              return;
            }
          }
        }

        // Stream ended without a done event
        flush();
        setIsTyping(false);
        activeRequest.current = null;
        return;
      }

      // Fallback: non-stream JSON
      const data = await response.json();
      
      // Check if it's a fallback response
      if (data.isFallback) {
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, role: "assistant", text: data.output || "" }
            : m
        ));
        setIsConnected(false); // Show disconnected state
        return;
      }
      
      const aiResponse = data.output || data.content || "Sorry, I couldn't generate a response.";

      // Check if AI wants to execute an action
      let parsedAction = null;
      try {
        parsedAction = JSON.parse(aiResponse);
      } catch {
        // Not JSON, treat as regular response
      }

      if (parsedAction && parsedAction.type === "action") {
        if (parsedAction.action === "open_company_prep") {
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId
              ? { ...m, role: "assistant", text: "Opening Company-wise Preparation..." }
              : m
          ));
          router.push("/company-prep");
          return;
        }

        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, role: "assistant", text: `🔄 Executing: ${parsedAction.action}` }
            : m
        ));

        // Create and run task
        const taskId = Date.now() + "-task";
        setTaskQueue(prev => [...prev, {
          id: taskId,
          action: parsedAction.action,
          params: parsedAction.params,
          status: "running",
          result: null
        }]);

        // Execute action
        const actionResult = await runAction(parsedAction.action, parsedAction.params);
        
        // Update task status
        setTaskQueue(prev => prev.map(task => 
          task.id === taskId 
            ? { ...task, status: "completed", result: actionResult }
            : task
        ));

        refreshTodosIfNeeded(parsedAction.action);

        // Add result message
        const resultMsg: ChatMessage = {
          id: Date.now() + "-result",
          role: "assistant",
          text: `✅ Action completed!\n\n${typeof actionResult === 'string' ? actionResult : JSON.stringify(actionResult, null, 2)}`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, resultMsg]);

        // Voice output for result
        if (voiceEnabled && voiceManager.current) {
          voiceManager.current.speak(`Action completed: ${parsedAction.action}`);
        }
      } else {
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, role: "assistant", text: aiResponse }
            : m
        ));

        // Voice output for regular response
        if (voiceEnabled && voiceManager.current) {
          voiceManager.current.speak(aiResponse);
        }
      }

    } catch (error) {
      console.error("Chat error:", error);

      if (error instanceof DOMException && error.name === "AbortError") {
        setMessages(prev => prev.filter(m => m.id !== assistantMsgId));
        return;
      }

      setIsConnected(false);
      
      let errorMessage = "❌ I'm having trouble connecting right now. ";
      
      if (error instanceof Error) {
        if (error.message.includes("500")) {
          errorMessage += "The AI service is temporarily unavailable. Please try again in a moment.";
        } else if (error.message.includes("Failed to fetch")) {
          errorMessage += "Please check your internet connection and try again.";
        } else {
          errorMessage += "Please try again.";
        }
      } else {
        errorMessage += "Please try again.";
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId
          ? { ...m, role: "error", text: errorMessage }
          : m
      ));
    } finally {
      setIsTyping(false);
      activeRequest.current = null;
    }
  }

  // Clear conversation
  function clearConversation() {
    setMessages([]);
    setTaskQueue([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  // Export conversation
  function exportConversation() {
    const data = {
      messages,
      exported: new Date().toISOString(),
      app: process.env.NEXT_PUBLIC_APP_NAME || "Cogniview AI Interview"
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kiki-chat-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col compact-premium-chat overflow-hidden">
      {/* Header */}
      <div className="premium-chat-header text-gray-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${
            isConnected ? 'premium-status-connected' : 'premium-status-disconnected'
          }`} />
          <div>
            <h3 className="font-semibold text-base tracking-tight">Kiki AI</h3>
            <p className="text-xs text-gray-600">
              {isConnected ? "Online" : "Offline"} • Groq
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2 rounded-lg transition-all duration-200 ${
              voiceEnabled 
                ? 'bg-green-100 text-green-600 border border-green-200' 
                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
            }`}
            title={voiceEnabled ? "Voice enabled" : "Voice disabled"}
          >
            <span className="text-sm">🎤</span>
          </button>
          <button
            onClick={exportConversation}
            className="p-2 rounded-lg bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-all duration-200"
            title="Export conversation"
          >
            <span className="text-sm">📥</span>
          </button>
          <button
            onClick={clearConversation}
            className="p-2 rounded-lg bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-all duration-200"
            title="Clear conversation"
          >
            <span className="text-sm">🗑️</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 premium-chat-messages space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 15, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <MessageBubble message={message} />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-gray-500 text-sm px-3"
          >
            <div className="flex space-x-1">
              <div className="w-1.5 h-1.5 premium-typing-dot rounded-full" />
              <div className="w-1.5 h-1.5 premium-typing-dot rounded-full" style={{animationDelay: '0.2s'}} />
              <div className="w-1.5 h-1.5 premium-typing-dot rounded-full" style={{animationDelay: '0.4s'}} />
            </div>
            <span className="text-gray-600">Thinking...</span>
          </motion.div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Task Queue */}
      {taskQueue.length > 0 && (
        <div className="premium-input-area border-t p-3 space-y-2 max-h-24 overflow-y-auto">
          {taskQueue.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}

      <div className="border-t border-black/5 bg-white/90 px-3 py-2">
        <TodoPanel refreshKey={todoRefreshKey} />
      </div>

      {/* Input */}
      <div className="premium-input-area p-4">
        <InputBox 
          onSend={handleSend} 
          disabled={isTyping}
          voiceManager={voiceManager.current}
          voiceEnabled={voiceEnabled}
        />
      </div>
    </div>
  );
}