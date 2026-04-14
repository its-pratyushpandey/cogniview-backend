# 🎯 Feature Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          COGNIVIEW PLATFORM                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │
                    ┌───────────────┴────────────────┐
                    │                                │
                    ▼                                ▼
        ┌───────────────────────┐      ┌───────────────────────┐
        │   FEATURE 9️⃣          │      │   FEATURE 🔟          │
        │  Interview            │      │  Engineering          │
        │  Suggestions          │      │  Chatbot              │
        └───────────────────────┘      └───────────────────────┘
                    │                                │
                    │                                │
         ┌──────────┴──────────┐          ┌─────────┴──────────┐
         ▼                     ▼          ▼                    ▼
┌─────────────────┐   ┌─────────────┐   ┌──────────────┐   ┌─────────────┐
│  API ENDPOINT   │   │  COMPONENT  │   │ API ENDPOINT │   │ COMPONENT   │
├─────────────────┤   ├─────────────┤   ├──────────────┤   ├─────────────┤
│ POST /api/      │   │ Interview   │   │ POST /api/   │   │ Engineering │
│ interview/      │   │ Suggestions │   │ chat/        │   │ Chatbot     │
│ suggestions     │   │             │   │ engineering- │   │             │
│                 │   │ 241 lines   │   │ bot          │   │ 337 lines   │
│ - Gemini AI     │   │             │   │              │   │             │
│ - Temp: 0.7     │   │ Features:   │   │ - Gemini AI  │   │ Features:   │
│ - Tokens: 4000  │   │ • Expandable│   │ - Temp: 0.7  │   │ • Welcome   │
│                 │   │ • Scoring   │   │ - Tokens:    │   │ • Chat UI   │
│ Returns:        │   │ • Print     │   │   1500       │   │ • Quick Q's │
│ • Suggestions   │   │ • Gradients │   │              │   │ • History   │
│ • Feedback      │   │ • Responsive│   │ Returns:     │   │ • Off-topic │
│ • Key Areas     │   │             │   │ • Message    │   │   Detection │
└─────────────────┘   └─────────────┘   │ • isOffTopic │   └─────────────┘
                                         └──────────────┘
```

## 🎨 UI Flow Diagrams

### Feature 9: Interview Suggestions Flow

```
┌──────────────────────────────────────────────────────────────┐
│  USER JOURNEY                                                 │
└──────────────────────────────────────────────────────────────┘

Start
  │
  ▼
┌─────────────────────────┐
│ Interview Completed     │
│ with Voice Recording    │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Feedback Page Displayed │
│ (Overall Score, etc.)   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ User Sees "Analyze &    │
│ Suggest Improvements"   │
│ Button (Purple Card)    │
└────────────┬────────────┘
             │
             ▼ [Click]
┌─────────────────────────┐
│ API Call to /api/       │
│ interview/suggestions   │
│ with Transcript         │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Loading Spinner (3-5s)  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Results Displayed:      │
│ • Overall Feedback Card │
│   (Pink gradient)       │
│ • Key Areas Badges      │
│ • Suggestion Cards Q1,  │
│   Q2, Q3...             │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ User Expands Cards to   │
│ See:                    │
│ • Model Answer (Blue)   │
│ • Rephrasing (Purple)   │
│ • Concepts (Green)      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Actions:                │
│ • Print Report          │
│ • View Full Feedback    │
└─────────────────────────┘
```

### Feature 10: Engineering Chatbot Flow

```
┌──────────────────────────────────────────────────────────────┐
│  USER JOURNEY                                                 │
└──────────────────────────────────────────────────────────────┘

Start
  │
  ▼
┌─────────────────────────┐
│ Navigate to             │
│ /engineering-chat       │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Welcome Screen:         │
│ • 🤖 Animated Icon      │
│ • ✅ Allowed Topics     │
│ • ❌ Forbidden Topics   │
│ • "Start Learning" Btn  │
└────────────┬────────────┘
             │
             ▼ [Click]
┌─────────────────────────┐
│ Chat Interface Loads:   │
│ • Purple Header         │
│ • Welcome Message       │
│ • Quick Questions       │
│ • Input Area            │
└────────────┬────────────┘
             │
             ▼
       ┌─────┴──────┐
       │            │
       ▼            ▼
