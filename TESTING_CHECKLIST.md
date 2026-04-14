# ✅ Feature Testing Checklist

Use this checklist to manually verify all features are working correctly.

---

## 🔐 Pre-Testing Setup

- [ ] Environment variables configured in `.env.local`
  ```bash
  GROQ_API_KEY=your_key_here
  NEXT_PUBLIC_FIREBASE_API_KEY=...
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
  NEXT_PUBLIC_FIREBASE_APP_ID=...
  ```

- [ ] Dependencies installed (`npm install`)
- [ ] Development server running (`npm run dev`)
- [ ] Firebase console accessible
- [ ] Test user account created

---

## 🧪 FEATURE 1: AI Agentic Engineering Tutor

**Route:** `/tutor`

### Setup Phase
- [ ] Page loads without errors
- [ ] Subject selector displays (OS, DBMS, OOPS, CN, DSA)
- [ ] Topic input field visible
- [ ] Difficulty selector working (Beginner/Intermediate/Advanced)
- [ ] "Start Session" button clickable

### Chat Phase
- [ ] Chat interface loads after starting session
- [ ] AI responds to first message
- [ ] Messages appear in correct order (user vs assistant)
- [ ] New messages can be sent
- [ ] Session saves to Firestore `tutorSessions` collection
- [ ] Difficulty level adjusts based on responses

### Mobile Test
- [ ] Chat input stays above keyboard on mobile
- [ ] Messages scroll properly
- [ ] Subject selector cards stack vertically

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 FEATURE 2: AI Interview → Tutor Loop

**Route:** `/interview` → Auto-triggers after interview

### Interview Phase
- [ ] Complete a test interview
- [ ] Interview ends successfully
- [ ] Wait for 1-2 seconds after completion

### Weakness Detection
- [ ] Modal automatically appears
- [ ] Detected weaknesses displayed
- [ ] Severity shown (HIGH/MEDIUM/LOW)
- [ ] "Go to Tutor" button visible
- [ ] Clicking button redirects to `/tutor` with pre-filled topic

### Data Persistence
- [ ] Check Firestore `interviewAnalysis` collection
- [ ] Weakness data saved correctly
- [ ] Timestamp recorded

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 FEATURE 3: MCQ Generator

**Route:** `/mcq`

### Setup Phase
- [ ] Subject cards display with icons
- [ ] Topic input accepts text
- [ ] Question count selector (1-20)
- [ ] Difficulty dropdown works
- [ ] Company type selector (Service/Product/Startup)
- [ ] Focus type selector (Conceptual/Tricky/GATE/Company)
- [ ] "Generate MCQs" button clickable

### Practice Phase
- [ ] Questions load after generation
- [ ] Question number indicator shows (1/5, 2/5, etc.)
- [ ] Timer counts down (120 seconds)
- [ ] Options are clickable
- [ ] Explanation shows after selection
- [ ] "Next Question" button works
- [ ] Progress bar updates

### Results Phase
- [ ] Final score displayed
- [ ] Accuracy percentage calculated
- [ ] Time taken shown
- [ ] Review answers button works
- [ ] Session saves to Firestore `mcqSessions`

### Mobile Test
- [ ] Question cards fit on screen
- [ ] Options are tappable without zoom
- [ ] Explanation modal scrollable

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 FEATURE 4: Aptitude Trainer

**Route:** `/aptitude`

### Setup Phase
- [ ] Topic selector displays 8 types:
  - Time & Work
  - Time, Speed & Distance
  - Probability
  - Permutation & Combination
  - Number Series
  - Puzzles & Logical Reasoning
  - Seating Arrangement
  - Data Interpretation
- [ ] Difficulty selector works
- [ ] "Generate Problem" button clickable

### Problem Solving Phase
- [ ] Problem statement displays clearly
- [ ] Hint button available
- [ ] Hints reveal progressively (1 → 2 → 3)
- [ ] Answer input field accepts text
- [ ] "Submit Answer" button works
- [ ] Timer shows elapsed time

### Feedback Phase
- [ ] Correct/Incorrect feedback shown
- [ ] Solution with multiple methods displayed
- [ ] Time comparison (your time vs expected)
- [ ] Learning tip provided
- [ ] "Next Problem" button works

### History
- [ ] Performance history visible
- [ ] Success rate calculated
- [ ] Average time shown
- [ ] Common mistakes tracked

### Mobile Test
- [ ] Problem text readable without zoom
- [ ] Hint buttons easily tappable
- [ ] Solution scrollable

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 FEATURE 5: Answer Quality Scoring

