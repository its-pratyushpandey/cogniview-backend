# 🚀 Quick Start Guide - Cogniview Features

This is your quick reference guide for all 13 features in the Cogniview platform.

---

## 📁 Project Structure

```
Cogniview/
├── app/
│   ├── api/                    # All API routes
│   │   ├── tutor/             # Feature 1
│   │   ├── interview/         # Features 2, 6, 9
│   │   ├── mcq/               # Feature 3
│   │   ├── aptitude/          # Feature 4
│   │   ├── chat/              # Feature 10
│   │   ├── progress/          # Feature 7
│   │   ├── company-mode/      # Feature 8
│   │   ├── revision/          # Feature 11
│   │   ├── mistakes/          # Feature 12
│   │   └── resume/            # Feature 13
│   │
│   └── (root)/                # All page routes
│       ├── tutor/
│       ├── mcq/
│       ├── aptitude/
│       ├── viva/
│       ├── answer-scoring/
│       ├── engineering-chat/
│       ├── progress/
│       ├── company-mode/
│       ├── revision/
│       ├── mistakes/
│       └── resume-prep/
│
├── components/                # All React components
│   ├── TutorChat.tsx
│   ├── MCQPractice.tsx
│   ├── AptitudeTrainer.tsx
│   ├── AIVivaChain.tsx
│   ├── AnswerQualityScoring.tsx
│   ├── EngineeringChatbot.tsx
│   ├── SubjectProgressHeatmap.tsx
│   ├── CompanyModeSettings.tsx
│   ├── InterviewSuggestions.tsx
│   ├── SmartRevisionMode.tsx
│   ├── MistakeMemorySystem.tsx
│   ├── ResumeToInterviewMapping.tsx
│   ├── Agent.tsx
│   ├── WeaknessModal.tsx
│   └── NavigationMenu.tsx
│
├── lib/
│   ├── progress-utils.ts      # Company mode logic
│   └── utils.ts
│
├── types/
│   └── index.d.ts             # All TypeScript interfaces
│
└── firebase/
    ├── client.ts
    └── admin.ts
```

---

## 🎯 Feature Quick Reference

### 1️⃣ AI Agentic Engineering Tutor
- **Route:** `/tutor`
- **Component:** `TutorChat.tsx`
- **API:** `/api/tutor`
- **Purpose:** Adaptive AI teacher for CS subjects
- **Usage:** Select subject → Enter topic → Set difficulty → Start chatting

### 2️⃣ AI Interview → Tutor Loop
- **Trigger:** Automatic after interview completion
- **Component:** `Agent.tsx` + `WeaknessModal.tsx`
- **API:** `/api/interview/analyze`
- **Purpose:** Detect weak topics and suggest tutor sessions
- **Flow:** Interview → Analysis → Modal → Tutor redirect

### 3️⃣ MCQ Generator
- **Route:** `/mcq`
- **Component:** `MCQPractice.tsx`
- **API:** `/api/mcq/generate`
- **Purpose:** Generate placement-level MCQ questions
- **Usage:** Configure settings → Generate → Practice → Review results

### 4️⃣ Aptitude Trainer
- **Route:** `/aptitude`
- **Component:** `AptitudeTrainer.tsx`
- **API:** `/api/aptitude/generate`
- **Purpose:** Reasoning and logical aptitude training
- **Usage:** Select topic → Set difficulty → Solve with hints → Review

### 5️⃣ Answer Quality Scoring
- **Route:** `/answer-scoring`
- **Component:** `AnswerQualityScoring.tsx`
- **Purpose:** Detailed quality analysis of interview answers
- **Usage:** Paste answer → Analyze → Review breakdown

### 6️⃣ AI Viva Chain
- **Route:** `/viva`
- **Component:** `AIVivaChain.tsx`
- **API:** `/api/interview/viva-chain`
- **Purpose:** Adaptive follow-up questions based on answer quality
- **Usage:** Select subject → Enter base topic → Answer adaptively

