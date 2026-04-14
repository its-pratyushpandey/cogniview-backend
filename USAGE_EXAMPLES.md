# 📚 Usage Examples & Code Snippets

## 🎯 Feature 9: Interview Suggestions

### Basic Usage

```typescript
import InterviewSuggestions from "@/components/InterviewSuggestions";

// In your feedback page or component
export default function FeedbackPage() {
  const transcript = [
    { role: "interviewer", content: "What is a deadlock in operating systems?" },
    { role: "candidate", content: "Um, it's when the system stops working..." },
    { role: "interviewer", content: "Explain the OSI model." },
    { role: "candidate", content: "It has 7 layers, I think..." }
  ];

  return (
    <div>
      <h1>Interview Feedback</h1>
      
      {/* Your existing feedback display */}
      <div className="feedback-content">
        {/* ... existing feedback ... */}
      </div>

      {/* Add Interview Suggestions */}
      <InterviewSuggestions 
        transcript={transcript}
        interviewId="interview_123"
      />
    </div>
  );
}
```

### API Usage (Direct)

```typescript
// Call the API directly
async function getInterviewSuggestions(transcript: any[]) {
  try {
    const response = await fetch("/api/interview/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });

    if (!response.ok) {
      throw new Error("Failed to get suggestions");
    }

    const data = await response.json();
    
    console.log("Suggestions:", data.suggestions);
    console.log("Overall Feedback:", data.overallFeedback);
    console.log("Key Areas:", data.keyAreas);
    
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
}

// Usage
const suggestions = await getInterviewSuggestions([
  { role: "interviewer", content: "What is normalization?" },
  { role: "candidate", content: "It's about databases..." }
]);
```

### Expected Response Format

```json
{
  "suggestions": [
    {
      "questionAsked": "What is normalization in DBMS?",
      "userAnswer": "It's about databases...",
      "issues": [
        "Answer is too vague and lacks specifics",
        "No mention of normal forms (1NF, 2NF, 3NF)",
        "Missing purpose of normalization"
      ],
      "modelAnswer": "Normalization is a database design technique that organizes tables to minimize redundancy and dependency. It involves dividing large tables into smaller ones and defining relationships between them. The main goals are to eliminate redundant data, ensure data dependencies make sense, and reduce data anomalies. Common normal forms include 1NF (atomic values), 2NF (no partial dependencies), and 3NF (no transitive dependencies).",
      "rephrasingSuggestion": "Normalization is a systematic approach to organizing database tables by eliminating data redundancy and ensuring logical data dependencies. It involves structuring data through normal forms like 1NF, 2NF, and 3NF to improve data integrity.",
      "additionalConcepts": [
        "1NF, 2NF, 3NF, BCNF",
        "Functional dependencies",
        "Data anomalies (insertion, update, deletion)",
        "Denormalization for performance"
      ],
      "improvementScore": 4
    }
  ],
  "overallFeedback": "Your answers show basic understanding but lack depth and technical specificity. Focus on providing structured explanations with examples.",
  "keyAreas": [
    "Database normalization",
    "Operating systems concepts",
    "Network protocols"
  ]
}
```

### Custom Styling

```typescript
// Override default styles
import InterviewSuggestions from "@/components/InterviewSuggestions";

<div className="my-custom-container">
  <style jsx>{`
    .suggestions-prompt-card {
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
    }
    
    .overall-feedback-card {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }
  `}</style>
  
  <InterviewSuggestions 
    transcript={transcript}
    interviewId={interviewId}
  />
</div>
```

---

## 🤖 Feature 10: Engineering Chatbot

### Basic Usage (Page)

```typescript
// Simply navigate to the route
<Link href="/engineering-chat">
  <button>Open Engineering Assistant</button>
</Link>
```

### Embed in Your Page

```typescript
import EngineeringChatbot from "@/components/EngineeringChatbot";

export default function HelpPage() {
  return (
    <div className="help-page">
      <h1>Need Help with CS Topics?</h1>
      
      {/* Embedded chatbot */}
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <EngineeringChatbot />
      </div>
    </div>
  );
}
```

### API Usage (Direct)

```typescript
// Call the chatbot API directly
async function askEngineeringBot(
  message: string,
  conversationHistory: ChatMessage[] = []
) {
  try {
    const response = await fetch("/api/chat/engineering-bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversationHistory: conversationHistory.slice(-5), // Last 5 only
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get response");
    }

    const data = await response.json();
    
    if (data.isOffTopic) {
      console.log("⚠️ Off-topic request rejected");
    }
    
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
}

// Usage
const response = await askEngineeringBot("Explain binary search tree");
console.log(response.message);
console.log("Off-topic:", response.isOffTopic);
```