**Route:** `/answer-scoring`

### Analysis Phase
- [ ] Page loads with analysis interface
- [ ] Text area for answer input visible
- [ ] Subject/topic selectors work
- [ ] "Analyze Answer" button clickable

### Scoring Display
- [ ] Overall score displayed (0-10)
- [ ] 4 dimension scores shown:
  - Technical Depth
  - Clarity & Structure
  - Completeness
  - Communication
- [ ] Each dimension has colored bar
- [ ] Strengths section populated
- [ ] Improvements section populated
- [ ] Detailed feedback provided

### Mobile Test
- [ ] Score cards stack vertically
- [ ] Bar charts visible and proportional
- [ ] Text sections readable

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 FEATURE 6: AI Viva Chain

**Route:** `/viva`

### Setup Phase
- [ ] Subject selector displays (OS, DBMS, OOPS, CN, DSA)
- [ ] Base topic input field visible
- [ ] "Start Viva Session" button clickable

### Viva Session
- [ ] First question generated
- [ ] Current difficulty shown (1-10 scale)
- [ ] Answer input field visible
- [ ] "Submit Answer" button works
- [ ] Evaluation appears after submission
- [ ] Next question adapts based on answer quality

### Adaptive Behavior
- [ ] Difficulty increases after good answer
- [ ] Difficulty decreases after poor answer
- [ ] Questions stay at same difficulty for average answer
- [ ] Stats update: Good/Average/Poor counts

### Session End
- [ ] End session button visible
- [ ] Final stats displayed
- [ ] Session saves to Firestore `vivaSessions`

### Mobile Test
- [ ] Question text readable
- [ ] Answer input accessible
- [ ] Stats display properly

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 FEATURE 7: Progress Tracking Heatmap

**Route:** `/progress`

### Heatmap Display
- [ ] Heatmap grid visible
- [ ] Each cell represents a day
- [ ] Cell colors vary by activity level:
  - Light color = Low activity
  - Medium color = Medium activity
  - Dark color = High activity
- [ ] Dates labeled correctly
- [ ] Current week highlighted

### Subject Breakdown
- [ ] List of subjects with mastery levels
- [ ] Progress bars for each subject
- [ ] Weak topics identified
- [ ] Recent activity count shown

### Data Integration
- [ ] Heatmap updates after using other features
- [ ] Check: Complete a tutor session → Refresh progress → Cell colors update
- [ ] Check: Do MCQ practice → Refresh progress → Subject mastery increases

### Mobile Test
- [ ] Heatmap scrollable horizontally
- [ ] Cell tooltips work on tap
- [ ] Subject cards stack vertically

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 FEATURE 8: Company Mode

**Route:** `/company-mode`

### Mode Selection
- [ ] 3 mode cards displayed:
  - Service-Based (TCS, Infosys, Wipro)
  - Product-Based (Google, Amazon, Microsoft)
  - Startup (Fast-paced, Full-stack)
- [ ] Each card shows description
- [ ] Selection highlights card
- [ ] "Save Preference" button works

### Mode Effects Test
**Test each mode's impact on AI difficulty:**

#### Service-Based Mode
- [ ] Set preference to Service-Based
- [ ] Generate MCQs → Questions should be moderate difficulty
- [ ] Start tutor session → Explanations should be detailed and structured

#### Product-Based Mode
- [ ] Set preference to Product-Based
- [ ] Generate MCQs → Questions should be harder, tricky
- [ ] Start tutor session → Focus on optimization and edge cases

#### Startup Mode
- [ ] Set preference to Startup
- [ ] Generate MCQs → Questions should be practical, full-stack oriented
- [ ] Start tutor session → Fast-paced, multi-topic coverage

### Data Persistence
- [ ] Preference saves to Firestore `companyPreferences`
- [ ] Preference persists after page reload
- [ ] Mode applies to all features automatically

### Mobile Test
- [ ] Mode cards stack vertically
- [ ] Descriptions readable
- [ ] Save button accessible

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 FEATURE 9: Interview Suggestions

**Route:** `/interview/suggestions` (or from interview feedback page)

### Analysis Trigger
- [ ] Complete a test interview
- [ ] Navigate to suggestions page
- [ ] "Analyze & Suggest Improvements" button visible
- [ ] Loading state shows during analysis

