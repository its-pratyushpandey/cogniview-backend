# 📊 Subject Progress Heatmap & 🎯 Company-Oriented Preparation

## Overview
This document details two powerful new features added to Cogniview to enhance the learning experience with visual progress tracking and company-targeted preparation.

---

## 📊 Feature 7: Subject Progress Heatmap

### Description
A comprehensive visual heatmap that tracks your mastery level across all subjects (OS, DBMS, OOPS, CN, DSA) and their individual topics. Uses color-coding to instantly identify strong and weak areas.

### Location
- **URL**: `/progress`
- **Component**: `components/SubjectProgressHeatmap.tsx`
- **APIs**: 
  - `app/api/progress/get-heatmap/route.ts` (GET)
  - `app/api/progress/update-progress/route.ts` (POST)

### How It Works

#### Progress Tracking Algorithm
```typescript
const calculateTopicStatus = (successRate: number, attempts: number) => {
  if (attempts === 0) return { status: "NOT_ATTEMPTED", color: "gray" };
  if (successRate >= 75) return { status: "STRONG", color: "green" };
  if (successRate >= 50) return { status: "MODERATE", color: "yellow" };
  return { status: "WEAK", color: "red" };
};
```

#### Database Schema (Firestore)
Collection: `userProgress`

```typescript
{
  userId: string;
  subject: "OS" | "DBMS" | "OOPS" | "CN" | "DSA";
  topics: {
    [topicName: string]: {
      attempts: number;
      successRate: number; // 0-100
      lastAttemptDate: string;
      averageScore: number;
      status: "STRONG" | "MODERATE" | "WEAK" | "NOT_ATTEMPTED";
      color: "green" | "yellow" | "red" | "gray";
    }
  };
  overallStrength: number; // 0-100
  updatedAt: string;
}
```

### Features

#### 1. Multi-Subject View
- Quick-switch between OS, DBMS, OOPS, CN, DSA
- Overall strength percentage for each subject
- Color-coded subject pills

#### 2. Visual Heatmap Grid
- **Green (≥75%)**: Strong mastery
- **Yellow (50-74%)**: Moderate understanding
- **Red (<50%)**: Needs improvement
- **Gray (0 attempts)**: Not attempted

#### 3. Statistics Dashboard
- Total topics per subject
- Count of Strong/Moderate/Weak/Not Attempted topics
- Real-time updates

#### 4. Topic Details
- Success rate percentage
- Number of attempts
- Status badge
- Last attempt date

### API Endpoints

#### GET `/api/progress/get-heatmap`
**Parameters:**
- `userId` (required): User ID
- `subject` (optional): Specific subject name

**Response:**
```json
{
  "userId": "user123",
  "subject": "OS",
  "topics": {
    "Process Management": {
      "attempts": 5,
      "successRate": 82,
      "lastAttemptDate": "2024-12-26T10:30:00Z",
      "averageScore": 82,
      "status": "STRONG",
      "color": "green"
    }
  },
  "overallStrength": 75,
  "updatedAt": "2024-12-26T10:30:00Z"
}
```

#### POST `/api/progress/update-progress`
**Request Body:**
```json
{
  "userId": "user123",
  "subject": "DBMS",
  "topicName": "Normalization",
  "score": 85,
  "timeTaken": 120
}
```

**Response:**
```json
{
  "success": true,
  "progress": { /* Updated progress data */ }
}
```

### Usage in Your Code

```typescript
import { updateUserProgress } from "@/lib/progress-utils";

// After user completes a quiz/tutor session
await updateUserProgress(
  userId,
  "DBMS",
  "SQL Queries",
  85 // score out of 100
);
```

### Integration Points

The heatmap automatically integrates with:
- ✅ AI Tutor sessions
- ✅ MCQ Practice
- ✅ AI Viva Chain
- ✅ Interview Analysis
- ✅ Aptitude Trainer