┌─────────────┐  ┌─────────────┐
│ Click Quick │  │ Type Custom │
│ Question    │  │ Question    │
└──────┬──────┘  └──────┬──────┘
       │                │
       └────────┬───────┘
                │
                ▼
┌─────────────────────────┐
│ Message Sent to API     │
│ /chat/engineering-bot   │
│ with History (last 5)   │
└────────────┬────────────┘
                │
                ▼
┌─────────────────────────┐
│ Typing Indicator (1-2s) │
└────────────┬────────────┘
                │
                ▼
        ┌───────┴────────┐
        │                │
        ▼                ▼
┌──────────────┐  ┌──────────────┐
│ ON-TOPIC:    │  │ OFF-TOPIC:   │
│ • White Card │  │ • Red Card   │
│ • Detailed   │  │ • Warning    │
│   Answer     │  │ • Rejection  │
└──────────────┘  └──────────────┘
        │
        ▼
┌─────────────────────────┐
│ Continue Conversation   │
│ or Clear Chat           │
└─────────────────────────┘
```

## 🗂️ File Structure

```
c:\Users\praty\OneDrive\Desktop\Cogniview\Cogniview\
│
├── app/
│   ├── api/
│   │   ├── interview/
│   │   │   └── suggestions/
│   │   │       └── route.ts ..................... ✨ NEW
│   │   └── chat/
│   │       └── engineering-bot/
│   │           └── route.ts ..................... ✨ NEW
│   │
│   ├── (root)/
│   │   ├── interview/
│   │   │   └── suggestions/
│   │   │       └── page.tsx ..................... ✨ NEW
│   │   └── engineering-chat/
│   │       └── page.tsx ......................... ✨ NEW
│   │
│   └── globals.css .............................. ✏️ UPDATED (+1100 lines)
│
├── components/
│   ├── InterviewSuggestions.tsx ................. ✨ NEW (241 lines)
│   ├── EngineeringChatbot.tsx ................... ✨ NEW (337 lines)
│   ├── NavigationMenu.tsx ....................... ✏️ UPDATED
│   └── FeaturesShowcase.tsx ..................... ✏️ UPDATED
│
├── types/
│   └── index.d.ts ............................... ✏️ UPDATED
│
└── Documentation/
    ├── INTERVIEW_SUGGESTIONS_AND_CHATBOT.md ..... ✨ NEW
    └── FEATURES_9_10_SUMMARY.md ................. ✨ NEW
```

## 🎨 Component Hierarchy

### InterviewSuggestions Component

```
InterviewSuggestions
│
├── Prompt Card (Purple Gradient)
│   └── "Analyze & Suggest Improvements" Button
│
├── Loading State
│   └── Spinner Animation
│
├── Error State
│   └── Red Error Card
│
└── Results
    │
    ├── Overall Feedback Card (Pink Gradient)
    │   ├── Overall Feedback Text
    │   └── Key Areas Badges
    │
    └── Suggestions List
        │
        └── Suggestion Card (per weak answer)
            │
            ├── Header
            │   ├── Question Number Badge
            │   └── Improvement Score Badge
            │
            ├── Question Text
            │
            ├── User Answer Section (Gray with blue border)
            │
            ├── Issues Section (Red boxes)
            │
            ├── Expand Button (Purple gradient)
            │
            └── Expanded Content (AnimatePresence)
                │
                ├── Model Answer (Blue gradient)
                ├── Rephrasing Suggestion (Purple gradient)
                └── Additional Concepts (Green gradient)
```

### EngineeringChatbot Component

```
EngineeringChatbot
│
├── Welcome Screen (Initial State)
│   │
│   └── Welcome Card
│       │
│       ├── Animated Bot Icon 🤖
│       ├── Title & Description
│       ├── Allowed Topics Box (Blue gradient)
│       │   └── Topics Grid (OS, DBMS, etc.)
│       ├── Forbidden Box (Red background)
│       └── "Start Learning" Button
│
└── Chat Interface (After Start)
    │
    ├── Header (Purple gradient)
    │   │
    │   ├── Bot Avatar & Info
    │   └── Clear Chat Button
    │
    ├── Messages Area (Scrollable)
    │   │
    │   └── Message List (AnimatePresence)
    │       │
    │       ├── Assistant Messages (Left, white bubbles)
    │       ├── User Messages (Right, purple bubbles)
    │       ├── Off-topic Messages (Red background)
    │       └── Typing Indicator (animated dots)
    │
    ├── Quick Questions (if conversation < 2 messages)
    │   └── Scrollable Chip Buttons
    │
    ├── Input Area
    │   │
    │   ├── Textarea (multi-line)
    │   └── Send Button (round, purple)
    │
    └── Footer
        └── Info Text