### Building Custom Chat Interface

```typescript
"use client";

import { useState } from "react";

export default function CustomChat() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    // Add user message
    const userMsg = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Call API
      const response = await fetch("/api/chat/engineering-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          conversationHistory: messages.slice(-5),
        }),
      });

      const data = await response.json();

      // Add bot response
      const botMsg = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date().toISOString(),
        isOffTopic: data.isOffTopic,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="custom-chat">
      <div className="messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.role} ${msg.isOffTopic ? "off-topic" : ""}`}
          >
            {msg.content}
          </div>
        ))}
      </div>

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask about CS topics..."
        />
        <button onClick={sendMessage} disabled={loading}>
          {loading ? "⏳" : "📤"}
        </button>
      </div>
    </div>
  );
}
```

### Expected Response Format

```json
{
  "message": "Binary Search Tree (BST) is a node-based binary tree data structure with the following properties:\n\n• Left subtree contains only nodes with keys less than the parent node\n• Right subtree contains only nodes with keys greater than the parent node\n• Both left and right subtrees must also be binary search trees\n• No duplicate nodes\n\nKey operations:\n• Search: O(log n) average, O(n) worst case\n• Insertion: O(log n) average\n• Deletion: O(log n) average\n\nCommon operations include in-order, pre-order, and post-order traversals.",
  "isOffTopic": false
}
```

### Off-topic Response Example

```json
{
  "message": "I only help with engineering placement topics (OS, DBMS, OOPS, CN, DSA, Interview Prep). Please ask questions related to computer science fundamentals or interview preparation.",
  "isOffTopic": true
}
```

---

## 🔗 Integration Examples

### Add to Interview Feedback Page

```typescript
// app/(root)/interview/[id]/feedback/page.tsx

import InterviewSuggestions from "@/components/InterviewSuggestions";

const Feedback = async ({ params }: RouteParams) => {
  const { id } = await params;
  const user = await getCurrentUser();
  const interview = await getInterviewById(id);
  const feedback = await getFeedbackByInterviewId({ interviewId: id, userId: user?.id! });

  // Get transcript from interview
  const transcript = interview.transcript || [];

  return (
    <section className="section-feedback">
      {/* Existing feedback display */}
      <div className="feedback-content">
        <h1>Interview Feedback</h1>
        <p>Overall Score: {feedback?.totalScore}/100</p>
        {/* ... other feedback ... */}
      </div>

      {/* Add suggestions section */}
      <div className="suggestions-section">
        <h2>AI-Powered Improvement Suggestions</h2>
        <InterviewSuggestions 
          transcript={transcript}
          interviewId={id}
        />
      </div>

      <div className="buttons">
        <Button asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
        <Button asChild>
          <Link href={`/interview/${id}`}>Retake Interview</Link>
        </Button>
      </div>
    </section>
  );
};
```

### Add Chatbot Button to Dashboard

```typescript
// app/(root)/page.tsx

import Link from "next/link";

export default function Dashboard() {
  return (
    <div className="dashboard">
      {/* Existing dashboard content */}
      
      {/* Add floating chatbot button */}
      <Link href="/engineering-chat">
        <button className="floating-chat-btn">
          <span className="icon">🤖</span>
          <span className="text">Ask Engineering Bot</span>
        </button>
      </Link>

      <style jsx>{`
        .floating-chat-btn {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1rem 1.5rem;
          border-radius: 50px;
          border: none;
          cursor: pointer;
          box-shadow: var(--shadow-xl);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 700;
          transition: all 0.3s ease;
          z-index: 1000;
        }

        .floating-chat-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }

        .icon {
          font-size: 1.5rem;
        }
      `}</style>
    </div>
  );
}
```

### Add Quick Access Card

```typescript
// In your features showcase or quick access menu

const quickAccessCards = [
  {
    title: "Interview Suggestions",
    description: "Get AI-powered feedback on your weak answers",
    icon: "💬",
    href: "/interview/suggestions",
    color: "#667eea",
  },
  {
    title: "Engineering Assistant",
    description: "24/7 CS topics help and interview prep",
    icon: "🤖",
    href: "/engineering-chat",
    color: "#764ba2",
  },
];

