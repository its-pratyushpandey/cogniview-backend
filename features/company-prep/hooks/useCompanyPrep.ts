"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useDebouncedValue } from "@/features/company-prep/hooks/useDebouncedValue";
import {
  CompanyQuestion,
  CompanyQuestionsResponse,
  CompanyMockResponse,
  CompanyPrepProgressNode,
  CompanyTestResponse,
  Difficulty,
  QuestionType,
  TestSubmissionResult,
} from "@/features/company-prep/types";

interface UseCompanyPrepInput {
  userId: string;
  companyId: string | null;
  roleId: string | null;
}

interface UseCompanyPrepResult {
  selectedDifficulty: Difficulty | "adaptive";
  selectedQuestionType: QuestionType | "all";
  setSelectedDifficulty: (value: Difficulty | "adaptive") => void;
  setSelectedQuestionType: (value: QuestionType | "all") => void;
  practiceData: CompanyQuestionsResponse | null;
  mockData: CompanyMockResponse | null;
  testData: CompanyTestResponse | null;
  progress: CompanyPrepProgressNode | null;
  loadingPractice: boolean;
  loadingMock: boolean;
  loadingTest: boolean;
  submittingTest: boolean;
  launchingMock: boolean;
  testResult: TestSubmissionResult | null;
  error: string | null;
  refreshPractice: () => Promise<void>;
  refreshMock: () => Promise<void>;
  refreshTest: () => Promise<void>;
  startMockInterview: () => Promise<string | null>;
  submitTestAnswers: (answers: Record<string, string | number>) => Promise<TestSubmissionResult | null>;
  visiblePracticeQuestions: CompanyQuestion[];
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function useCompanyPrep(input: UseCompanyPrepInput): UseCompanyPrepResult {
  const { userId, companyId, roleId } = input;

  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | "adaptive">("adaptive");
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionType | "all">("all");

  const [practiceData, setPracticeData] = useState<CompanyQuestionsResponse | null>(null);
  const [mockData, setMockData] = useState<CompanyMockResponse | null>(null);
  const [testData, setTestData] = useState<CompanyTestResponse | null>(null);
  const [testResult, setTestResult] = useState<TestSubmissionResult | null>(null);

  const [loadingPractice, setLoadingPractice] = useState(false);
  const [loadingMock, setLoadingMock] = useState(false);
  const [loadingTest, setLoadingTest] = useState(false);
  const [submittingTest, setSubmittingTest] = useState(false);
  const [launchingMock, setLaunchingMock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedDifficulty = useDebouncedValue(selectedDifficulty, 250);
  const debouncedQuestionType = useDebouncedValue(selectedQuestionType, 250);

  const refreshPractice = useCallback(async () => {
    if (!companyId || !roleId) {
      setPracticeData(null);
      return;
    }

    setLoadingPractice(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        companyId,
        roleId,
        userId,
        limit: "14",
      });

      if (debouncedDifficulty !== "adaptive") {
        params.set("difficulty", debouncedDifficulty);
      }

      if (debouncedQuestionType !== "all") {
        params.set("type", debouncedQuestionType);
      }

      const response = await fetch(`/api/company/questions?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch questions: ${response.status}`);
      }

      const payload = await parseJson<CompanyQuestionsResponse>(response);
      setPracticeData(payload);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch questions");
    } finally {
      setLoadingPractice(false);
    }
  }, [companyId, roleId, userId, debouncedDifficulty, debouncedQuestionType]);

  const refreshMock = useCallback(async () => {
    if (!companyId || !roleId) {
      setMockData(null);
      return;
    }

    setLoadingMock(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        companyId,
        roleId,
        userId,
      });

      const response = await fetch(`/api/company/mock?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch mock interview: ${response.status}`);
      }

      const payload = await parseJson<CompanyMockResponse>(response);
      setMockData(payload);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch mock interview");
    } finally {
      setLoadingMock(false);
    }
  }, [companyId, roleId, userId]);

  const refreshTest = useCallback(async () => {
    if (!companyId || !roleId) {
      setTestData(null);
      return;
    }

    setLoadingTest(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        companyId,
        roleId,
        userId,
      });

      const response = await fetch(`/api/company/test?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch test data: ${response.status}`);
      }

      const payload = await parseJson<CompanyTestResponse>(response);
      setTestData(payload);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch test");
    } finally {
      setLoadingTest(false);
    }
  }, [companyId, roleId, userId]);

  const startMockInterview = useCallback(async (): Promise<string | null> => {
    if (!companyId || !roleId) {
      return null;
    }

    setLaunchingMock(true);
    setError(null);

    try {
      const response = await fetch("/api/company/mock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          roleId,
          userId,
          createInterview: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to launch mock interview: ${response.status}`);
      }

      const payload = await parseJson<{ success: boolean; interviewId?: string }>(response);
      return payload.interviewId ?? null;
    } catch (launchError) {
      setError(launchError instanceof Error ? launchError.message : "Failed to launch mock interview");
      return null;
    } finally {
      setLaunchingMock(false);
    }
  }, [companyId, roleId, userId]);

  const submitTestAnswers = useCallback(
    async (answers: Record<string, string | number>): Promise<TestSubmissionResult | null> => {
      if (!companyId || !roleId) {
        return null;
      }

      setSubmittingTest(true);
      setError(null);

      try {
        const response = await fetch("/api/company/test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            companyId,
            roleId,
            answers,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to submit test: ${response.status}`);
        }

        const payload = await parseJson<{ success: boolean; result: TestSubmissionResult }>(response);
        setTestResult(payload.result);

        await Promise.all([refreshPractice(), refreshMock(), refreshTest()]);

        return payload.result;
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Failed to submit test");
        return null;
      } finally {
        setSubmittingTest(false);
      }
    },
    [companyId, roleId, userId, refreshMock, refreshPractice, refreshTest]
  );

  useEffect(() => {
    void refreshPractice();
  }, [refreshPractice]);

  useEffect(() => {
    if (!companyId || !roleId) {
      setMockData(null);
      setTestData(null);
      return;
    }

    void Promise.all([refreshMock(), refreshTest()]);
  }, [companyId, roleId, refreshMock, refreshTest]);

  const progress = useMemo(() => {
    return testData?.progress ?? mockData?.progress ?? practiceData?.progress ?? null;
  }, [mockData?.progress, practiceData?.progress, testData?.progress]);

  const visiblePracticeQuestions = useMemo(() => {
    return practiceData?.questions ?? [];
  }, [practiceData?.questions]);

  return {
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
    error,
    refreshPractice,
    refreshMock,
    refreshTest,
    startMockInterview,
    submitTestAnswers,
    visiblePracticeQuestions,
  };
}
