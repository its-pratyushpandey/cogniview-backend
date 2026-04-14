"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResumePreview } from "@/features/resume-builder/components/ResumePreview";
import type {
  ResumeAIGenerationSection,
  ResumeBuilderAnalysisSeed,
  ResumeBuilderContextResponse,
  ResumeBuilderDocument,
  ResumeTemplateId,
} from "@/features/resume-builder/types";
import {
  buildDocumentFromAnalysis,
  createEducationItem,
  createEmptyResumeDocument,
  createExperienceItem,
  createProjectItem,
  normalizeSkillsInput,
  reorderSections,
  sectionLabel,
} from "@/features/resume-builder/utils/document";
import { exportResumeToPdf } from "@/features/resume-builder/utils/pdf";

interface ResumeBuilderPanelProps {
  userId: string;
}

interface SectionGenerateResponse {
  success: boolean;
  section?: ResumeAIGenerationSection;
  result?: {
    summary?: string;
    bullets?: string[];
    skills?: string[];
  };
  error?: string;
}

const TEMPLATE_OPTIONS: Array<{ id: ResumeTemplateId; label: string; subtitle: string }> = [
  {
    id: "executive",
    label: "Executive Carbon",
    subtitle: "Balanced and ATS-friendly",
  },
  {
    id: "zenith",
    label: "Zenith Aura",
    subtitle: "Gradient modern profile",
  },
  {
    id: "matrix",
    label: "Matrix Mono",
    subtitle: "High-contrast engineering style",
  },
];

function toBulletArray(value: string): string[] {
  return value
    .split(/\n+/g)
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);
}

function formatSavedTime(value: string | null): string {
  if (!value) {
    return "Not saved yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not saved yet";
  }

  return date.toLocaleString();
}