<div className="quick-access-grid">
  {quickAccessCards.map((card) => (
    <Link key={card.title} href={card.href}>
      <div
        className="quick-access-card"
        style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}dd)` }}
      >
        <div className="icon">{card.icon}</div>
        <h3>{card.title}</h3>
        <p>{card.description}</p>
      </div>
    </Link>
  ))}
</div>
```

---

## 🎨 Styling Examples

### Custom Gradient Themes

```css
/* Purple Theme for Suggestions */
.suggestions-prompt-card.purple-theme {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Blue Theme for Suggestions */
.suggestions-prompt-card.blue-theme {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

/* Green Theme for Suggestions */
.suggestions-prompt-card.green-theme {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

/* Orange Theme for Chatbot */
.chatbot-header.orange-theme {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

/* Dark Theme for Chatbot */
.engineering-chatbot-container.dark-theme {
  background: #1a1a2e;
  color: white;
}

.engineering-chatbot-container.dark-theme .chat-message.assistant .message-content {
  background: #16213e;
  color: white;
  border-color: #0f3460;
}
```

### Compact Mode

```css
/* Compact Suggestions */
.suggestion-card.compact {
  padding: 1rem;
}

.suggestion-card.compact .question-text {
  font-size: 1rem;
}

.suggestion-card.compact .user-answer-section {
  padding: 0.75rem;
}

/* Compact Chatbot */
.engineering-chatbot-container.compact {
  height: 60vh;
  max-width: 600px;
}

.compact .chat-message {
  max-width: 85%;
}

.compact .message-content {
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
}
```

---

## 🧪 Testing Examples

### Test Suggestions API

```typescript
// __tests__/suggestions.test.ts

describe("Interview Suggestions API", () => {
  it("should return suggestions for weak answers", async () => {
    const transcript = [
      { role: "interviewer", content: "What is a deadlock?" },
      { role: "candidate", content: "It's bad..." }
    ];

    const response = await fetch("/api/interview/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.suggestions).toBeDefined();
    expect(Array.isArray(data.suggestions)).toBe(true);
    expect(data.overallFeedback).toBeDefined();
    expect(Array.isArray(data.keyAreas)).toBe(true);
  });

  it("should handle empty transcript", async () => {
    const response = await fetch("/api/interview/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: [] }),
    });

    expect(response.status).toBe(400);
  });
});
```

### Test Chatbot API

```typescript
// __tests__/chatbot.test.ts

describe("Engineering Chatbot API", () => {
  it("should respond to CS topics", async () => {
    const response = await fetch("/api/chat/engineering-bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Explain binary search",
        conversationHistory: [],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBeDefined();
    expect(data.isOffTopic).toBe(false);
  });

  it("should reject off-topic requests", async () => {
    const response = await fetch("/api/chat/engineering-bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "What's the weather?",
        conversationHistory: [],
      }),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.isOffTopic).toBe(true);
  });
});
```

---

## 📊 Performance Optimization

### Lazy Load Components

```typescript
// Lazy load for better performance
import dynamic from "next/dynamic";

const InterviewSuggestions = dynamic(
  () => import("@/components/InterviewSuggestions"),
  { loading: () => <div>Loading suggestions...</div> }
);

const EngineeringChatbot = dynamic(
  () => import("@/components/EngineeringChatbot"),
  { loading: () => <div>Loading chatbot...</div> }
);
```

### Memoization

```typescript
import { memo } from "react";

const InterviewSuggestions = memo(({ transcript, interviewId }) => {
  // Component logic
}, (prevProps, nextProps) => {
  // Only re-render if transcript or interviewId changes
  return (
    JSON.stringify(prevProps.transcript) === JSON.stringify(nextProps.transcript) &&
    prevProps.interviewId === nextProps.interviewId
  );
});
```

### Debounce Chat Input

```typescript
import { useState, useCallback } from "react";
import { debounce } from "lodash";

const DebouncedChatInput = () => {
  const [input, setInput] = useState("");

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      // Process input
      console.log("Processing:", value);
    }, 300),
    []
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    debouncedSearch(value);
  };

  return (
    <textarea
      value={input}
      onChange={handleChange}
      placeholder="Type your message..."
    />
  );
};
```

---

## 🔒 Security Best Practices

### Rate Limiting

```typescript
// Add rate limiting to APIs (example with Redis)
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
});

// Apply to API routes
app.use("/api/interview/suggestions", limiter);
app.use("/api/chat/engineering-bot", limiter);
```

### Input Sanitization

```typescript
// Sanitize user input before sending to API
function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/<script[^>]*>.*?<\/script>/gi, "") // Remove script tags
    .replace(/<[^>]+>/g, "") // Remove HTML tags
    .substring(0, 5000); // Limit length
}

// Usage
const sanitizedMessage = sanitizeInput(userMessage);
```

---

**Happy Coding! 🚀**
