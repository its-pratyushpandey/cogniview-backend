export type QuestionType = "mcq" | "coding" | "theory";
export type Difficulty = "easy" | "medium" | "hard";
export type TestSectionType = "aptitude" | "coding" | "cs";

export interface MistakePriorityMetadata {
  targetedWeakArea: boolean;
  priorityScore: number;
  threshold: number;
  matchedTag: string | null;
  reason: string;
}

export interface Company {
  id: string;
  name: string;
  logoUrl?: string;
  description?: string;
  roles: string[];
  frequentTopics: string[];
}

export interface Role {
  id: string;
  name: string;
  skills: string[];
}

export interface CompanyQuestion {
  id: string;
  companyId: string;
  roleId: string;
  type: QuestionType;
  difficulty: Difficulty;
  tags: string[];
  question: string;
  answer: string;
  explanation: string;
  mistakePriority?: MistakePriorityMetadata;
}

export interface MockInterview {
  id: string;
  companyId: string;
  roleId: string;
  questions: string[];
  evaluationSchema: {
    communicationWeight: number;
    technicalWeight: number;
    problemSolvingWeight: number;
    confidenceWeight: number;
  };
  durationMinutes: number;
}

export interface TestSection {
  id: string;
  type: TestSectionType;
  title: string;
  durationMinutes: number;
  questions: CompanyQuestion[];
}

export interface CompanyTest {
  id: string;
  companyId: string;
  roleId: string;
  sections: TestSection[];
  duration: number;
}

export interface CompanyPrepStats {
  attempted: number;
  correct: number;
  averageScore: number;
  lastScore: number;
  mockCompleted: number;
  testsCompleted: number;
}

export interface CompanyPrepProgressNode {
  stats: CompanyPrepStats;
  weakAreas: string[];
  scores: number[];
  lastDifficulty?: Difficulty;
  lastUpdated: string;
}

export interface UserProgressDoc {
  userId: string;
  companyPrep: Record<string, Record<string, CompanyPrepProgressNode>>;
  updatedAt: string;
}

export interface AdaptiveContext {
  recommendedDifficulty: Difficulty;
  weakAreas: string[];
  prioritizedTopics: string[];
  recentScores: number[];
}

export interface CompanyRoleSuggestion {
  companyIds: string[];
  roleIds: string[];
  reason?: string;
}

export interface CompanyListResponse {
  companies: Company[];
  suggestions: CompanyRoleSuggestion;
}

export interface CompanyRolesResponse {
  companyId: string;
  roles: Role[];
}

export interface CompanyQuestionsResponse {
  companyId: string;
  roleId: string;
  questions: CompanyQuestion[];
  adaptive: AdaptiveContext;
  progress: CompanyPrepProgressNode;
}

export interface CompanyMockResponse {
  companyId: string;
  roleId: string;
  mock: MockInterview;
  adaptive: AdaptiveContext;
  progress: CompanyPrepProgressNode;
}

export interface CompanyTestResponse {
  companyId: string;
  roleId: string;
  test: CompanyTest;
  adaptive: AdaptiveContext;
  progress: CompanyPrepProgressNode;
}

export interface TestSubmissionInput {
  userId: string;
  companyId: string;
  roleId: string;
  answers: Record<string, string | number>;
}

export interface TestSubmissionResult {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  weakAreas: string[];
  updatedProgress: CompanyPrepProgressNode;
}