### Suggestions Display
- [ ] Multiple suggestion cards appear
- [ ] Each card shows:
  - Question Asked
  - Your Answer
  - Issues Detected (list)
  - Model Answer
  - Rephrasing Suggestion
  - Additional Concepts to mention
  - Improvement Score (0-10)
- [ ] Cards are expandable/collapsible
- [ ] Overall feedback section visible
- [ ] Key areas for improvement listed

### Interaction
- [ ] Expand button works
- [ ] Copy button works for model answer
- [ ] Improvement score color-coded:
  - Green (8-10)
  - Blue (6-8)
  - Orange (4-6)
  - Red (0-4)

### Mobile Test
- [ ] Suggestion cards stack vertically
- [ ] Expandable sections work smoothly
- [ ] Text is readable without zoom

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 FEATURE 10: Engineering Chatbot

**Route:** `/engineering-chat`

### Chat Interface
- [ ] Chat window loads
- [ ] Input field visible
- [ ] Send button works
- [ ] Message history displays

### Topic Validation (ON-TOPIC)
Test with these questions:
- [ ] "Explain deadlock in OS" → Should answer
- [ ] "What is normalization in DBMS?" → Should answer
- [ ] "Difference between stack and queue" → Should answer
- [ ] "What is TCP handshake?" → Should answer
- [ ] "Explain polymorphism in OOP" → Should answer

### Topic Validation (OFF-TOPIC)
Test with these questions:
- [ ] "What's the weather today?" → Should reject with exact message
- [ ] "Tell me a joke" → Should reject
- [ ] "How to invest in stocks?" → Should reject
- [ ] "Help me with my history homework" → Should reject
- [ ] Off-topic message: "I only help with engineering placement topics..."

### Context Awareness
- [ ] Ask follow-up questions (last 5 messages remembered)
- [ ] Bot references previous messages
- [ ] Clear conversation button works

### Mobile Test
- [ ] Chat input above keyboard
- [ ] Messages scroll smoothly
- [ ] Send button always visible

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 FEATURE 11: Smart Revision Mode

**Route:** `/revision`

### Setup Phase
- [ ] Subject selector displays with color-coded cards
- [ ] Weak topics input visible (optional)
- [ ] 4 revision type cards displayed:
  - 🗒️ Quick Notes
  - 📚 Deep Dive
  - 🎯 Interview Q&A
  - 🃏 Visual Cards
- [ ] Each card shows description
- [ ] Selection highlights card

### Generation Phase
- [ ] "Generate Revision Material" button works
- [ ] Loading state shows during generation
- [ ] Material appears in result area
- [ ] Content formatted properly (markdown)

### Type-Specific Content
Test each type:
- [ ] **Quick Notes:** Bullet points, concise summary
- [ ] **Deep Dive:** Detailed explanations, examples
- [ ] **Interview Q&A:** Question-answer format
- [ ] **Visual Cards:** Flashcard-style content

### History Panel
- [ ] History panel shows past revisions
- [ ] Search bar filters history
- [ ] Click on history item loads content
- [ ] Delete button removes items

### Actions
- [ ] Copy to clipboard works
- [ ] Download option (if implemented)
- [ ] Regenerate creates new version

### Mobile Test
- [ ] Type cards stack vertically
- [ ] Content scrollable
- [ ] History panel accessible

### GSAP Animation Test
- [ ] Cards animate in with stagger effect on page load
- [ ] Smooth entrance animation (no flickering)

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 FEATURE 12: Mistake Memory System

**Route:** `/mistakes`

### Log Mistake Phase
- [ ] "Log New Mistake" button visible
- [ ] Form displays:
  - Subject selector
  - Concept input
  - What went wrong (textarea)
  - Correct explanation (textarea)
- [ ] "Save Mistake" button works
- [ ] Mistake saves to Firestore

### Due Reviews Section
- [ ] "Due Reviews" section visible
- [ ] Count of due reviews shown
- [ ] "Load Due Reviews" button works
- [ ] AI-generated questions appear for each review

### Review Process
- [ ] Question displayed for a due mistake
- [ ] Answer input field visible
- [ ] Quality rating buttons (0-5)
- [ ] Submit review button works

### SM-2 Algorithm Test
**Test spaced repetition scheduling:**
- [ ] Rate 0-2 → Next review: 1 day
- [ ] Rate 3 → Next review: 2-3 days
- [ ] Rate 4 → Next review: 5-7 days
- [ ] Rate 5 → Next review: 10+ days
- [ ] Check Firestore `spacedRepetition` for updated `nextReviewDate`

