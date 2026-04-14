// ============================================
// INTEGRATION EXAMPLES FOR NEW FEATURES
// ============================================

// Example 1: Update Progress After AI Tutor Session
// File: components/AITutor.tsx (or similar)
import { updateUserProgress } from "@/lib/progress-utils";

const handleEndSession = async () => {
  // Calculate user's performance
  const answeredCorrectly = calculateCorrectAnswers();
  const totalQuestions = conversationHistory.length;
  const score = (answeredCorrectly / totalQuestions) * 100;

  // Update progress heatmap
  await updateUserProgress(
    userId,
    subject, // "OS", "DBMS", "OOPS", "CN", or "DSA"
    topic,   // "Process Management", "SQL Queries", etc.
    score
  );

  // Continue with existing logic...
};

// ============================================

// Example 2: Apply Company Mode to AI Tutor
// File: components/AITutor.tsx
import { applyCompanyMode, getUserCompanyPreference } from "@/lib/progress-utils";

const generateAIResponse = async (userMessage: string) => {
  // Fetch user's company preference
  const companyType = await getUserCompanyPreference(userId);

  // Build base prompt
  const basePrompt = `
    You are an AI tutor teaching ${subject}.
    Topic: ${topic}
    Student question: ${userMessage}
    
    Provide a clear explanation with examples.
  `;

  // Apply company mode modifiers
  const { enhancedPrompt, temperature } = applyCompanyMode(basePrompt, companyType);

  // Use in Gemini API
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: enhancedPrompt }] }],
    generationConfig: { 
      temperature,
      maxOutputTokens: 1000 
    }
  });

  return result.response.text();
};

// ============================================

// Example 3: Update Progress After MCQ Quiz
// File: app/(root)/mcq/page.tsx
import { updateUserProgress } from "@/lib/progress-utils";

const handleQuizComplete = async (answers: Answer[]) => {
  // Calculate score
  const correctAnswers = answers.filter(a => a.isCorrect).length;
  const score = (correctAnswers / answers.length) * 100;

  // Update progress
  await updateUserProgress(
    userId,
    mcqSubject,  // e.g., "DBMS"
    mcqTopic,    // e.g., "Normalization"
    score
  );

  // Show results...
};

// ============================================

// Example 4: Apply Company Mode to MCQ Generation
// File: app/api/mcq/generate/route.ts
import { applyCompanyMode } from "@/lib/progress-utils";

export async function POST(request: Request) {
  const { userId, subject, topic, difficulty, companyType } = await request.json();

  const basePrompt = `
    Generate 10 multiple choice questions on ${subject} - ${topic}.
    Difficulty: ${difficulty}
    
    Return JSON array with: question, options (A-D), correctAnswer, explanation
  `;

  // Apply company mode
  const { enhancedPrompt, temperature } = applyCompanyMode(basePrompt, companyType);

  // Generate MCQs...
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: enhancedPrompt }] }],
    generationConfig: { temperature }
  });

  return NextResponse.json({ questions: parseQuestions(result) });
}

// ============================================

// Example 5: Update Progress After Viva Session
// File: components/AIVivaChain.tsx
import { updateUserProgress } from "@/lib/progress-utils";

const endVivaSession = async () => {
  // Calculate performance
  const totalQuestions = questionsAsked;
  const performanceScore = 
    (goodAnswers * 100 + averageAnswers * 60 + poorAnswers * 20) / totalQuestions;

  // Update progress
  await updateUserProgress(
    userId,
    subject,
    baseTopic,
    performanceScore
  );

  // Save session to Firestore...
};

// ============================================

// Example 6: Apply Company Mode to Interview Questions
// File: app/api/vapi/generate/route.ts
import { applyCompanyMode, getUserCompanyPreference } from "@/lib/progress-utils";