Simply call `updateUserProgress()` after any learning activity!

---

## 🎯 Feature 8: Company-Oriented Preparation Mode

### Description
Customizes the entire learning experience based on target company type. Adjusts AI difficulty, question patterns, and teaching depth to match Service-Based, Product-Based, or Startup companies.

### Location
- **URL**: `/company-mode`
- **Component**: `components/CompanyModeSettings.tsx`
- **APIs**:
  - `app/api/company-mode/apply/route.ts` (POST/GET)
  - `app/api/company-mode/preferences/route.ts` (POST/GET)

### Company Types & Configurations

#### 1. SERVICE-BASED Companies
**Examples**: TCS, Wipro, Infosys, Accenture, Cognizant

**Configuration:**
```typescript
{
  temperature: 0.6,
  depthLevel: "moderate",
  focusAreas: ["Fundamentals", "Concepts", "Simple coding"],
  promptAddition: "Focus on TCS/Wipro/Infosys level questions. 
    Keep explanations moderate depth. Include basic coding problems."
}
```

**Characteristics:**
- Fundamental concepts focus
- Standard interview patterns
- Moderate difficulty
- Basic to intermediate coding

#### 2. PRODUCT-BASED Companies
**Examples**: Amazon, Google, Microsoft, Meta, Apple

**Configuration:**
```typescript
{
  temperature: 0.8,
  depthLevel: "deep",
  focusAreas: ["System Design", "Optimization", "Edge cases"],
  promptAddition: "Ask Amazon/Google/Microsoft level questions. 
    Expect deep understanding. Include optimization and trade-offs."
}
```

**Characteristics:**
- Deep technical knowledge
- System design questions
- Complex problem solving
- Scalability thinking
- Edge case analysis

#### 3. STARTUP Companies
**Examples**: Razorpay, Zomato, Swiggy, CRED, PhonePe

**Configuration:**
```typescript
{
  temperature: 0.7,
  depthLevel: "practical",
  focusAreas: ["Real scenarios", "Problem solving", "Quick thinking"],
  promptAddition: "Focus on practical scenarios. 
    Ask 'how would you build X' questions. Test adaptability."
}
```

**Characteristics:**
- Practical problem solving
- Quick adaptability
- Real-world scenarios
- Hands-on coding
- Constraint handling

### Database Schema (Firestore)
Collection: `userCompanyPreferences`

```typescript
{
  userId: string;
  companyType: "SERVICE_BASED" | "PRODUCT_BASED" | "STARTUP";
  targetCompanies: string[]; // Optional specific companies
  updatedAt: string;
}
```

### API Endpoints

#### POST `/api/company-mode/apply`
Apply company mode modifier to a prompt

**Request:**
```json
{
  "companyType": "PRODUCT_BASED",
  "basePrompt": "Explain deadlock in OS"
}
```

**Response:**
```json
{
  "enhancedPrompt": "Explain deadlock in OS\n\n**COMPANY MODE: PRODUCT_BASED**\n...",
  "modifier": { /* CompanyModeConfig */ },
  "companyType": "PRODUCT_BASED"
}
```

#### GET `/api/company-mode/apply`
Get available modes and configurations

**Response:**
```json
{
  "availableModes": ["SERVICE_BASED", "PRODUCT_BASED", "STARTUP"],
  "modifiers": { /* All configurations */ }
}
```

#### POST `/api/company-mode/preferences`
Save user preference

**Request:**
```json
{
  "userId": "user123",
  "companyType": "PRODUCT_BASED",
  "targetCompanies": ["Amazon", "Google", "Microsoft"]
}
```

#### GET `/api/company-mode/preferences?userId=user123`
Get user's saved preference

### Integration Guide

#### Step 1: Import Utilities
```typescript
import { 
  applyCompanyMode, 
  getUserCompanyPreference 
} from "@/lib/progress-utils";
```