### 7️⃣ Progress Tracking Heatmap
- **Route:** `/progress`
- **Component:** `SubjectProgressHeatmap.tsx`
- **API:** `/api/progress/get-heatmap`, `/api/progress/update-progress`
- **Purpose:** Visual tracking of learning progress
- **Auto-updates:** After using any feature

### 8️⃣ Company Mode
- **Route:** `/company-mode`
- **Component:** `CompanyModeSettings.tsx`
- **API:** `/api/company-mode/preferences`
- **Utility:** `lib/progress-utils.ts`
- **Purpose:** Tailor difficulty to company type
- **Modes:** Service-Based / Product-Based / Startup

### 9️⃣ Interview Suggestions
- **Route:** `/interview/suggestions`
- **Component:** `InterviewSuggestions.tsx`
- **API:** `/api/interview/suggestions`
- **Purpose:** Post-interview improvement feedback
- **Usage:** View transcript → Analyze → Review suggestions

### 🔟 Engineering Chatbot
- **Route:** `/engineering-chat`
- **Component:** `EngineeringChatbot.tsx`
- **API:** `/api/chat/engineering-bot`
- **Purpose:** Strict CS topics expert bot
- **Allowed:** OS, DBMS, OOPS, CN, DSA
- **Forbidden:** General chat, non-CS topics

### 1️⃣1️⃣ Smart Revision Mode
- **Route:** `/revision`
- **Component:** `SmartRevisionMode.tsx`
- **API:** `/api/revision/generate`
- **Purpose:** AI-generated revision materials
- **Types:** Quick Notes / Deep Dive / Interview Q&A / Visual Cards

### 1️⃣2️⃣ Mistake Memory System
- **Route:** `/mistakes`
- **Component:** `MistakeMemorySystem.tsx`
- **API:** `/api/mistakes/create`, `/api/mistakes/update`, `/api/mistakes/due-reviews`
- **Purpose:** Spaced repetition learning from mistakes
- **Algorithm:** SM-2 (SuperMemo 2)

### 1️⃣3️⃣ Resume-to-Interview Mapping
- **Route:** `/resume-prep`
- **Component:** `ResumeToInterviewMapping.tsx`
- **API:** `/api/resume/analyze`, `/api/resume/generate-plan`
- **Purpose:** Resume analysis and interview prep plan
- **Usage:** Upload resume → Analyze → Review plan

---

## 🗄️ Firestore Collections

| Collection | Purpose | Created By |
|------------|---------|------------|
| `tutorSessions` | Tutor conversation history | Feature 1 |
| `mcqSessions` | MCQ practice history | Feature 3 |
| `aptitudeSessions` | Aptitude training history | Feature 4 |
| `vivaSessions` | Viva chain sessions | Feature 6 |
| `interviewAnalysis` | Weakness detection results | Feature 2 |
| `userProgress` | Progress tracking data | Feature 7 |
| `companyPreferences` | Company mode settings | Feature 8 |
| `revisions` | Revision materials | Feature 11 |
| `mistakeMemory` | Logged mistakes | Feature 12 |
| `spacedRepetition` | Review schedules | Feature 12 |
| `resumeAnalyses` | Resume analysis results | Feature 13 |
| `interviewPrepPlans` | Interview prep plans | Feature 13 |

---

## 🔑 Environment Variables

Create `.env.local` in the root directory:

```bash
# Gemini AI
GROQ_API_KEY=your_groq_api_key_here

# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Firebase Admin (Server-side)
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## 🚀 Quick Commands

### Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

### Testing
```bash
# Open in browser
http://localhost:3000

# Test features
http://localhost:3000/tutor
http://localhost:3000/mcq
http://localhost:3000/aptitude
# ... etc
```

---

## 🎨 Design System

### CSS Variables (globals.css)
```css
/* Colors */
--primary-500: #3b82f6
--success-500: #10b981
--error-500: #ef4444
--gray-600: #4b5563