```

## 🔄 Data Flow

### Suggestions API Data Flow

```
┌─────────────────┐
│  User clicks    │
│  "Analyze"      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Component      │
│  fetches API    │
│  with           │
│  transcript[]   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API receives   │
│  transcript     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Format prompt  │
│  with           │
│  {{TRANSCRIPT}} │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Send to        │
│  Gemini API     │
│  (temp: 0.7)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Gemini         │
│  analyzes &     │
│  returns JSON   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API parses     │
│  response       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Return to      │
│  component      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Component      │
│  renders cards  │
│  with           │
│  animations     │
└─────────────────┘
```

### Chatbot API Data Flow

```
┌─────────────────┐
│  User types     │
│  message        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Component      │
│  fetches API    │
│  with:          │
│  • message      │
│  • history (5)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API receives   │
│  data           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Format prompt  │
│  with           │
│  {{MESSAGE}}    │
│  + history      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Send to        │
│  Gemini API     │
│  (temp: 0.7)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Gemini         │
│  responds       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API checks     │
│  if off-topic   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Return:        │
│  • message      │
│  • isOffTopic   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Component      │
│  displays       │
│  response       │
└─────────────────┘
```

## 📊 CSS Architecture

```
globals.css (5004 → 6100+ lines)
│
├── Existing Styles (5004 lines)
│
└── NEW FEATURES (1100+ lines)
    │
    ├── FEATURE 9: INTERVIEW SUGGESTIONS (~550 lines)
    │   │
    │   ├── Prompt Card Styles
    │   │   ├── .suggestions-prompt-card
    │   │   ├── Pulse animation
    │   │   └── Analyze button
    │   │
    │   ├── Feedback Card Styles
    │   │   ├── .overall-feedback-card
    │   │   ├── .key-areas-grid
    │   │   └── .key-area-badge
    │   │
    │   ├── Suggestion Card Styles
    │   │   ├── .suggestion-card
    │   │   ├── .suggestion-header
    │   │   ├── .question-number
    │   │   ├── .score-badge (excellent/good/needs-work/poor)
    │   │   └── .user-answer-section
    │   │
    │   ├── Issues & Expanded Sections
    │   │   ├── .issues-section
    │   │   ├── .model-answer-section
    │   │   ├── .rephrasing-section
    │   │   └── .additional-concepts-section
    │   │
    │   └── Responsive Styles (@media queries)
    │
    └── FEATURE 10: ENGINEERING CHATBOT (~550 lines)
        │
        ├── Welcome Screen Styles
        │   ├── .chatbot-welcome
        │   ├── .welcome-card
        │   ├── .welcome-icon (bounce animation)
        │   ├── .allowed-topics-box
        │   ├── .topics-grid
        │   └── .forbidden-box
        │
        ├── Chat Interface Styles
        │   ├── .engineering-chatbot-container
        │   ├── .chatbot-header
        │   ├── .bot-avatar
        │   └── .clear-btn
        │
        ├── Messages Styles
        │   ├── .chatbot-messages
        │   ├── .message-wrapper
        │   ├── .chat-message (user/assistant)
        │   ├── .message-avatar
        │   ├── .message-content
        │   ├── .typing-indicator (typing animation)
        │   └── .message-time
        │
        ├── Input & Quick Questions
        │   ├── .quick-questions
        │   ├── .quick-question-chip
        │   ├── .chatbot-input-area
        │   ├── .chat-textarea
        │   └── .send-btn
        │
        └── Responsive Styles (@media queries)
```

---

**Legend:**
- ✨ NEW = Newly created file
- ✏️ UPDATED = Modified existing file
- 🤖 = Engineering Chatbot feature
- 💬 = Interview Suggestions feature
