import {
  CATEGORY_KEYWORDS,
  DEFAULT_ROLE,
  OUTDATED_TECH,
  ROLE_REQUIREMENTS,
  STRONG_PROJECT_KEYWORDS,
  WEAK_PROJECT_KEYWORDS,
} from "@/features/resume-analysis/utils/role-requirements";
import type {
  ExperienceLevel,
  LegacyResumeAnalysis,
  ProjectSignal,
  ResumeIntelligence,
  SkillCategory,
  SkillConfidence,
  SkillSignal,
  WeaknessSignal,
} from "@/features/resume-analysis/types";

export interface LLMResumeExtraction {
  skills?: Array<{
    name?: string;
    category?: string;
    confidence?: SkillConfidence;
    evidence?: string[];
  }>;
  strengths?: string[];
  projects?: Array<{
    name?: string;
    technologies?: string[];
    description?: string;
    quality?: "strong" | "moderate" | "weak";
    signals?: string[];
  }>;
  experienceLevel?: ExperienceLevel;
  yearsOfExperience?: number | null;
  recommendedRoles?: string[];
  education?: string[];
  certifications?: string[];
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function uniqueCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const normalized = normalizeToken(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    out.push(toTitleCase(normalized));
  }

  return out;
}

function inferCategory(skillName: string): SkillCategory {
  const normalized = normalizeToken(skillName);
  const matched = CATEGORY_KEYWORDS.find((entry) => normalized.includes(entry.keyword));
  return matched?.category ?? "other";
}

function inferConfidence(text: string, skill: string): SkillConfidence {
  const normalizedText = normalizeToken(text);
  const normalizedSkill = normalizeToken(skill);

  const nearbyEvidence = ["implemented", "built", "deployed", "optimized", "designed", "production"];
  const hasStrongEvidence = nearbyEvidence.some(
    (word) => normalizedText.includes(`${word} ${normalizedSkill}`) || normalizedText.includes(`${normalizedSkill} ${word}`)
  );

  if (hasStrongEvidence) {
    return "High";
  }

  if (normalizedText.includes(normalizedSkill)) {
    return "Moderate";
  }

  return "Low";
}

export function parseYearsOfExperience(resumeText: string): number {
  const normalizedText = resumeText.toLowerCase();
  const yearMatch = normalizedText.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs|year)\s*(?:of)?\s*experience/);

  if (yearMatch && yearMatch[1]) {
    const parsed = Number(yearMatch[1]);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  const fresherHint = /fresher|entry level|graduate|intern/.test(normalizedText);
  if (fresherHint) {
    return 0;
  }

  return 1;
}

function toExperienceLevel(years: number, strengthsCount: number, weaknessCount: number): ExperienceLevel {
  if (years >= 3 || strengthsCount >= 7) {
    return "Advanced";
  }

  if (years >= 1 || strengthsCount >= 4 || weaknessCount <= 2) {
    return "Intermediate";
  }

  return "Beginner";
}

