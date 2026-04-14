import { z } from "zod";

export const resumeSectionKeySchema = z.enum([
  "summary",
  "experience",
  "projects",
  "education",
  "skills",
]);

export const resumeTemplateSchema = z.enum(["executive", "zenith", "matrix"]);

export const resumeHeaderSchema = z.object({
  fullName: z.string().trim().max(90),
  headline: z.string().trim().max(120),
  email: z.string().trim().max(120),
  phone: z.string().trim().max(40),
  location: z.string().trim().max(100),
  linkedin: z.string().trim().max(200),
  github: z.string().trim().max(200),
  portfolio: z.string().trim().max(200),
});

export const resumeExperienceItemSchema = z.object({
  id: z.string().trim().min(1),
  company: z.string().trim().max(120),
  role: z.string().trim().max(120),
  location: z.string().trim().max(120),
  startDate: z.string().trim().max(40),
  endDate: z.string().trim().max(40),
  current: z.boolean(),
  summary: z.string().trim().max(900),
  bullets: z.array(z.string().trim().min(1).max(260)).max(12),
});

export const resumeProjectItemSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().max(140),
  role: z.string().trim().max(120),
  technologies: z.array(z.string().trim().min(1).max(60)).max(20),
  link: z.string().trim().max(220),
  summary: z.string().trim().max(900),
  bullets: z.array(z.string().trim().min(1).max(260)).max(12),
});

export const resumeEducationItemSchema = z.object({
  id: z.string().trim().min(1),
  institution: z.string().trim().max(160),
  degree: z.string().trim().max(160),
  score: z.string().trim().max(80),
  startDate: z.string().trim().max(40),
  endDate: z.string().trim().max(40),
});

export const resumeBuilderDocumentSchema = z
  .object({
    header: resumeHeaderSchema,
    targetRole: z.string().trim().min(1).max(120),
    summary: z.string().trim().max(1200),
    experience: z.array(resumeExperienceItemSchema).max(8),
    projects: z.array(resumeProjectItemSchema).max(8),
    education: z.array(resumeEducationItemSchema).max(6),
    skills: z.array(z.string().trim().min(1).max(70)).max(40),
    templateId: resumeTemplateSchema,
    sectionOrder: z.array(resumeSectionKeySchema).length(5),
    sourceAnalysisId: z.string().trim().min(1).optional(),
    createdAt: z.string().trim().min(1),
    updatedAt: z.string().trim().min(1),
  })
  .superRefine((value, context) => {
    const uniqueKeys = new Set(value.sectionOrder);
    if (uniqueKeys.size !== value.sectionOrder.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sectionOrder"],
        message: "sectionOrder must contain unique sections",
      });
    }
  });

export const resumeDraftSaveSchema = z.object({
  userId: z.string().trim().min(1),
  document: resumeBuilderDocumentSchema,
});

export const resumeBuilderGenerateSchema = z.object({
  userId: z.string().trim().min(1),
  targetRole: z.string().trim().max(120).optional(),
  section: z.enum(["summary", "experience", "project", "skills"]),
  payload: z.record(z.string(), z.unknown()),
  analysisId: z.string().trim().optional(),
});

export type ResumeBuilderDocumentInput = z.infer<typeof resumeBuilderDocumentSchema>;
