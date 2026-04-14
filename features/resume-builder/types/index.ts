import type { LegacyResumeAnalysis, ResumeIntelligence } from "@/features/resume-analysis/types";

export type ResumeTemplateId = "executive" | "zenith" | "matrix";

export type ResumeSectionKey = "summary" | "experience" | "projects" | "education" | "skills";

export interface ResumeHeader {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface ResumeExperienceItem {
  id: string;
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  summary: string;
  bullets: string[];
}

export interface ResumeProjectItem {
  id: string;
  name: string;
  role: string;
  technologies: string[];
  link: string;
  summary: string;
  bullets: string[];
}

export interface ResumeEducationItem {
  id: string;
  institution: string;
  degree: string;
  score: string;
  startDate: string;
  endDate: string;
}

export interface ResumeBuilderDocument {
  header: ResumeHeader;
  targetRole: string;
  summary: string;
  experience: ResumeExperienceItem[];
  projects: ResumeProjectItem[];
  education: ResumeEducationItem[];
  skills: string[];
  templateId: ResumeTemplateId;
  sectionOrder: ResumeSectionKey[];
  sourceAnalysisId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeBuilderDraftRecord {
  userId: string;
  document: ResumeBuilderDocument;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ResumeBuilderAnalysisSeed {
  analysisId: string;
  intelligence: ResumeIntelligence;
  legacy: LegacyResumeAnalysis;
}

export interface ResumeBuilderContextResponse {
  success: boolean;
  draft: ResumeBuilderDocument | null;
  analysis: ResumeBuilderAnalysisSeed | null;
  draftUpdatedAt: string | null;
  error?: string;
}

export type ResumeAIGenerationSection = "summary" | "experience" | "project" | "skills";

export interface ResumeAISummaryResult {
  summary: string;
}

export interface ResumeAIExperienceResult {
  summary: string;
  bullets: string[];
}

export interface ResumeAIProjectResult {
  summary: string;
  bullets: string[];
}

export interface ResumeAISkillsResult {
  skills: string[];
}