### Review History
- [ ] Past reviews listed
- [ ] Filter by subject works
- [ ] Each review shows:
  - Concept name
  - Last reviewed date
  - Mastery level
  - Times reviewed

### Mobile Test
- [ ] Form fields stack vertically
- [ ] Rating buttons easily tappable
- [ ] Review history scrollable

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 FEATURE 13: Resume-to-Interview Mapping

**Route:** `/resume-prep`

### File Upload
- [ ] Upload area visible
- [ ] Drag-and-drop works
- [ ] "Choose File" button works
- [ ] Accepted formats: PDF, TXT, DOCX
- [ ] Upload progress shows

### Analysis Phase
- [ ] After upload, analysis starts automatically
- [ ] Loading state displays
- [ ] Analysis completes in 5-10 seconds

### Resume Analysis Tab
- [ ] Extracted information displayed:
  - Skills (Technical, Soft, Tools)
  - Projects
  - Education
  - Experience
  - Certifications
- [ ] Information organized in sections
- [ ] Visual skill category breakdown

### Skills Breakdown Tab
- [ ] Skills categorized:
  - Programming Languages
  - Frameworks
  - Databases
  - Tools
  - Concepts
- [ ] Each category has count
- [ ] Proficiency levels shown (if detected)

### Interview Plan Tab
- [ ] Project-based questions generated
- [ ] Questions grouped by project
- [ ] Depth questions included (from skills)
- [ ] Suggested prep order provided
- [ ] Time estimates for prep

### Actions
- [ ] Export plan as PDF (if implemented)
- [ ] Copy questions to clipboard
- [ ] Generate new plan button works

### Data Persistence
- [ ] Analysis saves to Firestore `resumeAnalyses`
- [ ] Plan saves to Firestore `interviewPrepPlans`
- [ ] Past analyses accessible

### Mobile Test
- [ ] Tab navigation works
- [ ] Content sections readable
- [ ] Upload interface accessible

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 NAVIGATION MENU TEST

### Desktop Navigation
- [ ] All 13 features listed in menu
- [ ] Icons display correctly
- [ ] Active page highlighted
- [ ] Hover effects work
- [ ] Badges show ("NEW", "🔥")
- [ ] Descriptions visible on hover

### Mobile Navigation
- [ ] Hamburger menu button visible
- [ ] Menu opens on tap
- [ ] All items accessible
- [ ] Menu closes on selection
- [ ] Animation smooth (Framer Motion)

### Menu Items Checklist
- [ ] 🏠 Home
- [ ] 🎤 AI Interview
- [ ] 🎓 AI Tutor
- [ ] 🧠 Smart Revision (🔥 badge)
- [ ] 🎯 Mistake Memory (🔥 badge)
- [ ] 📄 Resume Prep (🔥 badge)
- [ ] 📝 MCQ Practice
- [ ] 🧮 Aptitude Trainer
- [ ] 📊 Answer Scoring
- [ ] 💡 AI Viva
- [ ] 📈 Progress
- [ ] 🏢 Company Mode
- [ ] 🤖 Engineering Chat

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 RESPONSIVE DESIGN TEST

### Desktop (1920x1080)
- [ ] Layout uses full width up to container max-width
- [ ] No horizontal scroll
- [ ] Cards display in multi-column grid
- [ ] Navigation menu shows all items
- [ ] No overlapping elements

### Tablet (768x1024)
- [ ] Layout adjusts to tablet width
- [ ] Cards reorganize to 2 columns
- [ ] Text remains readable
- [ ] Buttons accessible
- [ ] No content cutoff

### Mobile (375x667)
- [ ] Single column layout
- [ ] Touch targets ≥44px
- [ ] Forms stack vertically
- [ ] No tiny text (<14px)
- [ ] Hamburger menu replaces desktop nav
- [ ] Chat inputs above keyboard

### Breakpoint Tests
Test these specific widths:
- [ ] 480px (Small mobile)
- [ ] 640px (Tailwind sm)
- [ ] 768px (Tailwind md / Tablet)
- [ ] 1024px (Tailwind lg / Desktop)
- [ ] 1280px (Tailwind xl)

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 CROSS-BROWSER TEST

### Chrome/Edge
- [ ] All features work
- [ ] Animations smooth
- [ ] No console errors

### Firefox
- [ ] All features work
- [ ] Framer Motion animations work
- [ ] GSAP animations work

### Safari (iOS)
- [ ] All features work
- [ ] Date inputs work
- [ ] File uploads work
- [ ] Animations smooth

