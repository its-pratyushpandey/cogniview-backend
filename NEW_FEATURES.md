# 🚀 New Features Documentation

## Overview
This document details two powerful new features added to Cogniview to enhance the interview preparation experience.

---

## 📊 Feature 1: Answer Quality Scoring

### Description
Provides comprehensive scoring and analysis of interview answers with detailed breakdowns across multiple quality dimensions.

### Location
- **URL**: `/answer-scoring`
- **Component**: `components/AnswerQualityScoring.tsx`
- **API**: `app/api/interview/score-answers/route.ts`

### How It Works

1. **Input**: Accepts interview transcript (JSON format)
2. **Analysis**: Uses Gemini 2.0 Flash AI to evaluate each answer across 4 dimensions:
   - **Technical Correctness** (0-10): Accuracy of technical concepts
   - **Terminology Usage** (0-10): Proper use of industry terms
   - **Depth of Explanation** (0-10): Completeness and detail
   - **Interview Readiness** (0-10): Communication and confidence

3. **Output**: 
   - Overall statistics (total questions, average score, highest/lowest)
   - Score breakdown for each dimension
   - Per-answer detailed analysis
   - Strengths, weaknesses, and improvement suggestions
   - Model answers for comparison

### Usage Example

```typescript
// Navigate with transcript data
const transcript = [
  {
    question: "What is polymorphism in OOP?",
    answer: "Polymorphism allows objects to take multiple forms..."
  }
];

router.push(`/answer-scoring?transcript=${encodeURIComponent(JSON.stringify(transcript))}`);
```

### UI Features

- ✅ Color-coded scoring (Green 8-10, Blue 6-8, Orange 4-6, Red 0-4)
- ✅ Expandable answer cards
- ✅ Progress bars for each dimension
- ✅ Mini-score grids for quick overview
- ✅ Smooth animations with Framer Motion
- ✅ Fully responsive design
- ✅ Print-friendly layout

### API Endpoint

**POST** `/api/interview/score-answers`

```json
{
  "transcript": [
    {
      "question": "string",
      "answer": "string"
    }
  ]
}
```

**Response:**
```json
{
  "overallStats": {
    "totalQuestions": 5,
    "averageScore": 7.5,
    "highestScore": 9.2,
    "lowestScore": 5.8
  },
  "dimensionScores": {
    "technicalCorrectness": 8.0,
    "terminologyUsage": 7.5,
    "depthOfExplanation": 7.2,
    "interviewReadiness": 7.3
  },
  "answers": [...],
  "recommendations": [...]
}
```

---

## 💡 Feature 2: AI Viva Chain (Adaptive Questioning)

### Description
An intelligent questioning system that adapts difficulty and follow-up questions based on answer quality. Creates a realistic viva-voce experience with real-time evaluation.

### Location
- **URL**: `/viva`
- **Component**: `components/AIVivaChain.tsx`
- **API**: `app/api/interview/viva-chain/route.ts`

### How It Works

1. **Setup**: User enters subject and topic
2. **Initial Question**: AI generates base question
3. **Adaptive Flow**:
   - **Good Answer (7-10)** → Harder follow-up question
   - **Average Answer (4-6)** → Clarification question
   - **Poor Answer (0-3)** → Simpler related question

4. **Real-time Evaluation**:
   - Quality assessment (GOOD/AVERAGE/POOR)
   - Score out of 10
   - Reasoning for evaluation
   - Key issues identified

### Usage Example

```typescript
// Component automatically initializes on page load
// User flow:
// 1. Enter subject: "Operating Systems"
// 2. Enter topic: "Process Synchronization"
// 3. Answer questions as they appear
// 4. Receive instant feedback
// 5. Continue with adaptive follow-ups
```

### Features

- ✅ **5 Question Types**:
  - BASE: Initial fundamental questions
  - FOLLOWUP: Deeper probing based on good answers
  - TRAP: Questions to test conceptual clarity
  - SCENARIO: Practical application questions
  - CLARIFICATION: Questions to address misunderstandings

- ✅ **Progressive Hint System**:
  - Hints reveal one at a time
  - Keyword suggestions for guidance
  - Expected concepts displayed

- ✅ **Session Tracking**:
  - Saves to Firestore (`vivaSessions` collection)
  - Tracks all questions and evaluations
  - Stores performance metrics

- ✅ **Live Stats Display**:
  - Questions asked count
  - Good/Average/Poor answer counts
  - Current difficulty level

### API Endpoint

**POST** `/api/interview/viva-chain`

```json
{
  "subject": "Operating Systems",
  "topic": "Deadlocks",
  "previousQuestion": "What is deadlock?",
  "previousAnswer": "A situation where processes wait indefinitely...",
  "conversationHistory": [...],
  "userId": "user123"
}
```