export function ResumeBuilderPanel({ userId }: ResumeBuilderPanelProps) {
  const [document, setDocument] = React.useState<ResumeBuilderDocument>(() => createEmptyResumeDocument());
  const [analysis, setAnalysis] = React.useState<ResumeBuilderAnalysisSeed | null>(null);
  const [loadingContext, setLoadingContext] = React.useState(true);
  const [savingDraft, setSavingDraft] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = React.useState<string | null>(null);

  const applyDocumentUpdate = React.useCallback(
    (updater: (current: ResumeBuilderDocument) => ResumeBuilderDocument) => {
      setDocument((current) => {
        const next = updater(current);
        return {
          ...next,
          updatedAt: new Date().toISOString(),
        };
      });
      setIsDirty(true);
    },
    []
  );

  const loadContext = React.useCallback(async () => {
    setLoadingContext(true);

    try {
      const response = await fetch(`/api/resume-builder/context?userId=${encodeURIComponent(userId)}`);
      const payload = (await response.json()) as ResumeBuilderContextResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load resume builder context");
      }

      if (payload.analysis) {
        setAnalysis(payload.analysis);
      }

      if (payload.draft) {
        setDocument(payload.draft);
        setLastSavedAt(payload.draftUpdatedAt);
        setIsDirty(false);
        return;
      }

      if (payload.analysis) {
        setDocument(buildDocumentFromAnalysis(payload.analysis));
        setIsDirty(true);
      }
    } catch (error) {
      console.error("[resume-builder] context load failed", error);
      toast.error(error instanceof Error ? error.message : "Failed to load builder context");
    } finally {
      setLoadingContext(false);
    }
  }, [userId]);

  React.useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const requestAIGeneration = React.useCallback(
    async (section: ResumeAIGenerationSection, payload: Record<string, unknown>, trackingKey: string) => {
      setGeneratingKey(trackingKey);

      try {
        const response = await fetch("/api/resume-builder/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            targetRole: document.targetRole,
            section,
            payload,
            analysisId: analysis?.analysisId,
          }),
        });

        const body = (await response.json()) as SectionGenerateResponse;
        if (!response.ok || !body.success || !body.result) {
          throw new Error(body.error || "AI generation failed");
        }

        return body.result;
      } finally {
        setGeneratingKey(null);
      }
    },
    [analysis?.analysisId, document.targetRole, userId]
  );

  const handleSaveDraft = React.useCallback(async () => {
    setSavingDraft(true);

    try {
      const response = await fetch("/api/resume-builder/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          document,
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        updatedAt?: string;
        draft?: ResumeBuilderDocument;
      };

      if (!response.ok || !payload.success || !payload.updatedAt || !payload.draft) {
        throw new Error(payload.error || "Failed to save draft");
      }

      setDocument(payload.draft);
      setLastSavedAt(payload.updatedAt);
      setIsDirty(false);
      toast.success("Resume draft saved to Firestore");
    } catch (error) {
      console.error("[resume-builder] save failed", error);
      toast.error(error instanceof Error ? error.message : "Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  }, [document, userId]);

  const handleImportFromAnalysis = React.useCallback(() => {
    if (!analysis) {
      toast.error("No resume analysis available yet");
      return;
    }

    const importedDocument = buildDocumentFromAnalysis(analysis);

    setDocument((current) => ({
      ...importedDocument,
      header: {
        ...importedDocument.header,
        fullName: current.header.fullName || importedDocument.header.fullName,
        email: current.header.email || importedDocument.header.email,
        phone: current.header.phone || importedDocument.header.phone,
        location: current.header.location || importedDocument.header.location,
        linkedin: current.header.linkedin || importedDocument.header.linkedin,
        github: current.header.github || importedDocument.header.github,
        portfolio: current.header.portfolio || importedDocument.header.portfolio,
      },
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    }));

    setIsDirty(true);
    toast.success("Imported highlights from resume analysis");
  }, [analysis]);

  const handleGenerateSummary = React.useCallback(async () => {
    try {
      const result = await requestAIGeneration(
        "summary",
        {
          summary: document.summary,
          strengths: analysis?.intelligence.strengths ?? [],
          skills: document.skills,
        },
        "summary"
      );

      if (!result?.summary) {
        return;
      }

      applyDocumentUpdate((current) => ({
        ...current,
        summary: result.summary ?? current.summary,
      }));

      toast.success("Generated professional summary");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate summary");
    }
  }, [analysis?.intelligence.strengths, applyDocumentUpdate, document.skills, document.summary, requestAIGeneration]);

  const handleGenerateSkills = React.useCallback(async () => {
    try {
      const result = await requestAIGeneration(
        "skills",
        {
          skills: document.skills,
          weaknessTopics: analysis?.intelligence.weaknesses.map((weakness) => weakness.topic) ?? [],
        },
        "skills"
      );

      if (!result?.skills) {
        return;
      }

      applyDocumentUpdate((current) => ({
        ...current,
        skills: result.skills ?? current.skills,
      }));

      toast.success("Optimized skills list");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to optimize skills");
    }
  }, [analysis?.intelligence.weaknesses, applyDocumentUpdate, document.skills, requestAIGeneration]);

  const handleGenerateExperience = React.useCallback(
    async (experienceId: string) => {
      const target = document.experience.find((entry) => entry.id === experienceId);
      if (!target) {
        return;
      }

      try {
        const result = await requestAIGeneration(
          "experience",
          {
            company: target.company,
            role: target.role,
            summary: target.summary,
            bullets: target.bullets,
            skills: document.skills,
          },
          `experience-${experienceId}`
        );

        if (!result?.summary && !result?.bullets) {
          return;
        }

        applyDocumentUpdate((current) => ({
          ...current,
          experience: current.experience.map((entry) =>
            entry.id === experienceId
              ? {
                  ...entry,
                  summary: result.summary ?? entry.summary,
                  bullets: result.bullets ?? entry.bullets,
                }
              : entry
          ),
        }));

        toast.success("Experience section optimized");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to optimize experience");
      }
    },
    [applyDocumentUpdate, document.experience, document.skills, requestAIGeneration]
  );

  const handleGenerateProject = React.useCallback(
    async (projectId: string) => {
      const target = document.projects.find((entry) => entry.id === projectId);
      if (!target) {
        return;
      }

      try {
        const result = await requestAIGeneration(
          "project",
          {
            name: target.name,
            role: target.role,
            technologies: target.technologies,
            summary: target.summary,
            bullets: target.bullets,
          },
          `project-${projectId}`
        );

        if (!result?.summary && !result?.bullets) {
          return;
        }

        applyDocumentUpdate((current) => ({
          ...current,
          projects: current.projects.map((entry) =>
            entry.id === projectId
              ? {
                  ...entry,
                  summary: result.summary ?? entry.summary,
                  bullets: result.bullets ?? entry.bullets,
                }
              : entry
          ),
        }));

        toast.success("Project section optimized");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to optimize project");
      }
    },
    [applyDocumentUpdate, document.projects, requestAIGeneration]
  );

  const handleExportPdf = React.useCallback(async () => {
    try {
      await exportResumeToPdf(document);
      toast.success("PDF downloaded");
    } catch (error) {
      console.error("[resume-builder] pdf export failed", error);
      toast.error("Failed to export PDF");
    }
  }, [document]);

  if (loadingContext) {
    return (
      <div className="mx-auto w-full max-w-7xl px-2 py-5 sm:px-4 lg:px-6">
        <Card className="border-border/80 bg-card/70">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading resume builder workspace...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-4 px-2 pb-6 pt-4 sm:px-4 lg:px-6">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="rounded-3xl border border-border/80 bg-[linear-gradient(150deg,rgba(17,24,39,0.96),rgba(9,12,20,0.95))] p-4 shadow-xl shadow-black/35 sm:p-5"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              AI Resume Builder
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Build, optimize, and export role-focused resumes
            </h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Left side controls your data and AI generation. Right side is a live editable preview with multiple modern
              templates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full text-xs">
              Last saved: {formatSavedTime(lastSavedAt)}
            </Badge>
            <Badge variant="outline" className="rounded-full text-xs">
              {isDirty ? "Unsaved changes" : "Synced"}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <Download className="h-4 w-4" />
              PDF
            </Button>
            <Button variant="default" size="sm" onClick={handleSaveDraft} disabled={savingDraft}>
              {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Draft
            </Button>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05, ease: "easeOut" }}
          className="space-y-4"
        >
          {analysis ? (
            <Card className="border-primary/25 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resume Analysis Insights Detected</CardTitle>
                <CardDescription>
                  Recommended roles and weak-signal focus from your latest analysis can be injected directly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {(analysis.intelligence.recommendedRoles.length > 0
                    ? analysis.intelligence.recommendedRoles
                    : ["Software Engineer"]
                  )
                    .slice(0, 4)
                    .map((role) => (
                      <Badge key={role} variant="outline" className="text-[11px]">
                        {role}
                      </Badge>
                    ))}
                </div>

                <p className="text-xs text-muted-foreground">
                  Focus topics: {analysis.intelligence.weaknesses.map((weakness) => weakness.topic).slice(0, 4).join(", ") || "N/A"}
                </p>

                <Button variant="secondary" size="sm" onClick={handleImportFromAnalysis}>
                  Import From Analysis
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border/80 bg-card/75">
            <CardHeader>
              <CardTitle className="text-base">Template Selection</CardTitle>
              <CardDescription>Switch templates instantly while editing.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-3">
              {TEMPLATE_OPTIONS.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() =>
                    applyDocumentUpdate((current) => ({
                      ...current,
                      templateId: template.id,
                    }))
                  }
                  className={`rounded-2xl border px-3 py-2 text-left transition ${
                    document.templateId === template.id
                      ? "border-primary/50 bg-primary/15"
                      : "border-border/80 bg-secondary/45 hover:border-primary/30"
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">{template.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{template.subtitle}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/75">
            <CardHeader>
              <CardTitle className="text-base">Section Order</CardTitle>
              <CardDescription>Control how sections appear in the exported resume.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {document.sectionOrder.map((section, index) => (
                <div key={section} className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/45 px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{sectionLabel(section)}</p>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move ${section} up`}
                      disabled={index === 0}
                      onClick={() =>
                        applyDocumentUpdate((current) => ({
                          ...current,
                          sectionOrder: reorderSections(current.sectionOrder, section, "up"),
                        }))
                      }
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move ${section} down`}
                      disabled={index === document.sectionOrder.length - 1}
                      onClick={() =>
                        applyDocumentUpdate((current) => ({
                          ...current,
                          sectionOrder: reorderSections(current.sectionOrder, section, "down"),
                        }))
                      }
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/75">
            <CardHeader>
              <CardTitle className="text-base">Profile Header</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Target Role</Label>
                <Input
                  value={document.targetRole}
                  onChange={(event) =>
                    applyDocumentUpdate((current) => ({
                      ...current,
                      targetRole: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input
                  value={document.header.fullName}
                  onChange={(event) =>
                    applyDocumentUpdate((current) => ({
                      ...current,
                      header: {
                        ...current.header,
                        fullName: event.target.value,
                      },
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Headline</Label>
                <Input
                  value={document.header.headline}
                  onChange={(event) =>
                    applyDocumentUpdate((current) => ({
                      ...current,
                      header: {
                        ...current.header,
                        headline: event.target.value,
                      },
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={document.header.email}
                  onChange={(event) =>
                    applyDocumentUpdate((current) => ({
                      ...current,
                      header: {
                        ...current.header,
                        email: event.target.value,
                      },
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={document.header.phone}
                  onChange={(event) =>
                    applyDocumentUpdate((current) => ({
                      ...current,
                      header: {
                        ...current.header,
                        phone: event.target.value,
                      },
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input
                  value={document.header.location}
                  onChange={(event) =>
                    applyDocumentUpdate((current) => ({
                      ...current,
                      header: {
                        ...current.header,
                        location: event.target.value,
                      },
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>LinkedIn</Label>
                <Input
                  value={document.header.linkedin}
                  onChange={(event) =>
                    applyDocumentUpdate((current) => ({
                      ...current,
                      header: {
                        ...current.header,
                        linkedin: event.target.value,
                      },
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>GitHub</Label>
                <Input
                  value={document.header.github}
                  onChange={(event) =>
                    applyDocumentUpdate((current) => ({
                      ...current,
                      header: {
                        ...current.header,
                        github: event.target.value,
                      },
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Portfolio</Label>
                <Input
                  value={document.header.portfolio}
                  onChange={(event) =>
                    applyDocumentUpdate((current) => ({
                      ...current,
                      header: {
                        ...current.header,
                        portfolio: event.target.value,
                      },
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/75">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Professional Summary</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleGenerateSummary()}
                  disabled={generatingKey === "summary"}
                >
                  {generatingKey === "summary" ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                  AI Generate
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={5}
                value={document.summary}
                onChange={(event) =>
                  applyDocumentUpdate((current) => ({
                    ...current,
                    summary: event.target.value,
                  }))
                }
                placeholder="Write a concise summary focused on impact, ownership, and strengths."
              />
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/75">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Skills</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleGenerateSkills()}
                  disabled={generatingKey === "skills"}
                >
                  {generatingKey === "skills" ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                  Optimize Skills
                </Button>
              </div>
              <CardDescription>Use comma-separated or line-separated format.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                value={document.skills.join(", ")}
                onChange={(event) => {
                  const parsedSkills = normalizeSkillsInput(event.target.value);
                  applyDocumentUpdate((current) => ({
                    ...current,
                    skills: parsedSkills,
                  }));
                }}
                placeholder="React, TypeScript, Next.js, Node.js, SQL, System Design"
              />
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/75">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Experience</CardTitle>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    applyDocumentUpdate((current) => ({
                      ...current,
                      experience: [...current.experience, createExperienceItem()],
                    }))
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add Experience
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <AnimatePresence initial={false}>
                <div className="space-y-3">
                  {document.experience.map((experience) => {
                    const cardKey = `experience-${experience.id}`;
                    const isGenerating = generatingKey === cardKey;

                    return (
                      <motion.div
                        key={experience.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="rounded-2xl border border-border/70 bg-secondary/40 p-3"
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Role</Label>
                            <Input
                              value={experience.role}
                              onChange={(event) =>
                                applyDocumentUpdate((current) => ({
                                  ...current,
                                  experience: current.experience.map((entry) =>
                                    entry.id === experience.id ? { ...entry, role: event.target.value } : entry
                                  ),
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Company</Label>
                            <Input
                              value={experience.company}
                              onChange={(event) =>
                                applyDocumentUpdate((current) => ({
                                  ...current,
                                  experience: current.experience.map((entry) =>
                                    entry.id === experience.id ? { ...entry, company: event.target.value } : entry
                                  ),
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Start Date</Label>
                            <Input
                              value={experience.startDate}
                              onChange={(event) =>
                                applyDocumentUpdate((current) => ({
                                  ...current,
                                  experience: current.experience.map((entry) =>
                                    entry.id === experience.id ? { ...entry, startDate: event.target.value } : entry
                                  ),
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>End Date</Label>
                            <Input
                              value={experience.endDate}
                              onChange={(event) =>
                                applyDocumentUpdate((current) => ({
                                  ...current,
                                  experience: current.experience.map((entry) =>
                                    entry.id === experience.id ? { ...entry, endDate: event.target.value } : entry
                                  ),
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <Label>Summary</Label>
                          <Textarea
                            rows={2}
                            value={experience.summary}
                            onChange={(event) =>
                              applyDocumentUpdate((current) => ({
                                ...current,
                                experience: current.experience.map((entry) =>
                                  entry.id === experience.id ? { ...entry, summary: event.target.value } : entry
                                ),
                              }))
                            }
                          />
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <Label>Bullets (one per line)</Label>
                          <Textarea
                            rows={4}
                            value={experience.bullets.join("\n")}
                            onChange={(event) => {
                              const nextBullets = toBulletArray(event.target.value);
                              applyDocumentUpdate((current) => ({
                                ...current,
                                experience: current.experience.map((entry) =>
                                  entry.id === experience.id ? { ...entry, bullets: nextBullets } : entry
                                ),
                              }));
                            }}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleGenerateExperience(experience.id)}
                            disabled={isGenerating}
                          >
                            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                            AI Optimize
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              applyDocumentUpdate((current) => ({
                                ...current,
                                experience:
                                  current.experience.length > 1
                                    ? current.experience.filter((entry) => entry.id !== experience.id)
                                    : current.experience,
                              }))
                            }
                            disabled={document.experience.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </AnimatePresence>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/75">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Projects</CardTitle>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    applyDocumentUpdate((current) => ({
                      ...current,
                      projects: [...current.projects, createProjectItem()],
                    }))
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add Project
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <AnimatePresence initial={false}>
                <div className="space-y-3">
                  {document.projects.map((project) => {
                    const cardKey = `project-${project.id}`;
                    const isGenerating = generatingKey === cardKey;

                    return (
                      <motion.div
                        key={project.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="rounded-2xl border border-border/70 bg-secondary/40 p-3"
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Project Name</Label>
                            <Input
                              value={project.name}
                              onChange={(event) =>
                                applyDocumentUpdate((current) => ({
                                  ...current,
                                  projects: current.projects.map((entry) =>
                                    entry.id === project.id ? { ...entry, name: event.target.value } : entry
                                  ),
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Your Role</Label>
                            <Input
                              value={project.role}
                              onChange={(event) =>
                                applyDocumentUpdate((current) => ({
                                  ...current,
                                  projects: current.projects.map((entry) =>
                                    entry.id === project.id ? { ...entry, role: event.target.value } : entry
                                  ),
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <Label>Technologies (comma separated)</Label>
                          <Input
                            value={project.technologies.join(", ")}
                            onChange={(event) => {
                              const technologies = normalizeSkillsInput(event.target.value);
                              applyDocumentUpdate((current) => ({
                                ...current,
                                projects: current.projects.map((entry) =>
                                  entry.id === project.id ? { ...entry, technologies } : entry
                                ),
                              }));
                            }}
                          />
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <Label>Summary</Label>
                          <Textarea
                            rows={2}
                            value={project.summary}
                            onChange={(event) =>
                              applyDocumentUpdate((current) => ({
                                ...current,
                                projects: current.projects.map((entry) =>
                                  entry.id === project.id ? { ...entry, summary: event.target.value } : entry
                                ),
                              }))
                            }
                          />
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <Label>Bullets (one per line)</Label>
                          <Textarea
                            rows={4}
                            value={project.bullets.join("\n")}
                            onChange={(event) => {
                              const bullets = toBulletArray(event.target.value);
                              applyDocumentUpdate((current) => ({
                                ...current,
                                projects: current.projects.map((entry) =>
                                  entry.id === project.id ? { ...entry, bullets } : entry
                                ),
                              }));
                            }}
                          />
                        </div>

                        <div className="mt-3 space-y-1.5">
                          <Label>Project Link</Label>
                          <Input
                            value={project.link}
                            onChange={(event) =>
                              applyDocumentUpdate((current) => ({
                                ...current,
                                projects: current.projects.map((entry) =>
                                  entry.id === project.id ? { ...entry, link: event.target.value } : entry
                                ),
                              }))
                            }
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleGenerateProject(project.id)}
                            disabled={isGenerating}
                          >
                            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                            AI Optimize
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              applyDocumentUpdate((current) => ({
                                ...current,
                                projects:
                                  current.projects.length > 1
                                    ? current.projects.filter((entry) => entry.id !== project.id)
                                    : current.projects,
                              }))
                            }
                            disabled={document.projects.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </AnimatePresence>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/75">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Education</CardTitle>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    applyDocumentUpdate((current) => ({
                      ...current,
                      education: [...current.education, createEducationItem()],
                    }))
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add Education
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {document.education.map((education) => (
                  <div key={education.id} className="rounded-2xl border border-border/70 bg-secondary/40 p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Institution</Label>
                        <Input
                          value={education.institution}
                          onChange={(event) =>
                            applyDocumentUpdate((current) => ({
                              ...current,
                              education: current.education.map((entry) =>
                                entry.id === education.id ? { ...entry, institution: event.target.value } : entry
                              ),
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Degree</Label>
                        <Input
                          value={education.degree}
                          onChange={(event) =>
                            applyDocumentUpdate((current) => ({
                              ...current,
                              education: current.education.map((entry) =>
                                entry.id === education.id ? { ...entry, degree: event.target.value } : entry
                              ),
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Score</Label>
                        <Input
                          value={education.score}
                          onChange={(event) =>
                            applyDocumentUpdate((current) => ({
                              ...current,
                              education: current.education.map((entry) =>
                                entry.id === education.id ? { ...entry, score: event.target.value } : entry
                              ),
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Timeline</Label>
                        <Input
                          value={`${education.startDate}${education.endDate ? ` - ${education.endDate}` : ""}`}
                          onChange={(event) => {
                            const [startDate, endDate] = event.target.value.split("-").map((value) => value.trim());
                            applyDocumentUpdate((current) => ({
                              ...current,
                              education: current.education.map((entry) =>
                                entry.id === education.id ? { ...entry, startDate: startDate || "", endDate: endDate || "" } : entry
                              ),
                            }));
                          }}
                          placeholder="2022 - 2026"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          applyDocumentUpdate((current) => ({
                            ...current,
                            education:
                              current.education.length > 1
                                ? current.education.filter((entry) => entry.id !== education.id)
                                : current.education,
                          }))
                        }
                        disabled={document.education.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void loadContext()}>
              Reload Context
            </Button>
            <Button variant="outline" onClick={handleExportPdf}>
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
            <Button onClick={handleSaveDraft} disabled={savingDraft}>
              {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save to Firestore
            </Button>
          </div>
        </motion.div>

        <motion.aside
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12, ease: "easeOut" }}
          className="xl:sticky xl:top-[5.2rem] xl:h-[calc(100dvh-6.5rem)] xl:overflow-auto"
        >
          <ResumePreview document={document} onChange={applyDocumentUpdate} />
        </motion.aside>
      </div>
    </div>
  );
}
