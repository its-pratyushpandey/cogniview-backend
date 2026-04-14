import type { SkillCategory } from "@/features/resume-analysis/types";

export interface RoleRequirementProfile {
  role: string;
  requiredSkills: string[];
  optionalSkills: string[];
  preferredCategories: SkillCategory[];
}

export const DEFAULT_ROLE = "Software Engineer";

export const ROLE_REQUIREMENTS: Record<string, RoleRequirementProfile> = {
  "Software Engineer": {
    role: "Software Engineer",
    requiredSkills: ["dsa", "oops", "dbms", "os", "git"],
    optionalSkills: ["system design", "testing", "ci/cd", "cloud", "sql"],
    preferredCategories: ["dsa", "dbms", "os", "backend", "projects", "tech-stack"],
  },
  "Frontend Developer": {
    role: "Frontend Developer",
    requiredSkills: ["html", "css", "javascript", "react", "typescript"],
    optionalSkills: ["next.js", "performance", "accessibility", "testing"],
    preferredCategories: ["frontend", "projects", "tech-stack", "tool"],
  },
  "Backend Developer": {
    role: "Backend Developer",
    requiredSkills: ["api", "dbms", "sql", "node.js", "authentication"],
    optionalSkills: ["redis", "microservices", "docker", "system design"],
    preferredCategories: ["backend", "dbms", "os", "projects", "tool"],
  },
  "Full Stack Developer": {
    role: "Full Stack Developer",
    requiredSkills: ["javascript", "react", "api", "dbms", "sql"],
    optionalSkills: ["next.js", "node.js", "docker", "cloud"],
    preferredCategories: ["frontend", "backend", "dbms", "projects", "tech-stack"],
  },
  "Data Analyst": {
    role: "Data Analyst",
    requiredSkills: ["sql", "excel", "statistics", "python"],
    optionalSkills: ["power bi", "tableau", "pandas", "data modeling"],
    preferredCategories: ["dbms", "language", "tool", "projects"],
  },
};

export const CATEGORY_KEYWORDS: Array<{ keyword: string; category: SkillCategory }> = [
  { keyword: "dsa", category: "dsa" },
  { keyword: "algorithm", category: "dsa" },
  { keyword: "data structure", category: "dsa" },
  { keyword: "os", category: "os" },
  { keyword: "operating system", category: "os" },
  { keyword: "dbms", category: "dbms" },
  { keyword: "database", category: "dbms" },
  { keyword: "sql", category: "dbms" },
  { keyword: "cn", category: "cn" },
  { keyword: "computer network", category: "cn" },
  { keyword: "react", category: "frontend" },
  { keyword: "next.js", category: "frontend" },
  { keyword: "nextjs", category: "frontend" },
  { keyword: "html", category: "frontend" },
  { keyword: "css", category: "frontend" },
  { keyword: "javascript", category: "frontend" },
  { keyword: "typescript", category: "frontend" },
  { keyword: "node", category: "backend" },
  { keyword: "spring", category: "backend" },
  { keyword: "java", category: "language" },
  { keyword: "python", category: "language" },
  { keyword: "c++", category: "language" },
  { keyword: "git", category: "tool" },
  { keyword: "docker", category: "tool" },
  { keyword: "kubernetes", category: "tool" },
  { keyword: "aws", category: "tool" },
  { keyword: "azure", category: "tool" },
  { keyword: "project", category: "projects" },
];

export const OUTDATED_TECH: string[] = [
  "jquery",
  "bootstrap 3",
  "php 5",
  "angularjs",
  "svn",
  "struts",
  "visual basic",
  "adonet",
];

export const STRONG_PROJECT_KEYWORDS = [
  "scalable",
  "optimized",
  "latency",
  "throughput",
  "deployed",
  "architecture",
  "distributed",
  "microservice",
  "testing",
  "monitoring",
  "ci/cd",
  "kubernetes",
  "cache",
  "performance",
];

export const WEAK_PROJECT_KEYWORDS = [
  "basic",
  "simple",
  "college mini project",
  "tutorial",
  "sample",
  "clone",
  "beginner",
];
