export type IntelligenceSignalSeverity = "low" | "medium" | "high";

export type IntelligenceEventType =
  | "resume.analysis.completed"
  | "resume.questions.generated"
  | "interview.analysis.completed"
  | "interview.answer_scoring.completed"
  | "interview.realtime.signal"
  | "interview.feedback.created"
  | "company.test.submitted"
  | "code.evaluation.completed"
  | "mistakes.review.updated"
  | "progress.topic.updated"
  | "learning.behavior.tracked"
  | "context.selection.updated"
  | "company.preference.updated"
  | "unknown";

export type IntelligenceDifficultyPreference = "easy" | "medium" | "hard" | "adaptive";

export type IntelligenceRecommendationPriority = "urgent" | "medium" | "optional";

export interface IntelligenceRecommendedAction {
  action: string;
  reason: string;
  priority: IntelligenceRecommendationPriority;
  route: string;
}

export interface IntelligenceWeakSignal {
  topic: string;
  reason?: string;
  severity: IntelligenceSignalSeverity;
  source: string;
  count: number;
  lastUpdated: string;
}

export interface IntelligenceStrengthSignal {
  topic: string;
  source: string;
  score: number;
  lastUpdated: string;
}

export interface IntelligenceMasteryEntry {
  score: number;
  attempts: number;
  lastUpdated: string;
}

export interface IntelligenceSkillEntry {
  skill: string;
  confidence: number;
  evidenceCount: number;
  source: string;
  lastUpdated: string;
}

export interface IntelligenceHistoryEntry {
  id: string;
  module: string;
  topic?: string;
  score: number;
  responseTimeMs: number | null;
  retries: number;
  confidence: number | null;
  createdAt: string;
}

export interface IntelligenceBehaviorProfile {
  averageResponseTimeMs: number;
  averageRetries: number;
  averageConfidence: number;
  sessionsTracked: number;
  lastModule: string | null;
  lastInteractionAt: string | null;
}

export interface IntelligenceMetrics {
  interviewReadiness: number;
  communication: number;
  technicalDepth: number;
  problemSolving: number;
  consistency: number;
}

export interface IntelligenceContextState {
  companyId: string | null;
  roleId: string | null;
  companyType: string | null;
  targetRole: string | null;
  targetCompanies: string[];
  recommendedRoles: string[];
}

export interface IntelligenceEventRecord {
  id: string;
  type: IntelligenceEventType;
  source: string;
  summary: string;
  createdAt: string;
}

export interface UserIntelligenceSnapshot {
  userId: string;
  version: number;
  metrics: IntelligenceMetrics;
  context: IntelligenceContextState;
  skills: Record<string, IntelligenceSkillEntry>;
  difficultyPreference: IntelligenceDifficultyPreference;
  weakSignals: IntelligenceWeakSignal[];
  strengths: IntelligenceStrengthSignal[];
  weakAreas: string[];
  strongAreas: string[];
  mastery: Record<string, IntelligenceMasteryEntry>;
  history: IntelligenceHistoryEntry[];
  behavior: IntelligenceBehaviorProfile;
  recentEvents: IntelligenceEventRecord[];
  eventStats: {
    totalEvents: number;
    lastEventAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface IntelligenceEventInput {
  userId: string;
  eventType: IntelligenceEventType;
  payload: Record<string, unknown>;
  source?: string;
}