#### Step 2: Fetch User Preference
```typescript
const companyType = await getUserCompanyPreference(userId);
```

#### Step 3: Apply to AI Prompts
```typescript
const basePrompt = "Explain process synchronization in OS";
const { enhancedPrompt, temperature } = applyCompanyMode(basePrompt, companyType);

// Use in Gemini API call
const result = await model.generateContent({
  contents: [{ role: "user", parts: [{ text: enhancedPrompt }] }],
  generationConfig: { temperature }
});
```

### Integration Examples

#### Example 1: AI Tutor
```typescript
// In components/AITutor.tsx
const generateResponse = async (userMessage: string) => {
  const companyType = await getUserCompanyPreference(userId);
  
  const basePrompt = `Subject: ${subject}\nTopic: ${topic}\nUser: ${userMessage}`;
  const { enhancedPrompt, temperature } = applyCompanyMode(basePrompt, companyType);
  
  // Use enhancedPrompt with Gemini...
};
```

#### Example 2: MCQ Generation
```typescript
// In app/api/mcq/generate/route.ts
const companyType = await getUserCompanyPreference(userId);

const basePrompt = "Generate MCQs on DBMS normalization";
const { enhancedPrompt, temperature } = applyCompanyMode(basePrompt, companyType);

// Generate MCQs with company-specific difficulty...
```

#### Example 3: Interview Questions
```typescript
// In app/api/vapi/generate/route.ts
const companyType = await getUserCompanyPreference(userId);

if (companyType === "PRODUCT_BASED") {
  // Include system design questions
} else if (companyType === "SERVICE_BASED") {
  // Focus on fundamentals
}
```

### UI Features

#### 1. Mode Selection Cards
- Beautiful card-based selection
- Icon + description for each mode
- Feature highlights
- Example companies

#### 2. Target Companies Manager
- Add custom companies
- Chip-based display
- Easy removal

#### 3. Real-time Feedback
- Success toast on save
- Instant mode switching
- Visual confirmation

#### 4. Info Box
- Explains how mode affects features
- Usage tips

---

## 🎨 UI/UX Design

### Heatmap Colors
```css
.topic-strong { /* Green #10b981 - ≥75% */ }
.topic-moderate { /* Yellow #f59e0b - 50-74% */ }
.topic-weak { /* Red #ef4444 - <50% */ }
.topic-not-attempted { /* Gray #6b7280 - 0 attempts */ }
```

### Company Mode Colors
```css
.service-based { /* Blue #3b82f6 */ }
.product-based { /* Purple #8b5cf6 */ }
.startup { /* Green #10b981 */ }
```

### Animations
- **Framer Motion** for all transitions
- Fade in/out for page loads
- Scale on hover for cards
- Slide up for sections
- Stagger children for grids

---

## 📱 Responsive Design

### Breakpoints
- **Mobile** (<768px): Single column, stacked stats
- **Tablet** (768-1024px): Two columns, adjusted spacing
- **Desktop** (>1024px): Full multi-column grids

### Mobile Optimizations
- Touch-friendly buttons
- Larger tap targets
- Simplified grids
- Bottom sheets for toasts

---

## 🔧 Technical Implementation

### Technologies
- **Next.js 15**: App Router, Server Actions
- **TypeScript**: Full type safety
- **Firestore**: Real-time database
- **Framer Motion**: Smooth animations
- **Gemini AI**: Adaptive prompts

### Performance
- Lazy loading of heatmap data
- Debounced updates
- Optimistic UI updates
- Cached company preferences
- Efficient Firestore queries

### Security
- Server-side authentication
- Input validation
- Rate limiting
- Firestore security rules

---

## 🚀 Usage Flow

### Progress Heatmap Flow
1. User completes any learning activity
2. System calls `updateUserProgress()`
3. Firestore updates topic data
4. Heatmap refreshes with new colors
5. Stats recalculate automatically

