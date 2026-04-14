"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

import type { QuestionGenerationMode, ResumeIntelligence } from "@/features/resume-analysis/types";
import { useQuestionGenerator } from "@/features/resume-analysis/hooks/useQuestionGenerator";
import { useResumeAnalysis } from "@/features/resume-analysis/hooks/useResumeAnalysis";
import { useResumePipeline } from "@/features/intelligence/hooks/useResumePipeline";
import { AnalysisDashboard } from "@/features/resume-analysis/components/AnalysisDashboard";
import { ResumeUploadSection } from "@/features/resume-analysis/components/ResumeUploadSection";
import styles from "@/features/resume-analysis/components/resume-analysis.module.css";

const QuestionGeneratorSection = dynamic(
  () => import("@/features/resume-analysis/components/QuestionGeneratorSection").then((mod) => mod.QuestionGeneratorSection),
  {
    loading: () => (
      <section className={`${styles.glassCard} ${styles.questionSection}`}>
        <div className={styles.skeleton} style={{ height: "1rem", width: "45%", marginBottom: "0.7rem" }} />
        <div className={styles.skeleton} style={{ height: "0.9rem", width: "100%", marginBottom: "0.5rem" }} />
        <div className={styles.skeleton} style={{ height: "0.9rem", width: "70%" }} />
      </section>
    ),
  }
);

interface ResumeAnalysisShellProps {
  userId: string;
}

const SUBJECT_HINTS: Array<{ subject: string; keywords: string[] }> = [
  {
    subject: "OS",
    keywords: ["os", "operating", "thread", "process", "deadlock", "cpu", "scheduling", "mutex", "concurrency"],
  },
  {
    subject: "DBMS",
    keywords: ["db", "dbms", "database", "sql", "index", "transaction", "normalization", "query", "joins"],
  },
  {
    subject: "OOPS",
    keywords: ["oops", "object", "class", "inheritance", "polymorphism", "encapsulation", "abstraction", "solid"],
  },
  {
    subject: "CN",
    keywords: ["network", "cn", "http", "tcp", "udp", "ip", "dns", "socket", "latency"],
  },
  {
    subject: "DSA",
    keywords: ["dsa", "algorithm", "array", "string", "tree", "graph", "dp", "recursion", "hash", "queue", "stack"],
  },
];

function inferSubject(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const entry of SUBJECT_HINTS) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword))) {
      return entry.subject;
    }
  }

  return null;
}

function resolveMockSubject(input: {
  selectedRole: string;
  intelligence: ResumeIntelligence | null;
  focusAreas: string[];
}): string {
  const fromWeakness = input.intelligence?.weaknesses.map((weakness) => weakness.topic) ?? [];
  const candidates = [...fromWeakness, ...input.focusAreas, input.selectedRole];

  for (const candidate of candidates) {
    const subject = inferSubject(candidate);
    if (subject) {
      return subject;
    }
  }

  return "DSA";
}

function resolveMockTopic(input: {
  selectedRole: string;
  intelligence: ResumeIntelligence | null;
  focusAreas: string[];
}): string {
  return (
    input.intelligence?.weaknesses[0]?.topic ||
    input.focusAreas[0] ||
    input.intelligence?.missingKeySkills[0] ||
    `${input.selectedRole} fundamentals`
  );
}

interface CompanyListItem {
  id: string;
  name: string;
}

interface CompanyRoleSuggestionPayload {
  companyIds: string[];
  roleIds: string[];
}

interface CompanyListPayload {
  companies: CompanyListItem[];
  suggestions?: CompanyRoleSuggestionPayload;
}

interface RoleItem {
  id: string;
  name: string;
}