/* Spacing */
--header-height: 80px
--container-max-width: 1200px
--border-radius: 12px

/* Shadows */
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1)

/* Animation */
--transition-normal: 300ms cubic-bezier(0.4, 0, 0.2, 1)
```

### Responsive Breakpoints
- **Mobile:** < 640px
- **Tablet:** 768px - 1024px
- **Desktop:** > 1024px

---

## 🔧 Common Development Tasks

### Adding a New Subject
**File:** Components (e.g., `MCQPractice.tsx`)

```typescript
const SUBJECTS = [
  { id: "OS", name: "Operating Systems", icon: "💻", color: "#3b82f6" },
  { id: "DBMS", name: "Database Management", icon: "🗄️", color: "#8b5cf6" },
  // Add new subject here
  { id: "NEW", name: "New Subject", icon: "🆕", color: "#10b981" },
];
```

### Modifying Company Mode Settings
**File:** `lib/progress-utils.ts`

```typescript
export const COMPANY_MODE_MODIFIERS = {
  SERVICE_BASED: {
    temperature: 0.6,      // Lower = More predictable
    difficultyMultiplier: 0.7,
    focusAreas: ["fundamentals", "theory"]
  },
  // Modify these values
};
```

### Adjusting Spaced Repetition Algorithm
**File:** `app/api/mistakes/update/route.ts`

```typescript
function calculateNextReview(quality: number, interval: number) {
  if (quality < 3) {
    return 1; // Review tomorrow
  }
  // Modify SM-2 algorithm here
}
```

---

## 🐛 Troubleshooting

### Issue: Features not loading
**Check:**
1. Environment variables in `.env.local`
2. Firebase configuration
3. Gemini API key validity
4. Console for JavaScript errors

### Issue: API errors
**Check:**
1. API key has correct permissions
2. Gemini API quota not exceeded
3. Network connectivity
4. CORS settings (if deployed)

### Issue: Firestore not saving
**Check:**
1. Firebase authentication working
2. Firestore security rules allow writes
3. Collection names match exactly
4. User ID is valid

### Issue: Responsive design broken
**Check:**
1. CSS media queries in `globals.css`
2. Tailwind breakpoint classes (`sm:`, `md:`, `lg:`)
3. Container max-width settings
4. Viewport meta tag in layout

---

## 📚 Feature Integration Map

```
┌─────────────────────────────────────────────────────┐
│                   COGNIVIEW PLATFORM                │
└─────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌─────▼─────┐      ┌────▼────┐
   │ AI Tutor│      │ Interview │      │ Progress│
   │Feature 1│◄─────┤  Feature 2│─────►│Feature 7│
   └────┬────┘      └─────┬─────┘      └────▲────┘
        │                 │                  │
        │           ┌─────▼─────┐           │
        │           │  Viva     │           │
        │           │ Feature 6 │           │
        │           └─────┬─────┘           │
        │                 │                  │
        │           ┌─────▼─────┐           │
        │           │Suggestions│           │
        │           │ Feature 9 │           │
        │           └───────────┘           │
        │                                    │
   ┌────▼────┐                         ┌────┴────┐
   │   MCQ   │                         │ Company │
   │Feature 3├────────────────────────►│  Mode   │
   └─────────┘                         │Feature 8│
                                       └────▲────┘
   ┌─────────┐                              │
   │Aptitude │                              │
   │Feature 4├──────────────────────────────┘
   └─────────┘

   ┌─────────────┐
   │   Revision  │
   │  Feature 11 │ (Independent)
   └─────────────┘

   ┌─────────────┐
   │   Mistakes  │
   │  Feature 12 │ (Independent)
   └─────────────┘

   ┌─────────────┐
   │   Resume    │
   │  Feature 13 │ (Independent)
   └─────────────┘

   ┌─────────────┐
   │ Engineering │
   │    Chat     │ (Independent)
   │  Feature 10 │
   └─────────────┘

   ┌─────────────┐
   │   Answer    │
   │  Scoring    │ (Independent)
   │  Feature 5  │
   └─────────────┘