**Response:**
```json
{
  "question": {
    "text": "How would you detect a deadlock?",
    "type": "FOLLOWUP",
    "difficulty": "MEDIUM",
    "hints": ["Think about resource graphs", "Consider wait-for cycles"],
    "expectedKeywords": ["Resource Allocation Graph", "Cycle Detection"]
  },
  "evaluation": {
    "quality": "GOOD",
    "score": 8,
    "reasoning": "Clear understanding demonstrated...",
    "keyIssues": []
  }
}
```

### Database Schema (Firestore)

Collection: `vivaSessions`

```typescript
{
  userId: string;
  subject: string;
  topic: string;
  questions: VivaQuestion[];
  evaluations: VivaEvaluation[];
  startedAt: Timestamp;
  lastUpdatedAt: Timestamp;
  stats: {
    totalQuestions: number;
    goodAnswers: number;
    averageAnswers: number;
    poorAnswers: number;
  }
}
```

---

## 🎨 UI/UX Features

### Design Principles
- **Professional**: Clean, modern interface with gradient accents
- **Responsive**: Works seamlessly on mobile, tablet, and desktop
- **Animated**: Smooth Framer Motion animations for all interactions
- **Intuitive**: Clear visual hierarchy and user flow

### Color Coding
- **Green** (#10b981): Excellent (8-10), Good answers
- **Blue** (#3b82f6): Good (6-8), Primary actions
- **Orange** (#f59e0b): Average (4-6), Warnings
- **Red** (#ef4444): Poor (0-4), Critical issues
- **Purple** (#8b5cf6): Special features, hints

### Animations
- **Fade In**: Page load and element reveal
- **Slide Up**: Cards and sections
- **Scale**: Buttons and interactive elements
- **Expand/Collapse**: Answer details
- **Progress Bars**: Score visualization

---

## 🔧 Technical Details

### Technologies Used
- **Next.js 15**: App Router, Server Actions
- **TypeScript**: Full type safety
- **Gemini AI**: Answer analysis and question generation
- **Firestore**: Session persistence
- **Framer Motion**: Animations
- **React Hooks**: State management

### Performance Optimizations
- Debounced API calls
- Lazy loading of answer details
- Optimistic UI updates
- Efficient re-renders with React.memo
- Progressive hint loading

### Security
- Server-side authentication checks
- Input sanitization
- Rate limiting on API routes
- Firestore security rules

---

## 📱 Responsive Breakpoints

```css
/* Mobile */
@media (max-width: 768px) {
  - Single column layouts
  - Full-width buttons
  - Stacked stats
  - Adjusted font sizes
}

/* Tablet */
@media (min-width: 769px) and (max-width: 1024px) {
  - Two-column grids
  - Balanced layouts
}

/* Desktop */
@media (min-width: 1025px) {
  - Multi-column grids
  - Expanded layouts
  - Full animations
}
```

---

## 🚀 Future Enhancements

### Answer Quality Scoring
- [ ] Export reports as PDF
- [ ] Historical score tracking
- [ ] Comparison with peers
- [ ] Video recording integration

### AI Viva Chain
- [ ] Voice input/output
- [ ] Multi-subject sessions
- [ ] Collaborative vivas
- [ ] Leaderboard system
- [ ] Custom question banks

---

## 🐛 Troubleshooting

### Issue: "No transcript data available"
**Solution**: Ensure transcript is passed as URL parameter in correct JSON format

### Issue: API timeout
**Solution**: Check Gemini API key in environment variables

### Issue: Session not saving
**Solution**: Verify Firebase configuration and Firestore rules

### Issue: Animations not working
**Solution**: Ensure Framer Motion is installed: `npm install framer-motion`

---

## 📚 Related Files

### Answer Quality Scoring
- [AnswerQualityScoring.tsx](components/AnswerQualityScoring.tsx)
- [score-answers/route.ts](app/api/interview/score-answers/route.ts)
- [answer-scoring/page.tsx](app/(root)/answer-scoring/page.tsx)

### AI Viva Chain
- [AIVivaChain.tsx](components/AIVivaChain.tsx)
- [viva-chain/route.ts](app/api/interview/viva-chain/route.ts)
- [viva/page.tsx](app/(root)/viva/page.tsx)

### Shared
- [types/index.d.ts](types/index.d.ts) - TypeScript definitions
- [globals.css](app/globals.css) - Styling

---

## 👥 Credits

Developed with ❤️ for Cogniview
Powered by Gemini AI & Firebase

---

## 📞 Support

For issues or feature requests, please check:
1. This documentation
2. TypeScript type definitions
3. API endpoint documentation
4. Console error messages

---

*Last Updated: December 2024*
