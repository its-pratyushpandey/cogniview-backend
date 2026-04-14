interface Feedback {
  id: string;
  interviewId: string;
  totalScore: number;
  categoryScores: Array<{
    name: string;
    score: number;
    comment: string;
  }>;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  perQuestionSummary?: InterviewPerQuestionSummary[];
  sessionSummary?: InterviewSessionSummary;
  transcript?: Array<{ role: string; content: string }>;
  createdAt: string;
}

interface Interview {
  id: string;
  role: string;
  level: string;
  questions: string[];
  techstack: string[];
  createdAt: string;
  userId: string;
  type: string;
  finalized: boolean;
}

interface CreateFeedbackParams {
  interviewId: string;
  userId: string;
  transcript: { role: string; content: string }[];
  feedbackId?: string;
  perQuestionSummary?: InterviewPerQuestionSummary[];
  sessionSummary?: InterviewSessionSummary;
}

interface User {
  name: string;
  email: string;
  id: string;
}

interface RouteParams {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string>>;
}

interface GetFeedbackByInterviewIdParams {
  interviewId: string;
  userId: string;
}

interface GetLatestInterviewsParams {
  userId: string;
  limit?: number;
}

interface InterviewFormProps {
  interviewId: string;
  role: string;
  level: string;
  type: string;
  techstack: string[];
  amount: number;
}

interface AgentProps {
  userName: string;
  userId?: string;
  interviewId?: string;
  feedbackId?: string;
  type: "generate" | "interview";
  questions?: string[];
}

interface InterviewCardProps {
  id?: string;
  userId?: string;
  role: string;
  type: string;
  techstack: string[];
  createdAt?: string;
}

// AI Tutor Types
interface TutorSession {
  id: string;
  userId: string;
  subject: string; // "OS" | "DBMS" | "OOPS" | "CN" | "DSA"
  topic: string;
  conversationHistory: Array<{role: string; content: string; timestamp: string}>;
  conceptsMastered: string[];
  conceptsWeak: string[];
  currentDifficulty: number; // 1-10
  adaptiveLevel: number;
  createdAt: string;
  updatedAt: string;
}

interface TutorMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

// Interview Suggestions Types
interface InterviewSuggestion {
  questionAsked: string;
  userAnswer: string;
  issues: string[];
  modelAnswer: string;
  rephrasingSuggestion: string;
  additionalConcepts: string[];
  improvementScore: number; // 0-10
}

interface SuggestionsData {
  suggestions: InterviewSuggestion[];
  overallFeedback: string;
  keyAreas: string[];
}

// Engineering Chatbot Types
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isOffTopic?: boolean;
}

interface EngineeringBotResponse {
  message: string;
  isOffTopic: boolean;
  timestamp: string;
}

interface WeakTopic {
  subject: string;
  topic: string;
  reason: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  suggestedFocus: string;
}

interface WeaknessAnalysis {
  weakTopics: WeakTopic[];
  overallReadiness: number; // 0-100
  recommendedAction: "START_TUTOR" | "CONTINUE_PRACTICE" | "READY";
  prioritySubject: string;
}

// Smart Revision Mode Types
interface RevisionSession {
  id: string;
  userId: string;
  subject: string; // "OS" | "DBMS" | "OOPS" | "CN" | "DSA"
  topic: string;
  revisionType: "5-minute-quick" | "last-day-notes" | "one-pager" | "most-asked-questions";
  companyType?: string; // "product-based" | "service-based" | "startup"
  weakTopics: string[];
  content: string;
  createdAt: string;
  lastAccessedAt: string;
}

interface RevisionContent {
  type: "5-minute-quick" | "last-day-notes" | "one-pager" | "most-asked-questions";
  keyPoints?: string[];
  interviewQuestions?: Array<{question: string; answer: string}>;
  commonTraps?: string[];
  definitions?: Array<{term: string; definition: string}>;
  formulas?: string[];
  commonMistakes?: string[];
  visualMap?: string;
  conceptsMap?: string[];
  decisionTree?: string;
  cheatSheet?: string[];
  topQuestions?: Array<{question: string; answer: string; followUp: string[]}>;
}

interface CreateRevisionParams {
  userId: string;
  subject: string;
  topic: string;
  revisionType: "5-minute-quick" | "last-day-notes" | "one-pager" | "most-asked-questions";
  companyType?: string;
  weakTopics?: string[];
}

