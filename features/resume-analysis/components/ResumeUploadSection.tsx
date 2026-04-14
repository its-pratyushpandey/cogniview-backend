"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FileUp, RefreshCw, UploadCloud } from "lucide-react";

import styles from "@/features/resume-analysis/components/resume-analysis.module.css";

interface ResumeUploadSectionProps {
  resumeText: string;
  selectedRole: string;
  analyzing: boolean;
  progress: number;
  errorMessage?: string | null;
  onResumeTextChange: (value: string) => void;
  onSelectedRoleChange: (value: string) => void;
  onAnalyze: (options?: { forceRefresh?: boolean }) => void;
}

const ROLE_OPTIONS = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Analyst",
];

export function ResumeUploadSection(props: ResumeUploadSectionProps) {
  const {
    resumeText,
    selectedRole,
    analyzing,
    progress,
    errorMessage,
    onResumeTextChange,
    onSelectedRoleChange,
    onAnalyze,
  } = props;

  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const mergedError = fileError ?? errorMessage;
  const canAnalyze = useMemo(() => resumeText.trim().length >= 40 && !analyzing, [analyzing, resumeText]);

  const loadFile = useCallback(
    (file: File) => {
      const acceptedTypes = ["text/plain", "text/markdown"];
      const acceptedByExtension = /\.(txt|md|text)$/i.test(file.name);

      if (!acceptedTypes.includes(file.type) && !acceptedByExtension) {
        setFileError("Upload a .txt or .md resume, or paste the resume manually.");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const loadedText = typeof reader.result === "string" ? reader.result : "";
        onResumeTextChange(loadedText);
        setFileError(null);
      };
      reader.onerror = () => {
        setFileError("Could not read the file. Try pasting resume text instead.");
      };
      reader.readAsText(file);
    },
    [onResumeTextChange]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);

      const droppedFile = event.dataTransfer.files[0];
      if (!droppedFile) {
        return;
      }

      loadFile(droppedFile);
    },
    [loadFile]
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className={`${styles.glassCard} ${styles.uploadCard}`}
    >
      <div
        className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <div className={styles.uploadHeader}>
          <div>
            <h2 className={styles.panelTitle}>Step 1: Upload Resume</h2>
            <p className={styles.uploadHint}>
              Drag and drop a text resume or paste full content. Richer content improves weakness detection quality.
            </p>
          </div>

          <label className={styles.ghostButton}>
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              hidden
              onChange={(event) => {
                const uploaded = event.target.files?.[0];
                if (uploaded) {
                  loadFile(uploaded);
                }
              }}
            />
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <UploadCloud size={15} />
              Upload
            </span>
          </label>
        </div>

        <textarea
          className={styles.textarea}
          value={resumeText}
          onChange={(event) => {
            onResumeTextChange(event.target.value);
            setFileError(null);
          }}
          placeholder="Paste your resume here. Include skills, projects, internships, education, and achievements."
        />

        <div className={styles.row}>
          <select
            className={styles.select}
            value={selectedRole}
            onChange={(event) => onSelectedRoleChange(event.target.value)}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          <button className={styles.button} type="button" disabled={!canAnalyze} onClick={() => onAnalyze()}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <FileUp size={15} />
              Analyze Resume
            </span>
          </button>

          <button
            className={styles.ghostButton}
            type="button"
            disabled={!resumeText.trim() || analyzing}
            onClick={() => onAnalyze({ forceRefresh: true })}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <RefreshCw size={15} />
              Re-run
            </span>
          </button>
        </div>

        {analyzing ? (
          <div style={{ marginTop: "0.65rem" }}>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
            <p className={styles.meta} style={{ marginTop: "0.35rem" }}>
              Processing resume intelligence pipeline: {Math.min(progress, 100)}%
            </p>
          </div>
        ) : null}

        {mergedError ? <div className={styles.alert}>{mergedError}</div> : null}
      </div>
    </motion.section>
  );
}