export async function POST(request: Request) {
  const { role, level, techstack, userId } = await request.json();

  // Get user's company preference
  const companyType = await getUserCompanyPreference(userId);

  const basePrompt = `
    Generate ${amount} interview questions for:
    Role: ${role}
    Level: ${level}
    Tech Stack: ${techstack.join(", ")}
    
    Focus on practical scenarios and technical depth.
  `;

  // Apply company mode
  const { enhancedPrompt, temperature } = applyCompanyMode(basePrompt, companyType);

  // Generate questions with adjusted difficulty
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: enhancedPrompt }] }],
    generationConfig: { temperature }
  });

  return NextResponse.json({ questions: parseQuestions(result) });
}

// ============================================

// Example 7: Update Progress After Aptitude Problem
// File: components/AptitudeProblem.tsx
import { updateUserProgress } from "@/lib/progress-utils";

const handleSolutionSubmit = async (isCorrect: boolean, timeTaken: number) => {
  // Calculate score based on correctness and time
  const score = isCorrect ? (timeTaken < optimalTime ? 100 : 80) : 0;

  // Update progress (DSA subject for aptitude)
  await updateUserProgress(
    userId,
    "DSA",
    aptitudeTopic, // e.g., "Arrays", "Dynamic Programming"
    score,
    timeTaken
  );

  // Show feedback...
};

// ============================================

// Example 8: Show QuickProgressWidget on Dashboard
// File: app/(root)/page.tsx
import QuickProgressWidget from "@/components/QuickProgressWidget";
import { getCurrentUser } from "@/lib/actions/auth.action";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="dashboard">
      <h1>Welcome back, {user.name}!</h1>
      
      {/* Add progress widget */}
      <QuickProgressWidget userId={user.id} />
      
      {/* Rest of dashboard... */}
    </div>
  );
}

// ============================================

// Example 9: Fetch Company Preference on Component Mount
// File: components/SomeFeature.tsx
import { getUserCompanyPreference } from "@/lib/progress-utils";
import { useEffect, useState } from "react";

const SomeFeature = ({ userId }: Props) => {
  const [companyType, setCompanyType] = useState<CompanyType | null>(null);

  useEffect(() => {
    const fetchPreference = async () => {
      const preference = await getUserCompanyPreference(userId);
      setCompanyType(preference);
    };
    fetchPreference();
  }, [userId]);

  // Use companyType to adjust UI or behavior...

  return <div>...</div>;
};

// ============================================

// Example 10: Show Company Mode Badge
// File: components/Header.tsx or Navigation
import { getUserCompanyPreference } from "@/lib/progress-utils";

const Header = async ({ userId }: Props) => {
  const companyType = await getUserCompanyPreference(userId);

  return (
    <header>
      {companyType && (
        <div className="company-badge">
          {companyType === "PRODUCT_BASED" && "🚀 Product Mode"}
          {companyType === "SERVICE_BASED" && "🏢 Service Mode"}
          {companyType === "STARTUP" && "💡 Startup Mode"}
        </div>
      )}
    </header>
  );
};

// ============================================

// UTILITY: Manual Progress Update (if needed)
import { db } from "@/firebase/admin";

export const manualProgressUpdate = async (
  userId: string,
  subject: string,
  topicName: string,
  score: number
) => {
  const progressDocId = `${userId}_${subject}`;
  const progressRef = db.collection("userProgress").doc(progressDocId);
  
  // Get existing data
  const doc = await progressRef.get();
  let data = doc.exists ? doc.data() : { topics: {} };
  
  // Update topic
  const currentTopic = data.topics[topicName] || {
    attempts: 0,
    successRate: 0,
    averageScore: 0
  };
  
  const newAttempts = currentTopic.attempts + 1;
  const newAvgScore = 
    (currentTopic.averageScore * currentTopic.attempts + score) / newAttempts;
  
  data.topics[topicName] = {
    ...currentTopic,
    attempts: newAttempts,
    averageScore: newAvgScore,
    successRate: newAvgScore,
    lastAttemptDate: new Date().toISOString()
  };
  
  // Save
  await progressRef.set(data);
};

// ============================================
// END OF INTEGRATION EXAMPLES
// ============================================
