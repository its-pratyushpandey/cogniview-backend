"use client";

import { ResumeAnalysisShell } from "@/features/resume-analysis/components/ResumeAnalysisShell";

interface ResumeToInterviewMappingProps {
  userId: string;
}

export default function ResumeToInterviewMapping({ userId }: ResumeToInterviewMappingProps) {
  return <ResumeAnalysisShell userId={userId} />;
}