// Mistake Memory System Types
interface MistakeEntry {
  conceptId: string;
  subject: string;
  topic: string;
  questionId: string;
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  attemptDate: string;
  mistakeType: "CONCEPTUAL" | "TERMINOLOGY" | "SHALLOW" | "INCORRECT";
  retestScheduled: string; // ISO date string
  masteryLevel: number; // 0-100
  attempts: Array<{
    date: string;
    correct: boolean;
    timeTaken: number; // in seconds
    confidence: number; // 1-5
  }>;
}

interface MistakeMemory {
  id: string;
  userId: string;
  mistakes: MistakeEntry[];
  createdAt: string;
  updatedAt: string;
}

interface SpacedRepetitionSchedule {
  conceptId: string;
  subject: string;
  topic: string;
  nextReviewDate: string;
  interval: number; // days
  easeFactor: number; // 1.3-2.5
  repetitions: number;
}

interface CreateMistakeParams {
  userId: string;
  subject: string;
  topic: string;
  questionId: string;
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  mistakeType: "CONCEPTUAL" | "TERMINOLOGY" | "SHALLOW" | "INCORRECT";
}

interface UpdateMistakeParams {
  userId: string;
  conceptId: string;
  correct: boolean;
  timeTaken: number;
  confidence: number;
}

interface GetDueReviewsParams {
  userId: string;
  subjects?: string[];
  limit?: number;
}

// Resume-to-Interview Mapping Types
interface ResumeAnalysis {
  id: string;
  userId: string;
  resumeText: string;
  detectedSkills: string[];
  detectedFrameworks: string[];
  detectedLanguages: string[];
  detectedTools: string[];
  projects: Array<{
    name: string;
    technologies: string[];
    description: string;
  }>;
  detectedSubjects: string[];
  experienceLevel: "Beginner" | "Intermediate" | "Advanced";
  yearsOfExperience?: number;
  education: string[];
  certifications: string[];
  createdAt: string;
  updatedAt: string;
}

interface ResumeBasedQuestion {
  type: "SKILL_VERIFICATION" | "PROJECT_GRILLING" | "DEPTH_TESTING" | "ARCHITECTURE_CHOICE" | "CONCEPT_CLARITY";
  skill?: string;
  project?: string;
  subject?: string;
  question: string;
  followUp: string[];
  expectedAnswer: string;
  difficultyLevel: "Easy" | "Medium" | "Hard";
  tags: string[];
}

interface InterviewPrepPlan {
  resumeAnalysisId: string;
  userId: string;
  questions: ResumeBasedQuestion[];
  redFlags: string[];
  strengthAreas: string[];
  focusAreas: string[];
  estimatedPreparationTime: string; // e.g., "2 weeks"
  priorityTopics: string[];
  createdAt: string;
}

interface AnalyzeResumeParams {
  userId: string;
  resumeText: string;
}

interface GenerateInterviewPlanParams {
  userId: string;
  resumeAnalysisId: string;
  targetCompanyType?: string;
  targetRole?: string;
}

interface CreateTutorSessionParams {
  userId: string;
  subject: string;
  topic: string;
}

interface SendTutorMessageParams {
  sessionId: string;
  userId: string;
  message: string;
  subject: string;
  topic: string;
  weakConcepts: string[];
  masteredConcepts: string[];
  difficultyLevel: number;
}

interface MistakePriorityMetadata {
  targetedWeakArea: boolean;
  priorityScore: number;
  threshold: number;
  matchedTag: string | null;
  reason: string;
}

// MCQ Generator Types
interface MCQQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Tricky";
  conceptTags: string[];
  explanation: {
    correct: string;
    why_others_wrong: Record<string, string>;
  };
  interviewTip: string;
  companyAskedBy: string[];
  mistakePriority?: MistakePriorityMetadata;
}

interface MCQSession {
  id: string;
  userId: string;
  subject: string;
  topic: string;
  difficulty: string;
  companyType: string;
  focus: string;
  questions: MCQQuestion[];
  userAnswers: Record<string, number>;
  score: number;
  completedAt?: string;
  createdAt: string;
}

interface GenerateMCQParams {
  userId: string;
  subject: string;
  topic: string;
  count: number;
  difficulty: string;
  companyType: string;
  focus: string;
}

// Aptitude Trainer Types
interface AptitudeProblem {
  id: string;
  statement: string;
  options?: string[];
  difficulty: "Easy" | "Medium" | "Hard" | "Expert";
  expectedTime: string;
  answerFormat: string;
  hints: string[];
  answer: string;
  solutionMethods: {
    name: string;
    steps: string[];
    time: string;
  }[];
  learningTip: string;
  relatedTopics: string[];
  mistakePriority?: MistakePriorityMetadata;
}

