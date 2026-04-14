import type {
  ResumeBuilderAnalysisSeed,
  ResumeBuilderDocument,
  ResumeEducationItem,
  ResumeExperienceItem,
  ResumeProjectItem,
  ResumeSectionKey,
} from "@/features/resume-builder/types";

export const DEFAULT_SECTION_ORDER: ResumeSectionKey[] = [
  "summary",
  "experience",
  "projects",
  "education",
  "skills",
];

function nowIso(): string {
  return new Date().toISOString();
}

function randomToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export function createLocalId(prefix: string): string {
  return `${prefix}-${randomToken()}`;
}

export function createExperienceItem(): ResumeExperienceItem {
  return {
    id: createLocalId("exp"),
    company: "",
    role: "",
    location: "",
    startDate: "",
    endDate: "",
    current: false,
    summary: "",
    bullets: [],
  };
}

export function createProjectItem(): ResumeProjectItem {
  return {
    id: createLocalId("project"),
    name: "",
    role: "",
    technologies: [],
    link: "",
    summary: "",
    bullets: [],
  };
}

export function createEducationItem(): ResumeEducationItem {
  return {
    id: createLocalId("edu"),
    institution: "",
    degree: "",
    score: "",
    startDate: "",
    endDate: "",
  };
}

export function createEmptyResumeDocument(partial?: Partial<ResumeBuilderDocument>): ResumeBuilderDocument {
  const timestamp = nowIso();

  return {
    header: {
      fullName: "",
      headline: "Software Engineer",
      email: "",
      phone: "",
      location: "",
      linkedin: "",
      github: "",
      portfolio: "",
      ...(partial?.header ?? {}),
    },
    targetRole: partial?.targetRole ?? "Software Engineer",
    summary: partial?.summary ?? "",
    experience: partial?.experience ?? [createExperienceItem()],
    projects: partial?.projects ?? [createProjectItem()],
    education: partial?.education ?? [createEducationItem()],
    skills: partial?.skills ?? [],
    templateId: partial?.templateId ?? "executive",
    sectionOrder: partial?.sectionOrder ?? [...DEFAULT_SECTION_ORDER],
    sourceAnalysisId: partial?.sourceAnalysisId,
    createdAt: partial?.createdAt ?? timestamp,
    updatedAt: partial?.updatedAt ?? timestamp,
  };
}

function uniqueTrimmed(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(trimmed);
  }

  return output;
}

export function normalizeSkillsInput(rawInput: string): string[] {
  const chunks = rawInput
    .split(/,|\n|\|/g)
    .map((token) => token.trim())
    .filter(Boolean);

  return uniqueTrimmed(chunks);
}

function mapEducationFromLegacy(lines: string[]): ResumeEducationItem[] {
  const parsed = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      id: createLocalId("edu"),
      institution: line,
      degree: "",
      score: "",
      startDate: "",
      endDate: "",
    }));

  return parsed.length > 0 ? parsed : [createEducationItem()];
}

function mapProjectsFromAnalysis(seed: ResumeBuilderAnalysisSeed): ResumeProjectItem[] {
  const fromLegacy = seed.legacy.projects
    .slice(0, 4)
    .map((project) => ({
      id: createLocalId("project"),
      name: project.name,
      role: "",
      technologies: uniqueTrimmed(project.technologies),
      link: "",
      summary: project.description,
      bullets: [],
    }));

  if (fromLegacy.length > 0) {
    return fromLegacy;
  }

  const fromSignals = seed.intelligence.projectQualitySignals.slice(0, 4).map((signal) => ({
    id: createLocalId("project"),
    name: signal.title,
    role: "",
    technologies: uniqueTrimmed(signal.technologies),
    link: "",
    summary: signal.signals.join(", "),
    bullets: [],
  }));

  return fromSignals.length > 0 ? fromSignals : [createProjectItem()];
}

export function buildDocumentFromAnalysis(seed: ResumeBuilderAnalysisSeed): ResumeBuilderDocument {
  const topStrengths = seed.intelligence.strengths.slice(0, 3);
  const summary =
    topStrengths.length > 0
      ? `Results-driven ${seed.intelligence.experienceLevel.toLowerCase()} engineer focused on ${topStrengths.join(", ")}.`
      : "Results-driven software engineer focused on building scalable, reliable user-facing systems.";

  return createEmptyResumeDocument({
    targetRole: seed.intelligence.recommendedRoles[0] ?? "Software Engineer",
    summary,
    skills: uniqueTrimmed(seed.intelligence.skills.map((skill) => skill.name)).slice(0, 24),
    projects: mapProjectsFromAnalysis(seed),
    education: mapEducationFromLegacy(seed.legacy.education),
    sourceAnalysisId: seed.analysisId,
  });
}

export function reorderSections(
  sectionOrder: ResumeSectionKey[],
  target: ResumeSectionKey,
  direction: "up" | "down"
): ResumeSectionKey[] {
  const currentIndex = sectionOrder.indexOf(target);
  if (currentIndex < 0) {
    return sectionOrder;
  }

  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= sectionOrder.length) {
    return sectionOrder;
  }

  const output = [...sectionOrder];
  [output[currentIndex], output[nextIndex]] = [output[nextIndex], output[currentIndex]];
  return output;
}

export function sectionLabel(section: ResumeSectionKey): string {
  if (section === "summary") return "Professional Summary";
  if (section === "experience") return "Experience";
  if (section === "projects") return "Projects";
  if (section === "education") return "Education";
  return "Skills";
}