### Mobile Browsers
- [ ] Chrome Mobile
- [ ] Safari Mobile
- [ ] Samsung Internet

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 PERFORMANCE TEST

### Page Load Times
- [ ] Home page: <2 seconds
- [ ] Feature pages: <3 seconds
- [ ] Chat interfaces: <2 seconds

### API Response Times
- [ ] Tutor API: <3 seconds
- [ ] MCQ Generation: <5 seconds
- [ ] Resume Analysis: <8 seconds
- [ ] Interview Suggestions: <5 seconds

### Lighthouse Scores (Target)
- [ ] Performance: >80
- [ ] Accessibility: >90
- [ ] Best Practices: >90
- [ ] SEO: >90

**Run:** `npm run build` → Deploy → Test with Lighthouse

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 FIREBASE INTEGRATION TEST

### Firestore Collections Verification
Check Firebase Console → Firestore Database:

- [ ] `tutorSessions` - Has documents after tutor use
- [ ] `mcqSessions` - Has documents after MCQ practice
- [ ] `aptitudeSessions` - Has documents after aptitude training
- [ ] `vivaSessions` - Has documents after viva session
- [ ] `interviewAnalysis` - Has documents after interview analysis
- [ ] `userProgress` - Has documents with progress data
- [ ] `companyPreferences` - Has user company mode selection
- [ ] `revisions` - Has revision materials
- [ ] `mistakeMemory` - Has logged mistakes
- [ ] `spacedRepetition` - Has review schedules
- [ ] `resumeAnalyses` - Has resume analysis results
- [ ] `interviewPrepPlans` - Has interview prep plans

### Document Structure Validation
For each collection, check:
- [ ] userId field present
- [ ] Timestamps (createdAt, updatedAt) present
- [ ] Required fields populated
- [ ] Data types correct (string, number, array, object)

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 AUTHENTICATION FLOW TEST

### Sign Up
- [ ] Navigate to `/sign-up`
- [ ] Form validation works
- [ ] Account creation successful
- [ ] Redirects to home after signup

### Sign In
- [ ] Navigate to `/sign-in`
- [ ] Email/password login works
- [ ] Remember me checkbox (if implemented)
- [ ] Redirects to intended page after login

### Protected Routes
- [ ] Accessing `/tutor` without login → Redirects to sign-in
- [ ] Accessing `/mcq` without login → Redirects to sign-in
- [ ] After login → Redirects back to original destination

### Sign Out
- [ ] Sign out button works
- [ ] Session cleared
- [ ] Redirects to home or sign-in

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 🧪 ERROR HANDLING TEST

### API Errors
- [ ] Invalid API key → Error message shown (not raw error)
- [ ] Network timeout → User-friendly message
- [ ] Gemini API rate limit → Handled gracefully

### Form Validation
- [ ] Empty required fields → Validation error shown
- [ ] Invalid email format → Error message
- [ ] File upload errors → Helpful message

### Firestore Errors
- [ ] Connection error → Handled gracefully
- [ ] Permission denied → Appropriate message
- [ ] Document not found → Fallback UI

**Status:** ⬜ Pass / ⬜ Fail / ⬜ Not Tested

---

## 📊 TESTING SUMMARY

Fill this out after completing all tests:

### Overall Results
- **Total Features:** 13
- **Features Passed:** ___/13
- **Features Failed:** ___/13
- **Features Not Tested:** ___/13

### Critical Issues Found
1. 
2. 
3. 

### Minor Issues Found
1. 
2. 
3. 

### Performance Notes
- Average page load time: ___ seconds
- Average API response time: ___ seconds
- Lighthouse performance score: ___

### Browser Compatibility
- Chrome: ⬜ Pass / ⬜ Fail
- Firefox: ⬜ Pass / ⬜ Fail
- Safari: ⬜ Pass / ⬜ Fail
- Mobile: ⬜ Pass / ⬜ Fail

### Responsive Design
- Desktop (1920px): ⬜ Pass / ⬜ Fail
- Tablet (768px): ⬜ Pass / ⬜ Fail
- Mobile (375px): ⬜ Pass / ⬜ Fail

### Recommendation
⬜ **READY FOR PRODUCTION** - All tests passed, minor issues only
⬜ **NEEDS FIXES** - Some features have issues, fix before production
⬜ **NOT READY** - Critical issues found, requires significant work

---

**Testing Completed By:** _______________
**Date:** _______________
**Time Taken:** ___ hours
**Notes:**