interface AptitudeSession {
  id: string;
  userId: string;
  topic: string;
  problems: AptitudeProblem[];
  attempts: number;
  successRate: number;
  avgTime: number;
  commonMistakes: string[];
  createdAt: string;
  updatedAt: string;
}

interface AptitudeAttempt {
  problemId: string;
  userAnswer: string;
  isCorrect: boolean;
  timeTaken: number;
  hintsUsed: number;
  timestamp: string;
}

interface GenerateAptitudeProblemParams {
  userId: string;
  topic: string;
  difficulty: string;
  attempts: number;
  successRate: number;
  avgTime: number;
  commonMistakes: string[];
}

// Answer Quality Scoring Types
interface AnswerScore {
  question: string;
  userAnswer: string;
  technicalCorrectness: number;
  terminologyUsage: number;
  depthOfExplanation: number;
  interviewReadiness: number;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  improvement: string;
  modelAnswer: string;
}

interface AnswerQualityAnalysis {
  answerScores: AnswerScore[];
  overallStats: {
    avgTechnicalCorrectness: number;
    avgTerminologyUsage: number;
    avgDepthOfExplanation: number;
    avgInterviewReadiness: number;
    totalAnswers: number;
    strongAnswers: number;
    weakAnswers: number;
  };
  recommendations: string[];
  perQuestionSummary: InterviewPerQuestionSummary[];
  sessionSummary: InterviewSessionSummary;
}

interface InterviewPerQuestionSummary {
  question: string;
  userAnswer: string;
  accuracy: number;
  communicationQuality: number;
  suggestion: string;
  strengths: string[];
  weaknesses: string[];
}

interface InterviewSessionSummary {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  focusAreas: string[];
  improvementTips: string[];
}

interface AnswerScoreEvaluation {
  question: string;
  userAnswer: string;
  score: number;
  clarity: number;
  accuracy: number;
  depth: number;
  feedback: string;
  improvementTips: string[];
  strengths: string[];
  weaknesses: string[];
  modelAnswer: string;
}

interface AnswerScoreApiSuccess {
  success: true;
  result: AnswerScoreEvaluation;
}

interface AnswerScoreApiFailure {
  success: false;
  error: string;
}

// AI Viva Chain Types
interface VivaEvaluation {
  quality: "GOOD" | "AVERAGE" | "POOR";
  score: number;
  reasoning: string;
  keyIssues: string[];
  nextStrategy: string;
}

interface VivaQuestion {
  nextQuestion: string;
  questionType: "BASE" | "FOLLOWUP" | "TRAP" | "SCENARIO" | "CLARIFICATION";
  difficulty: number;
  evaluationOfPreviousAnswer: VivaEvaluation | null;
  hints: string[];
  expectedAnswerKeywords: string[];
  mcqOptions: string[];
  correctOptionIndex: number;
  mistakePriority?: MistakePriorityMetadata;
}

interface VivaSession {
  id: string;
  userId: string;
  subject: string;
  baseTopic: string;
  conversationHistory: Array<{
    role: "assistant" | "user";
    content: string;
    timestamp: string;
    evaluation?: VivaEvaluation;
  }>;
  currentDifficulty: number;
  questionsAsked: number;
  goodAnswers: number;
  averageAnswers: number;
  poorAnswers: number;
  createdAt: string;
  updatedAt: string;
}

// Subject Progress Heatmap Types
interface TopicProgress {
  attempts: number;
  successRate: number;
  lastAttemptDate: string;
  averageScore: number;
  status: "STRONG" | "MODERATE" | "WEAK" | "NOT_ATTEMPTED";
  color: "green" | "yellow" | "red" | "gray";
}

interface UserProgress {
  userId: string;
  subject: string;
  topics: {
    [topicName: string]: TopicProgress;
  };
  overallStrength: number;
  updatedAt: string;
}

interface SubjectProgressSummary {
  subject: string;
  totalTopics: number;
  strongTopics: number;
  moderateTopics: number;
  weakTopics: number;
  notAttempted: number;
  overallStrength: number;
  recentActivity: string;
}

// Company-Oriented Preparation Mode Types
type CompanyType = "SERVICE_BASED" | "PRODUCT_BASED" | "STARTUP";

interface CompanyModeConfig {
  temperature: number;
  depthLevel: "moderate" | "deep" | "practical";
  focusAreas: string[];
  promptAddition: string;
}

interface CompanyModeModifiers {
  SERVICE_BASED: CompanyModeConfig;
  PRODUCT_BASED: CompanyModeConfig;
  STARTUP: CompanyModeConfig;
}

interface UserCompanyPreference {
  userId: string;
  companyType: CompanyType;
  targetCompanies: string[];
  updatedAt: string;
}