interface RolesPayload {
  roles: RoleItem[];
}

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveSuggestedRoleId(input: {
  roles: RoleItem[];
  suggestedRoleIds: string[];
  suggestedRoleName: string;
}): string | null {
  const fromSuggestions = input.suggestedRoleIds.find((roleId) =>
    input.roles.some((role) => role.id === roleId)
  );

  if (fromSuggestions) {
    return fromSuggestions;
  }

  const normalizedSuggestedRole = normalizeLabel(input.suggestedRoleName);
  if (!normalizedSuggestedRole) {
    return input.roles[0]?.id ?? null;
  }

  const exact = input.roles.find((role) => normalizeLabel(role.name) === normalizedSuggestedRole);
  if (exact) {
    return exact.id;
  }

  const partial = input.roles.find((role) => {
    const normalizedRoleName = normalizeLabel(role.name);
    return (
      normalizedRoleName.includes(normalizedSuggestedRole) ||
      normalizedSuggestedRole.includes(normalizedRoleName)
    );
  });

  return partial?.id ?? input.roles[0]?.id ?? null;
}

export function ResumeAnalysisShell({ userId }: ResumeAnalysisShellProps) {
  const router = useRouter();
  const [resumeText, setResumeText] = useState("");
  const [selectedRole, setSelectedRole] = useState("Software Engineer");
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchingInterview, setLaunchingInterview] = useState(false);
  const [autoPrepMessage, setAutoPrepMessage] = useState<string | null>(null);

  const lastAutoGeneratedForRef = useRef<string | null>(null);
  const lastPipelinePlanForRef = useRef<string | null>(null);

  const resumeAnalysis = useResumeAnalysis(userId);
  const questionGenerator = useQuestionGenerator(userId);
  const resumePipeline = useResumePipeline();

  const intelligence = resumeAnalysis.response?.intelligence ?? null;
  const analysisId = resumeAnalysis.response?.analysisId;

  const resolvedFocusAreas = useMemo(() => {
    if (questionGenerator.focusAreas.length > 0) {
      return questionGenerator.focusAreas;
    }

    return intelligence?.weaknesses.map((weakness) => weakness.topic).slice(0, 8) ?? [];
  }, [intelligence?.weaknesses, questionGenerator.focusAreas]);

  const recommendedMockSubject = useMemo(
    () =>
      resolveMockSubject({
        selectedRole,
        intelligence,
        focusAreas: resolvedFocusAreas,
      }),
    [intelligence, resolvedFocusAreas, selectedRole]
  );

  const recommendedMockTopic = useMemo(
    () =>
      resolveMockTopic({
        selectedRole,
        intelligence,
        focusAreas: resolvedFocusAreas,
      }),
    [intelligence, resolvedFocusAreas, selectedRole]
  );

  const recommendedDifficulty = intelligence?.experienceLevel ?? "Intermediate";

  const mockTestHref = useMemo(() => {
    const params = new URLSearchParams({
      source: "resume",
      role: selectedRole,
      subject: recommendedMockSubject,
      topic: recommendedMockTopic,
      difficulty: recommendedDifficulty,
      companyType: "Product-based",
      focus: "Company-specific",
      count: "10",
      autostart: "1",
    });

    return `/mcq?${params.toString()}`;
  }, [recommendedDifficulty, recommendedMockSubject, recommendedMockTopic, selectedRole]);

  const prepareAutoPrepRedirect = useCallback(
    async (input: { analysisId: string; suggestedRole: string }) => {
      setAutoPrepMessage("Preparing your personalized plan…");

      const listResponse = await fetch(`/api/company/list?userId=${encodeURIComponent(userId)}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!listResponse.ok) {
        throw new Error("Unable to load company suggestions. Please try again.");
      }

      const listPayload = (await listResponse.json()) as CompanyListPayload;
      const companies = Array.isArray(listPayload.companies) ? listPayload.companies : [];
      const suggestions = listPayload.suggestions ?? { companyIds: [], roleIds: [] };

      const companyId =
        suggestions.companyIds.find((id) => companies.some((company) => company.id === id)) ??
        companies[0]?.id;

      if (!companyId) {
        router.push("/company-prep?source=resume-auto");
        return;
      }

      const rolesResponse = await fetch(`/api/company/roles?companyId=${encodeURIComponent(companyId)}`, {
        method: "GET",
        cache: "no-store",
      });

      let roleId: string | null = null;

      if (rolesResponse.ok) {
        const rolesPayload = (await rolesResponse.json()) as RolesPayload;
        const roles = Array.isArray(rolesPayload.roles) ? rolesPayload.roles : [];
        roleId = resolveSuggestedRoleId({
          roles,
          suggestedRoleIds: suggestions.roleIds,
          suggestedRoleName: input.suggestedRole,
        });
      }

      if (roleId) {
        const questionPrefetchParams = new URLSearchParams({
          companyId,
          roleId,
          userId,
          limit: "12",
        });

        try {
          await fetch(`/api/company/questions?${questionPrefetchParams.toString()}`, {
            method: "GET",
            cache: "no-store",
          });
        } catch {
          // Keep redirect resilient even if prefetch fails.
        }
      }

      const redirectParams = new URLSearchParams({
        companyId,
        source: "resume-auto",
        analysisId: input.analysisId,
      });

      if (roleId) {
        redirectParams.set("roleId", roleId);
      }

      router.push(`/company-prep?${redirectParams.toString()}`);
    },
    [router, userId]
  );

  const handleLaunchInterview = useCallback(async () => {
    if (!analysisId || !intelligence) {
      setLaunchError("Analyze resume first to generate a role-specific interview session.");
      return;
    }

    setLaunchingInterview(true);
    setLaunchError(null);

    try {
      const response = await fetch("/api/resume/launch-interview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          analysisId,
          selectedRole,
          mode: questionGenerator.questions.length > 0 ? questionGenerator.mode : "weak-areas",
          questionCount: 8,
          questions: questionGenerator.questions.map((question) => question.questionText),
          focusAreas: resolvedFocusAreas,
          experienceLevel: intelligence.experienceLevel,
          techstack: intelligence.skills.map((skill) => skill.name).slice(0, 12),
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        interviewId?: string;
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.interviewId) {
        throw new Error(payload.error || "Unable to create interview from resume analysis");
      }

      router.push(`/interview/${payload.interviewId}`);
    } catch (launchInterviewError) {
      setLaunchError(
        launchInterviewError instanceof Error
          ? launchInterviewError.message
          : "Failed to launch interview. Please try again."
      );
    } finally {
      setLaunchingInterview(false);
    }
  }, [
    analysisId,
    intelligence,
    questionGenerator.mode,
    questionGenerator.questions,
    resolvedFocusAreas,
    router,
    selectedRole,
    userId,
  ]);

  const handleAnalyze = useCallback(
    async (options?: { forceRefresh?: boolean }) => {
      setLaunchError(null);

      const result = await resumeAnalysis.analyzeResume({
        resumeText,
        selectedRole,
        forceRefresh: options?.forceRefresh,
      });

      if (!result) {
        setAutoPrepMessage(null);
        return;
      }

      const suggestedRole = result.intelligence.recommendedRoles[0]?.trim() || selectedRole;

      if (suggestedRole !== selectedRole) {
        setSelectedRole(suggestedRole);
      }

      await resumePipeline.syncResumeAnalysis({
        selectedRole: suggestedRole,
        recommendedRoles: result.intelligence.recommendedRoles,
        missingSkills: result.intelligence.missingKeySkills,
        weakAreas: result.intelligence.weaknesses.map((weakness) => weakness.topic),
        experienceLevel: result.intelligence.experienceLevel,
      });

      const generated = await questionGenerator.generateQuestions({
        analysisId: result.analysisId,
        selectedRole: suggestedRole,
        mode: "weak-areas",
      });

      if (!generated) {
        setAutoPrepMessage(null);
        setLaunchError("Unable to auto-generate questions. Please try again.");
        return;
      }

      const planKey = `${result.analysisId}:weak-areas`;
      lastPipelinePlanForRef.current = planKey;

      await resumePipeline.recordQuestionPlan({
        selectedRole: suggestedRole,
        mode: "weak-areas",
        count: generated.questions.length,
        focusAreas: generated.focusAreas,
      });

      lastAutoGeneratedForRef.current = result.analysisId;

      try {
        await prepareAutoPrepRedirect({
          analysisId: result.analysisId,
          suggestedRole,
        });
      } catch (pipelineError) {
        setAutoPrepMessage(null);
        setLaunchError(
          pipelineError instanceof Error
            ? pipelineError.message
            : "Unable to complete automatic prep routing."
        );
      }
    },
    [prepareAutoPrepRedirect, questionGenerator, resumeAnalysis, resumePipeline, resumeText, selectedRole]
  );

  useEffect(() => {
    if (!analysisId || !intelligence) {
      return;
    }

    if (lastAutoGeneratedForRef.current === analysisId) {
      return;
    }

    lastAutoGeneratedForRef.current = analysisId;

    void (async () => {
      const generated = await questionGenerator.generateQuestions({
        analysisId,
        selectedRole,
        mode: "weak-areas",
      });

      if (!generated) {
        return;
      }

      const planKey = `${analysisId}:weak-areas`;
      if (lastPipelinePlanForRef.current === planKey) {
        return;
      }

      lastPipelinePlanForRef.current = planKey;
      await resumePipeline.recordQuestionPlan({
        selectedRole,
        mode: "weak-areas",
        count: generated.questions.length,
        focusAreas: generated.focusAreas,
      });
    })();
  }, [analysisId, intelligence, questionGenerator, resumePipeline, selectedRole]);

  const handleGenerate = useCallback(
    async (modeOverride?: QuestionGenerationMode) => {
      if (!analysisId) {
        return;
      }

      const resolvedMode = modeOverride ?? questionGenerator.mode;
      const generated = await questionGenerator.generateQuestions({
        analysisId,
        selectedRole,
        mode: resolvedMode,
        customTopics: resolvedMode === "custom" ? questionGenerator.parsedCustomTopics : undefined,
      });

      if (!generated) {
        return;
      }

      const planKey = `${analysisId}:${resolvedMode}`;
      if (lastPipelinePlanForRef.current === planKey) {
        return;
      }

      lastPipelinePlanForRef.current = planKey;
      await resumePipeline.recordQuestionPlan({
        selectedRole,
        mode: resolvedMode,
        count: generated.questions.length,
        focusAreas: generated.focusAreas,
      });
    },
    [analysisId, questionGenerator, resumePipeline, selectedRole]
  );

  const helperText = useMemo(() => {
    if (resumeAnalysis.status === "loading") {
      return "Analyzing resume, detecting weak signals, and preparing adaptive question targets.";
    }

    if (resumePipeline.pipeline.readyForCompanyPrep) {
      return "Pipeline ready. Continue directly to company-specific prep and mock interview flows.";
    }

    if (intelligence) {
      return `Analysis complete. ${intelligence.weaknesses.length} weakness area(s) detected.`;
    }

    return "Upload your resume to generate role-aligned weaknesses and adaptive interview questions.";
  }, [intelligence, resumeAnalysis.status, resumePipeline.pipeline.readyForCompanyPrep]);

  return (
    <div className={styles.pageRoot}>
      <div className={styles.content}>
        <motion.header
          className={styles.hero}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <span className={styles.pill}>Resume Intelligence Pipeline</span>
          <h1>{"Resume -> Skills -> Weaknesses -> Adaptive Questions"}</h1>
          <p>{helperText}</p>
        </motion.header>

        <div className={styles.grid}>
          <ResumeUploadSection
            resumeText={resumeText}
            selectedRole={selectedRole}
            analyzing={resumeAnalysis.status === "loading"}
            progress={resumeAnalysis.progress}
            errorMessage={resumeAnalysis.error?.message}
            onResumeTextChange={setResumeText}
            onSelectedRoleChange={setSelectedRole}
            onAnalyze={handleAnalyze}
          />

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.06 }}
            className={`${styles.glassCard} ${styles.panel}`}
          >
            <h3 className={styles.panelTitle}>Step 5: Resume-to-Prep Action Pipeline</h3>

            <div className={styles.badges} style={{ marginBottom: "0.7rem" }}>
              <span className={`${styles.skillBadge} ${resumePipeline.pipeline.hasResumeAnalysis ? styles.strong : styles.moderate}`}>
                Resume Analysis {resumePipeline.pipeline.hasResumeAnalysis ? "Done" : "Pending"}
              </span>
              <span className={`${styles.skillBadge} ${resumePipeline.pipeline.hasRoleSelection ? styles.strong : styles.moderate}`}>
                Role Context {resumePipeline.pipeline.hasRoleSelection ? "Set" : "Pending"}
              </span>
              <span className={`${styles.skillBadge} ${resumePipeline.pipeline.hasQuestionPlan ? styles.strong : styles.moderate}`}>
                Question Plan {resumePipeline.pipeline.hasQuestionPlan ? "Ready" : "Pending"}
              </span>
            </div>

            <p className={styles.meta} style={{ marginBottom: "0.4rem" }}>
              Target role: {resumePipeline.pipeline.targetRole ?? selectedRole}
            </p>

            {resumePipeline.pipeline.weakAreas.length > 0 ? (
              <div className={styles.badges} style={{ marginBottom: "0.7rem" }}>
                {resumePipeline.pipeline.weakAreas.map((area) => (
                  <span key={area} className={`${styles.skillBadge} ${styles.weak}`}>
                    {area}
                  </span>
                ))}
              </div>
            ) : null}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
              <Link href={resumePipeline.pipeline.nextActionPath} className={styles.linkButton}>
                Continue Pipeline
              </Link>
              <Link href="/company-prep" className={styles.linkButton}>
                Start Company Prep
              </Link>
              <Link href="/interview" className={styles.linkButton}>
                Launch Interview Practice
              </Link>
            </div>

            {analysisId && intelligence ? (
              <>
                <div className={styles.resumeActionGrid}>
                  <Link href={mockTestHref} className={styles.resumeActionPrimary}>
                    Generate Resume Mock Test
                  </Link>

                  <button
                    type="button"
                    className={styles.resumeActionSecondary}
                    onClick={() => {
                      void handleLaunchInterview();
                    }}
                    disabled={launchingInterview}
                  >
                    {launchingInterview ? "Preparing Interview..." : "Generate Resume Interview"}
                  </button>
                </div>

                <p className={styles.meta} style={{ marginTop: "0.55rem" }}>
                  Role: {selectedRole} · Mock test preset: {recommendedMockSubject} / {recommendedMockTopic}
                </p>

                {launchError ? <div className={styles.alert}>{launchError}</div> : null}
              </>
            ) : null}
          </motion.section>

          {intelligence ? <AnalysisDashboard intelligence={intelligence} /> : null}

          {analysisId ? (
            <QuestionGeneratorSection
              status={questionGenerator.status}
              error={questionGenerator.error}
              mode={questionGenerator.mode}
              setMode={questionGenerator.setMode}
              customTopicsText={questionGenerator.customTopicsText}
              setCustomTopicsText={questionGenerator.setCustomTopicsText}
              questions={questionGenerator.questions}
              focusAreas={questionGenerator.focusAreas}
              onGenerate={(modeOverride) => {
                void handleGenerate(modeOverride);
              }}
            />
          ) : null}
        </div>
      </div>

      {autoPrepMessage ? (
        <div className={styles.autoPrepOverlay} role="status" aria-live="polite">
          <div className={styles.autoPrepCard}>
            <span className={styles.autoPrepSpinner} aria-hidden="true" />
            <h2 className={styles.autoPrepTitle}>Preparing your personalized plan…</h2>
            <p className={styles.autoPrepText}>
              Auto-selecting your role and company, generating your question path, and redirecting you now.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
