"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, CircleAlert, Sparkles } from "lucide-react";

import { useCompanyData } from "@/features/company-prep/hooks/useCompanyData";
import { useCompanyPrep } from "@/features/company-prep/hooks/useCompanyPrep";
import { CompanySelectionGrid } from "@/features/company-prep/components/CompanySelectionGrid";
import { ProgressPanel } from "@/features/company-prep/components/ProgressPanel";
import { RoleSelector } from "@/features/company-prep/components/RoleSelector";
import { PracticePanel } from "@/features/company-prep/components/PracticePanel";
import { useCompanyContext } from "@/features/intelligence/hooks/useCompanyContext";
import { useAdaptiveEngine } from "@/features/intelligence/hooks/useAdaptiveEngine";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const MockInterviewPanel = dynamic(
  () => import("@/features/company-prep/components/MockInterviewPanel"),
  {
    loading: () => (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Loading mock interview workspace...</CardContent>
      </Card>
    ),
  }
);

const TestPanel = dynamic(() => import("@/features/company-prep/components/TestPanel"), {
  loading: () => (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">Loading full test workspace...</CardContent>
    </Card>
  ),
});

interface CompanyPrepShellProps {
  userId: string;
  initialCompanyId?: string | null;
  initialRoleId?: string | null;
}

