export type ExperienceLevel = "Beginner" | "Intermediate" | "Advanced";

export type SkillConfidence = "High" | "Moderate" | "Low";

export type SkillCategory =
  | "dsa"
  | "os"
  | "dbms"
  | "cn"
  | "projects"
  | "tech-stack"
  | "frontend"
  | "backend"
  | "language"
  | "tool"
  | "other";

export type WeaknessType =
  | "missing-skill"
  | "low-confidence"
  | "outdated-tech"
  | "depth-gap"
  | "project-quality";

export type WeaknessSeverity = "high" | "medium" | "low";

export interface SkillSignal {
  name: string;
  category: SkillCategory;
  confidence: SkillConfidence;
  evidence: string[];
}

export interface ProjectSignal {
  id: string;
  title: string;
  technologies: string[];
  quality: "strong" | "moderate" | "weak";
  signals: string[];
}

export interface WeaknessSignal {
  id: string;
  topic: string;
  reason: string;
  whyWeak: string;
  type: WeaknessType;
  severity: WeaknessSeverity;
  relatedSkills: string[];
}

export interface ResumeIntelligence {
  skills: SkillSignal[];
  strengths: string[];
  weaknesses: WeaknessSignal[];
  experienceLevel: ExperienceLevel;
  recommendedRoles: string[];
  missingKeySkills: string[];
  projectQualitySignals: ProjectSignal[];
  lastUpdated: string;
}

export interface LegacyResumeAnalysis {
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
  experienceLevel: ExperienceLevel;
  yearsOfExperience: number;
  education: string[];
  certifications: string[];
}

export type AdaptiveQuestionType = "MCQ" | "Coding" | "Conceptual";

export interface AdaptiveQuestion {
  id: string;
  type: AdaptiveQuestionType;
  topic: string;
  difficulty: ExperienceLevel;
  questionText: string;
  options?: string[];
  answerSnippet?: string;
  explanation: string;
  source: "weakness" | "skill" | "custom";
}

export type QuestionGenerationMode = "weak-areas" | "all-skills" | "custom";

export interface ResumeAnalysisResponse {
  success: true;
  analysisId: string;
  cached: boolean;
  intelligence: ResumeIntelligence;
  analysis: LegacyResumeAnalysis;
}

export interface QuestionGenerationResponse {
  success: true;
  planId: string;
  cached: boolean;
  mode: QuestionGenerationMode;
  questions: AdaptiveQuestion[];
  focusAreas: string[];
}