### Company Mode Flow
1. User selects company type
2. Optionally adds target companies
3. Saves preferences to Firestore
4. All AI features fetch preference
5. Prompts enhanced automatically
6. Questions adapted in real-time

---

## 📊 Data Analytics

### Heatmap Insights
- Identify weak areas quickly
- Track improvement over time
- Compare subject strengths
- Focus study plan

### Company Mode Insights
- Most selected company type
- Target company trends
- Feature usage by mode
- Success rates per mode

---

## 🐛 Troubleshooting

### Issue: Progress not updating
**Solution**: Ensure `updateUserProgress()` is called with correct subject/topic names matching predefined lists

### Issue: Company mode not applying
**Solution**: Verify user has saved preference via `/company-mode` page

### Issue: Heatmap shows all gray
**Solution**: User needs to complete activities in tutor/MCQ/viva to generate data

### Issue: API errors
**Solution**: Check Firebase Admin SDK configuration and Firestore rules

---

## 📚 Related Files

### Progress Heatmap
- [SubjectProgressHeatmap.tsx](components/SubjectProgressHeatmap.tsx)
- [get-heatmap/route.ts](app/api/progress/get-heatmap/route.ts)
- [update-progress/route.ts](app/api/progress/update-progress/route.ts)
- [progress/page.tsx](app/(root)/progress/page.tsx)

### Company Mode
- [CompanyModeSettings.tsx](components/CompanyModeSettings.tsx)
- [apply/route.ts](app/api/company-mode/apply/route.ts)
- [preferences/route.ts](app/api/company-mode/preferences/route.ts)
- [company-mode/page.tsx](app/(root)/company-mode/page.tsx)

### Utilities
- [progress-utils.ts](lib/progress-utils.ts) - Helper functions
- [types/index.d.ts](types/index.d.ts) - TypeScript definitions
- [globals.css](app/globals.css) - Styling

---

## 🎯 Future Enhancements

### Progress Heatmap
- [ ] Export heatmap as image
- [ ] Compare progress with peers
- [ ] Weekly/Monthly progress reports
- [ ] Gamification badges
- [ ] Study streak tracking

### Company Mode
- [ ] Company-specific question banks
- [ ] Interview pattern analysis
- [ ] Success stories from each mode
- [ ] AI-recommended mode based on performance
- [ ] Multi-company preparation (hybrid mode)

---

## 💡 Best Practices

### For Developers
1. Always call `updateUserProgress()` after user activities
2. Fetch company preference at component mount
3. Apply company mode to ALL AI prompts
4. Handle null preferences gracefully
5. Use TypeScript types for type safety

### For Users
1. Set company mode early in preparation journey
2. Review progress heatmap weekly
3. Focus on red/yellow topics
4. Update target companies as needed
5. Switch modes if changing career path

---

## 📞 Support

### Common Questions

**Q: Can I have multiple company modes?**
A: Currently one mode at a time. Future versions may support hybrid modes.

**Q: Does progress sync across devices?**
A: Yes! Stored in Firestore, syncs automatically.

**Q: Can I export my progress?**
A: Export feature coming soon. Currently view-only in heatmap.

**Q: How often should I check progress?**
A: Weekly reviews recommended for best results.

---

## 🏆 Success Metrics

Track these KPIs:
- Topics moved from Weak → Moderate → Strong
- Overall strength percentage increase
- Time spent on weak topics
- Success rate improvement
- Company mode effectiveness

---

## 🎓 Educational Value

### Progress Heatmap Benefits
- ✅ Visual learning reinforcement
- ✅ Identifies knowledge gaps
- ✅ Motivates consistent practice
- ✅ Data-driven study planning

### Company Mode Benefits
- ✅ Targeted preparation
- ✅ Realistic question difficulty
- ✅ Company-specific patterns
- ✅ Optimized learning path

---

*Last Updated: December 2024*
*Cogniview - Your AI-Powered Placement Preparation Platform*