export function CompanyPrepShell(props: CompanyPrepShellProps) {
  const { userId, initialCompanyId = null, initialRoleId = null } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { syncCompanyContext, setCompanyPreference, trackCompanyInteraction } = useCompanyContext();
  const { setDifficultyPreference } = useAdaptiveEngine("company-prep");

  const [activeTab, setActiveTab] = useState("practice");

  const {
    companies,
    roles,
    selectedCompanyId,
    selectedRoleId,
    setSelectedCompanyId,
    setSelectedRoleId,
    companySearch,
    setCompanySearch,
    roleSearch,
    setRoleSearch,
    suggestions,
    loadingCompanies,
    loadingRoles,
    error: dataError,
  } = useCompanyData({
    userId,
    initialCompanyId,
    initialRoleId,
  });

  const {
    selectedDifficulty,
    selectedQuestionType,
    setSelectedDifficulty,
    setSelectedQuestionType,
    practiceData,
    mockData,
    testData,
    progress,
    loadingPractice,
    loadingMock,
    loadingTest,
    submittingTest,
    launchingMock,
    testResult,
    error: prepError,
    startMockInterview,
    submitTestAnswers,
    visiblePracticeQuestions,
  } = useCompanyPrep({
    userId,
    companyId: selectedCompanyId,
    roleId: selectedRoleId,
  });

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  useEffect(() => {
    if (!selectedCompanyId && !selectedRoleId) {
      return;
    }

    void syncCompanyContext({
      companyId: selectedCompanyId,
      roleId: selectedRoleId,
      companyType: selectedCompany?.name ?? null,
      targetRole: selectedRole?.name ?? null,
      targetCompanies: selectedCompany?.name ? [selectedCompany.name] : [],
    });
  }, [selectedCompany, selectedCompanyId, selectedRole, selectedRoleId, syncCompanyContext]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    const currentCompanyId = searchParams.get("companyId");
    const currentRoleId = searchParams.get("roleId");

    let changed = false;

    if (selectedCompanyId) {
      if (currentCompanyId !== selectedCompanyId) {
        nextParams.set("companyId", selectedCompanyId);
        changed = true;
      }
    } else if (currentCompanyId) {
      nextParams.delete("companyId");
      changed = true;
    }

    if (selectedRoleId) {
      if (currentRoleId !== selectedRoleId) {
        nextParams.set("roleId", selectedRoleId);
        changed = true;
      }
    } else if (currentRoleId) {
      nextParams.delete("roleId");
      changed = true;
    }

    if (!changed) {
      return;
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, selectedCompanyId, selectedRoleId]);

  useEffect(() => {
    void setCompanyPreference({
      companyType: selectedCompany?.name ?? null,
      targetCompanies: selectedCompany?.name ? [selectedCompany.name] : [],
      difficultyPreference: selectedDifficulty,
    });

    void setDifficultyPreference(selectedDifficulty);
  }, [selectedCompany?.name, selectedDifficulty, setCompanyPreference, setDifficultyPreference]);

  useEffect(() => {
    if (!testResult) {
      return;
    }

    void trackCompanyInteraction({
      topicName: testResult.weakAreas[0],
      score: testResult.score,
      retries: 0,
      confidence: testResult.score,
      difficultyPreference: selectedDifficulty,
    });
  }, [selectedDifficulty, testResult, trackCompanyInteraction]);

  const combinedError = prepError ?? dataError;

  const adaptive = useMemo(
    () => practiceData?.adaptive ?? mockData?.adaptive ?? testData?.adaptive ?? null,
    [mockData?.adaptive, practiceData?.adaptive, testData?.adaptive]
  );

  const handleStartMock = async () => {
    const interviewId = await startMockInterview();
    if (interviewId) {
      router.push(`/interview/${interviewId}`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border bg-card/60 p-6 shadow-sm"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.14),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(14,116,144,0.12),transparent_35%)]" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Company-Wise Preparation System
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Targeted interview preparation by company and role
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Adaptive practice, mock interview flows, full-test simulation, and progress insights are tuned to
              company-specific patterns and your weak areas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">High Performance</Badge>
            <Badge variant="outline">Adaptive Difficulty</Badge>
            <Badge variant="outline">Resume-Linked Suggestions</Badge>
          </div>
        </div>
      </motion.section>

      {combinedError ? (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="flex items-start gap-2 p-4 text-sm text-warning">
            <CircleAlert className="mt-0.5 h-4 w-4" />
            <p>{combinedError}</p>
          </CardContent>
        </Card>
      ) : null}

      {suggestions.reason ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-sm text-muted-foreground">{suggestions.reason}</CardContent>
        </Card>
      ) : null}

      <CompanySelectionGrid
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        suggestions={suggestions}
        loading={loadingCompanies}
        searchValue={companySearch}
        onSearchChange={setCompanySearch}
        onSelectCompany={setSelectedCompanyId}
      />

      <RoleSelector
        roles={roles}
        selectedRoleId={selectedRoleId}
        roleSearch={roleSearch}
        onRoleSearchChange={setRoleSearch}
        onSelectRole={setSelectedRoleId}
        loading={loadingRoles}
      />

      {selectedCompany && selectedRole ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl border bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected Track</p>
                  <p className="text-lg font-semibold">
                    {selectedCompany.name} • {selectedRole.name}
                  </p>
                </div>
              </div>

              {adaptive ? (
                <Badge variant="muted" className="capitalize">
                  Adaptive Difficulty: {adaptive.recommendedDifficulty}
                </Badge>
              ) : null}
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-muted/60 p-2">
              <TabsTrigger value="practice">Practice</TabsTrigger>
              <TabsTrigger value="mock">Mock Interview</TabsTrigger>
              <TabsTrigger value="test">Full Test</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
            </TabsList>

            <TabsContent value="practice">
              <PracticePanel
                questions={visiblePracticeQuestions}
                adaptive={practiceData?.adaptive ?? adaptive}
                loading={loadingPractice}
                selectedDifficulty={selectedDifficulty}
                selectedQuestionType={selectedQuestionType}
                onDifficultyChange={setSelectedDifficulty}
                onQuestionTypeChange={setSelectedQuestionType}
              />
            </TabsContent>

            <TabsContent value="mock">
              <MockInterviewPanel
                data={mockData}
                loading={loadingMock}
                launching={launchingMock}
                onStartVoiceMock={handleStartMock}
              />
            </TabsContent>

            <TabsContent value="test">
              <TestPanel
                data={testData}
                loading={loadingTest}
                submitting={submittingTest}
                result={testResult}
                onSubmit={submitTestAnswers}
              />
            </TabsContent>

            <TabsContent value="progress">
              <ProgressPanel progress={progress} adaptive={adaptive} />
            </TabsContent>
          </Tabs>
        </motion.section>
      ) : null}
    </div>
  );
}