```

---

## 📊 Feature Usage Flow

### Typical User Journey

1. **Sign Up/Sign In** → `/sign-up` or `/sign-in`
2. **Set Company Mode** → `/company-mode` (Optional but recommended)
3. **Take Interview** → `/interview` → Triggers Feature 2 (Weakness Detection)
4. **Guided to Tutor** → `/tutor` → Learn weak topics
5. **Practice MCQs** → `/mcq` → Test knowledge
6. **Log Mistakes** → `/mistakes` → Schedule reviews
7. **Check Progress** → `/progress` → View heatmap
8. **Revise Topics** → `/revision` → Generate materials
9. **Aptitude Training** → `/aptitude` → Practice reasoning
10. **Resume Prep** → `/resume-prep` → Interview preparation

---

## 🔐 Security Checklist

Before deploying to production:

- [ ] Environment variables not committed to Git
- [ ] Firebase security rules configured
- [ ] API keys have proper restrictions
- [ ] CORS configured for production domain
- [ ] Input validation on all forms
- [ ] XSS protection enabled
- [ ] Rate limiting implemented
- [ ] Error messages don't expose sensitive info

---

## 📈 Performance Optimization Tips

1. **Lazy Loading**
   ```typescript
   const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
     loading: () => <Spinner />,
     ssr: false
   });
   ```

2. **Memoization**
   ```typescript
   const memoizedValue = useMemo(() => expensiveFunction(), [dependency]);
   ```

3. **Image Optimization**
   ```typescript
   import Image from 'next/image';
   <Image src="/image.jpg" width={500} height={300} alt="Description" />
   ```

4. **API Response Caching**
   - Implement Redis or Next.js cache
   - Cache Firestore queries
   - Set appropriate TTL values

---

## 🎓 Learning Resources

### For Understanding the Codebase
1. **Next.js Docs:** https://nextjs.org/docs
2. **Firebase Docs:** https://firebase.google.com/docs
3. **Gemini AI Docs:** https://ai.google.dev/docs
4. **Framer Motion:** https://www.framer.com/motion/
5. **GSAP:** https://greensock.com/docs/

### For Contributing
1. Read `COMPREHENSIVE_FEATURE_AUDIT.md` first
2. Use `TESTING_CHECKLIST.md` before submitting changes
3. Follow existing code patterns
4. Add comments for complex logic
5. Update TypeScript types in `types/index.d.ts`

---

## 🆘 Getting Help

### Common Questions

**Q: How do I add a new feature?**
A: 
1. Create API route in `app/api/new-feature/route.ts`
2. Create component in `components/NewFeature.tsx`
3. Add page route in `app/(root)/new-feature/page.tsx`
4. Update navigation in `components/NavigationMenu.tsx`
5. Add TypeScript types in `types/index.d.ts`

**Q: How do I modify AI prompts?**
A: Prompts are in API route files (e.g., `app/api/tutor/route.ts`). Search for variables ending with `_PROMPT`.

**Q: How do I change the UI theme?**
A: Modify CSS variables in `app/globals.css` under the `:root` selector.

**Q: How do I test locally?**
A: Run `npm run dev` and use the `TESTING_CHECKLIST.md` as a guide.

---

## 📞 Support

For issues or questions:
1. Check console for errors (F12 in browser)
2. Review `COMPREHENSIVE_FEATURE_AUDIT.md`
3. Use `TESTING_CHECKLIST.md` to verify setup
4. Check Firebase console for data issues
5. Verify Gemini API key and quota

---

**Last Updated:** $(Get-Date)
**Version:** 1.0
**Maintained By:** Cogniview Development Team