export function extractSkillSignalsFromText(resumeText: string): SkillSignal[] {
  const normalizedText = normalizeToken(resumeText);
  const candidates = new Set<string>();

  for (const entry of CATEGORY_KEYWORDS) {
    if (normalizedText.includes(entry.keyword)) {
      candidates.add(entry.keyword);
    }
  }

  const explicitSkillLine = resumeText.match(/(?:skills|tech stack|technologies)\s*[:\-]\s*([^\n]+)/gi) ?? [];
  for (const line of explicitSkillLine) {
    const split = line.split(/[:\-]/).slice(1).join(":");
    const values = split
      .split(/,|\||\//)
      .map((token) => token.trim())
      .filter(Boolean);

    for (const value of values) {
      candidates.add(value.toLowerCase());
    }
  }

  const result: SkillSignal[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const normalized = normalizeToken(candidate);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    const title = toTitleCase(normalized);
    result.push({
      name: title,
      category: inferCategory(title),
      confidence: inferConfidence(resumeText, title),
      evidence: normalizedText.includes(normalized) ? ["Mentioned in resume"] : [],
    });
  }

  return result;
}

export function mergeSkillSignals(
  resumeText: string,
  llmSkills: LLMResumeExtraction["skills"]
): SkillSignal[] {
  const heuristicSkills = extractSkillSignalsFromText(resumeText);
  const merged = new Map<string, SkillSignal>();

  for (const skill of heuristicSkills) {
    merged.set(normalizeToken(skill.name), skill);
  }

  for (const skill of llmSkills ?? []) {
    if (!skill?.name) {
      continue;
    }

    const normalized = normalizeToken(skill.name);
    if (!normalized) {
      continue;
    }

    const existing = merged.get(normalized);
    const confidence = skill.confidence ?? inferConfidence(resumeText, skill.name);
    const category = skill.category ? inferCategory(skill.category) : inferCategory(skill.name);
    const llmSignal: SkillSignal = {
      name: toTitleCase(normalized),
      category,
      confidence,
      evidence: skill.evidence?.filter(Boolean) ?? ["Identified by LLM extraction"],
    };

    if (!existing) {
      merged.set(normalized, llmSignal);
      continue;
    }

    const confidenceRank: Record<SkillConfidence, number> = {
      Low: 1,
      Moderate: 2,
      High: 3,
    };

    merged.set(normalized, {
      ...existing,
      category: existing.category === "other" ? llmSignal.category : existing.category,
      confidence:
        confidenceRank[llmSignal.confidence] > confidenceRank[existing.confidence]
          ? llmSignal.confidence
          : existing.confidence,
      evidence: uniqueCaseInsensitive([...existing.evidence, ...llmSignal.evidence]),
    });
  }

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function scoreProjectDescription(description: string): { quality: ProjectSignal["quality"]; signals: string[] } {
  const normalizedDescription = normalizeToken(description);
  const strongSignals = STRONG_PROJECT_KEYWORDS.filter((token) => normalizedDescription.includes(token));
  const weakSignals = WEAK_PROJECT_KEYWORDS.filter((token) => normalizedDescription.includes(token));

  if (strongSignals.length >= 2) {
    return { quality: "strong", signals: strongSignals };
  }

  if (weakSignals.length >= 2) {
    return { quality: "weak", signals: weakSignals };
  }

  return { quality: "moderate", signals: [...strongSignals, ...weakSignals] };
}

export function buildProjectSignals(
  resumeText: string,
  llmProjects: LLMResumeExtraction["projects"]
): ProjectSignal[] {
  const fromLlm = (llmProjects ?? [])
    .map((project, index) => {
      const title = project.name?.trim() || `Project ${index + 1}`;
      const description = project.description?.trim() || "No project description provided";
      const technologies = uniqueCaseInsensitive(project.technologies ?? []);
      const scored = scoreProjectDescription(description);

      return {
        id: `project-${index + 1}`,
        title,
        technologies,
        quality: project.quality ?? scored.quality,
        signals: project.signals?.length ? uniqueCaseInsensitive(project.signals) : scored.signals,
      } satisfies ProjectSignal;
    })
    .filter((project) => project.title.length > 0);

  if (fromLlm.length > 0) {
    return fromLlm;
  }

  const projectLines = resumeText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /project|built|developed|implemented/i.test(line));

  return projectLines.slice(0, 5).map((line, index) => {
    const scored = scoreProjectDescription(line);
    return {
      id: `project-${index + 1}`,
      title: line.slice(0, 60),
      technologies: [],
      quality: scored.quality,
      signals: scored.signals,
    };
  });
}

function buildStrengths(skills: SkillSignal[], projects: ProjectSignal[]): string[] {
  const strengths: string[] = [];

  if (skills.some((skill) => skill.category === "dsa" && skill.confidence === "High")) {
    strengths.push("Strong DSA foundation");
  }

  if (skills.some((skill) => skill.category === "frontend" && skill.confidence !== "Low")) {
    strengths.push("Frontend implementation competency");
  }

  if (skills.some((skill) => skill.category === "backend" && skill.confidence !== "Low")) {
    strengths.push("Backend development exposure");
  }

  const strongProjects = projects.filter((project) => project.quality === "strong").length;
  if (strongProjects > 0) {
    strengths.push(`${strongProjects} project(s) with strong delivery signals`);
  }

  if (skills.length >= 8) {
    strengths.push("Broad technical stack coverage");
  }

  return uniqueCaseInsensitive(strengths);
}

function detectMissingSkills(skillNames: string[], selectedRole: string): string[] {
  const profile = ROLE_REQUIREMENTS[selectedRole] ?? ROLE_REQUIREMENTS[DEFAULT_ROLE];
  const normalizedSkillSet = new Set(skillNames.map((skill) => normalizeToken(skill)));

  return profile.requiredSkills
    .filter((requiredSkill) => !normalizedSkillSet.has(normalizeToken(requiredSkill)))
    .map((skill) => toTitleCase(skill));
}

function detectOutdatedSkills(skillNames: string[]): string[] {
  const normalizedSkillSet = new Set(skillNames.map((skill) => normalizeToken(skill)));
  return OUTDATED_TECH.filter((legacySkill) => normalizedSkillSet.has(normalizeToken(legacySkill))).map((skill) =>
    toTitleCase(skill)
  );
}

function buildWeaknesses(input: {
  skills: SkillSignal[];
  projects: ProjectSignal[];
  selectedRole: string;
  missingSkills: string[];
  outdatedSkills: string[];
}): WeaknessSignal[] {
  const weaknesses: WeaknessSignal[] = [];
  const { skills, projects, selectedRole, missingSkills, outdatedSkills } = input;

  for (const missingSkill of missingSkills) {
    weaknesses.push({
      id: `missing-${normalizeToken(missingSkill).replace(/\s+/g, "-")}`,
      topic: missingSkill,
      reason: `${missingSkill} is expected for ${selectedRole} interviews.`,
      whyWeak: `The resume does not provide evidence for ${missingSkill}.`,
      type: "missing-skill",
      severity: "high",
      relatedSkills: [missingSkill],
    });
  }

  const lowConfidenceSkills = skills.filter((skill) => skill.confidence === "Low");
  for (const lowSkill of lowConfidenceSkills) {
    weaknesses.push({
      id: `confidence-${normalizeToken(lowSkill.name).replace(/\s+/g, "-")}`,
      topic: lowSkill.name,
      reason: `Limited depth detected for ${lowSkill.name}.`,
      whyWeak: "Skill is mentioned without meaningful project or outcome evidence.",
      type: "low-confidence",
      severity: "medium",
      relatedSkills: [lowSkill.name],
    });
  }

  for (const outdated of outdatedSkills) {
    weaknesses.push({
      id: `outdated-${normalizeToken(outdated).replace(/\s+/g, "-")}`,
      topic: outdated,
      reason: `${outdated} appears outdated for modern interview loops.`,
      whyWeak: "Hiring teams expect newer alternatives and migration awareness.",
      type: "outdated-tech",
      severity: "medium",
      relatedSkills: [outdated],
    });
  }

  const weakProjectCount = projects.filter((project) => project.quality === "weak").length;
  if (projects.length > 0 && weakProjectCount >= Math.ceil(projects.length / 2)) {
    weaknesses.push({
      id: "project-depth-gap",
      topic: "Project Depth",
      reason: "Project descriptions lack measurable outcomes and architecture details.",
      whyWeak: "Interviewers expect impact, scale, and trade-off articulation.",
      type: "project-quality",
      severity: "high",
      relatedSkills: projects.flatMap((project) => project.technologies).slice(0, 5),
    });
  }

  const hasOnlyHtmlCss =
    skills.some((skill) => normalizeToken(skill.name) === "html") &&
    skills.some((skill) => normalizeToken(skill.name) === "css") &&
    !skills.some((skill) => ["javascript", "typescript", "react", "next.js"].includes(normalizeToken(skill.name)));

  if (hasOnlyHtmlCss) {
    weaknesses.push({
      id: "frontend-depth-gap",
      topic: "Frontend Depth",
      reason: "Only HTML/CSS found without advanced frontend capability.",
      whyWeak: "Most frontend roles require JavaScript frameworks and state management depth.",
      type: "depth-gap",
      severity: "high",
      relatedSkills: ["Html", "Css"],
    });
  }

  const hasNoDbms = !skills.some((skill) => skill.category === "dbms");
  if (hasNoDbms) {
    weaknesses.push({
      id: "dbms-missing",
      topic: "DBMS",
      reason: "DBMS fundamentals are absent or too shallow.",
      whyWeak: "DBMS is a frequent screening topic across SWE interviews.",
      type: "missing-skill",
      severity: "high",
      relatedSkills: ["Dbms"],
    });
  }

  const seen = new Set<string>();
  return weaknesses.filter((weakness) => {
    const normalized = normalizeToken(weakness.topic);
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function recommendRoles(skills: SkillSignal[]): string[] {
  const categories = new Set(skills.map((skill) => skill.category));
  const roles: string[] = [];

  if (categories.has("frontend") && categories.has("tech-stack")) {
    roles.push("Frontend Developer");
  }

  if (categories.has("backend") && categories.has("dbms")) {
    roles.push("Backend Developer");
  }

  if (categories.has("frontend") && categories.has("backend")) {
    roles.push("Full Stack Developer");
  }

  if (categories.has("dsa") || categories.has("os") || categories.has("cn")) {
    roles.push("Software Engineer");
  }

  if (categories.has("dbms") && categories.has("tool") && categories.has("language")) {
    roles.push("Data Analyst");
  }

  if (roles.length === 0) {
    roles.push("Software Engineer");
  }

  return uniqueCaseInsensitive(roles);
}

export function buildResumeIntelligence(input: {
  resumeText: string;
  selectedRole?: string;
  llmExtraction?: LLMResumeExtraction;
}): { intelligence: ResumeIntelligence; yearsOfExperience: number; education: string[]; certifications: string[] } {
  const { resumeText, llmExtraction, selectedRole = DEFAULT_ROLE } = input;

  const skills = mergeSkillSignals(resumeText, llmExtraction?.skills);
  const projects = buildProjectSignals(resumeText, llmExtraction?.projects);
  const strengths = uniqueCaseInsensitive([...(llmExtraction?.strengths ?? []), ...buildStrengths(skills, projects)]);

  const missingSkills = detectMissingSkills(
    skills.map((skill) => skill.name),
    selectedRole
  );
  const outdatedSkills = detectOutdatedSkills(skills.map((skill) => skill.name));

  const weaknesses = buildWeaknesses({
    skills,
    projects,
    selectedRole,
    missingSkills,
    outdatedSkills,
  });

  const yearsOfExperience =
    typeof llmExtraction?.yearsOfExperience === "number" && Number.isFinite(llmExtraction.yearsOfExperience)
      ? llmExtraction.yearsOfExperience
      : parseYearsOfExperience(resumeText);

  const experienceLevel =
    llmExtraction?.experienceLevel ?? toExperienceLevel(yearsOfExperience, strengths.length, weaknesses.length);

  const intelligence: ResumeIntelligence = {
    skills,
    strengths,
    weaknesses,
    experienceLevel,
    recommendedRoles: uniqueCaseInsensitive([
      ...(llmExtraction?.recommendedRoles ?? []),
      ...recommendRoles(skills),
    ]),
    missingKeySkills: missingSkills,
    projectQualitySignals: projects,
    lastUpdated: new Date().toISOString(),
  };

  return {
    intelligence,
    yearsOfExperience,
    education: uniqueCaseInsensitive(llmExtraction?.education ?? []),
    certifications: uniqueCaseInsensitive(llmExtraction?.certifications ?? []),
  };
}

export function toLegacyResumeAnalysis(input: {
  intelligence: ResumeIntelligence;
  yearsOfExperience: number;
  education: string[];
  certifications: string[];
}): LegacyResumeAnalysis {
  const { intelligence, yearsOfExperience, education, certifications } = input;

  const detectedSkills = intelligence.skills.map((skill) => skill.name);
  const detectedFrameworks = intelligence.skills
    .filter((skill) => skill.category === "frontend" || skill.category === "backend")
    .map((skill) => skill.name);
  const detectedLanguages = intelligence.skills
    .filter((skill) => skill.category === "language")
    .map((skill) => skill.name);
  const detectedTools = intelligence.skills
    .filter((skill) => skill.category === "tool" || skill.category === "tech-stack")
    .map((skill) => skill.name);

  const detectedSubjects = uniqueCaseInsensitive(
    intelligence.skills
      .filter((skill) => ["dsa", "os", "dbms", "cn"].includes(skill.category))
      .map((skill) => skill.category.toUpperCase())
  );

  return {
    detectedSkills,
    detectedFrameworks,
    detectedLanguages,
    detectedTools,
    projects: intelligence.projectQualitySignals.map((project) => ({
      name: project.title,
      technologies: project.technologies,
      description: project.signals.join(", ") || `Project quality assessed as ${project.quality}`,
    })),
    detectedSubjects,
    experienceLevel: intelligence.experienceLevel,
    yearsOfExperience,
    education,
    certifications,
  };
}

export function sanitizeRole(role?: string): string {
  if (!role) {
    return DEFAULT_ROLE;
  }

  const matchingRole = Object.keys(ROLE_REQUIREMENTS).find(
    (knownRole) => normalizeToken(knownRole) === normalizeToken(role)
  );

  return matchingRole ?? (role.trim() || DEFAULT_ROLE);
}

export function computeAnalysisHash(text: string): string {
  // Lightweight deterministic hash for cache keying in both client/server paths.
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export function getWeaknessTopics(intelligence: ResumeIntelligence): string[] {
  return intelligence.weaknesses
    .sort((a, b) => {
      const rank: Record<WeaknessSignal["severity"], number> = { high: 3, medium: 2, low: 1 };
      return rank[b.severity] - rank[a.severity];
    })
    .map((weakness) => weakness.topic);
}
