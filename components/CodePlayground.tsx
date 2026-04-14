"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { 
  Play, Save, Brain, Code2, Terminal, 
  CheckCircle, FileCode, Loader2, MonitorPlay, X, Lightbulb, ListChecks
} from "lucide-react";
import CodeEditor from "./CodeEditor";
import CodeOutput from "./CodeOutput";
import CodeEvaluationPanel from "./CodeEvaluationPanel";
import CodeProblemSelector from "./CodeProblemSelector";
import { CODE_TEMPLATES } from "@/constants/dsa-problems";
import { useAdaptiveEngine } from "@/features/intelligence/hooks/useAdaptiveEngine";
import { useStreamingCoach } from "@/features/intelligence/hooks/useStreamingCoach";

// Dynamic import to prevent SSR issues with RecordRTC
const CodeSessionRecorder = dynamic(() => import("./CodeSessionRecorder"), {
  ssr: false,
  loading: () => null
});

type RecorderUploadState = "idle" | "recording" | "processing" | "uploading" | "uploaded" | "error";

interface RecorderUploadStatus {
  state: RecorderUploadState;
  progress: number;
  error?: string;
}

export default function CodePlayground({ 
  userId, 
  interviewId, 
  initialProblem,
  mode = "practice" 
}: CodePlaygroundProps) {
  
  // State Management
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<"python" | "java" | "cpp" | "javascript">("python");
  const [output, setOutput] = useState("");
  const [executionTime, setExecutionTime] = useState<number>(0);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<CodeEvaluation | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<DSAProblem | null>(initialProblem || null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [activeTab, setActiveTab] = useState<"output" | "tests" | "evaluation">("output");
  const [isSaving, setIsSaving] = useState(false);
  const [latestMicroSummary, setLatestMicroSummary] = useState("");
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingUploadState, setRecordingUploadState] = useState<RecorderUploadState>("idle");
  const [recordingUploadProgress, setRecordingUploadProgress] = useState(0);
  const [recordingUploadError, setRecordingUploadError] = useState<string | null>(null);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [isSyncingRecordingReference, setIsSyncingRecordingReference] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const codingSessionStartedAtRef = useRef<number>(Date.now());
  const linkedRecordingRef = useRef<string>("");

  const { trackLearning, markTopicProgress, setDifficultyPreference } = useAdaptiveEngine("coding-playground");
  const liveCoach = useStreamingCoach();

  const testsPassed = useMemo(() => testResults.filter((result) => result.passed).length, [testResults]);
  const testPassRate = useMemo(
    () => (testResults.length > 0 ? Math.round((testsPassed / testResults.length) * 100) : 0),
    [testResults.length, testsPassed]
  );
  const avgTestExecutionMs = useMemo(
    () =>
      testResults.length > 0
        ? Math.round(testResults.reduce((sum, result) => sum + result.executionTime, 0) / testResults.length)
        : 0,
    [testResults]
  );
  const codeQualityScore = useMemo(() => {
    if (!evaluation) return 0;
    const average =
      (evaluation.codeQuality.readability + evaluation.codeQuality.efficiency + evaluation.codeQuality.correctness) / 3;
    return Math.round(average * 10);
  }, [evaluation]);
  const liveScore = useMemo(() => {
    const parts: number[] = [];
    if (testResults.length > 0) parts.push(testPassRate);
    if (evaluation) parts.push(evaluation.score);
    if (parts.length === 0) return 0;
    return Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length);
  }, [evaluation, testPassRate, testResults.length]);
  const recordingButtonLabel = useMemo(() => {
    if (recordingUploadState === "uploading") {
      return `Uploading ${recordingUploadProgress}%`;
    }

    if (isSyncingRecordingReference) {
      return "Linking Recording...";
    }

    return "View Recording";
  }, [isSyncingRecordingReference, recordingUploadProgress, recordingUploadState]);

  // Load template when problem or language changes
  useEffect(() => {
    if (selectedProblem) {
      const template = CODE_TEMPLATES[language][selectedProblem.id] || CODE_TEMPLATES[language].default;
      setCode(template);
    } else {
      setCode(CODE_TEMPLATES[language].default);
    }
    codingSessionStartedAtRef.current = Date.now();
    setEvaluation(null);
    setTestResults([]);
    setOutput("");
  }, [selectedProblem, language]);

  const handleRecorderStatusChange = useCallback((status: RecorderUploadStatus) => {
    setRecordingUploadState(status.state);
    setRecordingUploadProgress(status.progress);
    setRecordingUploadError(status.error || null);
  }, []);

  const handleRecordingUploadComplete = useCallback((url: string) => {
    setRecordingUrl(url);
    setRecordingUploadError(null);

    if (!savedSessionId) {
      setLatestMicroSummary("Recording uploaded. Save session to persist playback link.");
    }
  }, [savedSessionId]);

  useEffect(() => {
    if (!savedSessionId || !recordingUrl) return;

    const syncKey = `${savedSessionId}:${recordingUrl}`;
    if (linkedRecordingRef.current === syncKey) return;

    let isCancelled = false;

    const syncRecordingReference = async () => {
      setIsSyncingRecordingReference(true);

      try {
        const response = await fetch("/api/code/sessions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: savedSessionId,
            recordingUrl,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error || "Failed to attach recording to the saved session");
        }

        if (isCancelled) return;

        linkedRecordingRef.current = syncKey;
        setRecordingUploadError(null);
        setLatestMicroSummary("Recording linked to session. Playback is ready.");
      } catch (error) {
        if (isCancelled) return;

        setRecordingUploadError(
          error instanceof Error
            ? error.message
            : "Recording uploaded, but linking it to session failed. Save once more to retry."
        );
      } finally {
        if (!isCancelled) {
          setIsSyncingRecordingReference(false);
        }
      }
    };

    void syncRecordingReference();

    return () => {
      isCancelled = true;
    };
  }, [recordingUrl, savedSessionId]);

  useEffect(() => {
    if (!showRecordingModal) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowRecordingModal(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showRecordingModal]);

  // Execute Code
  const handleExecute = async () => {
    if (!code.trim()) {
      setOutput("❌ Please write some code first!");
      return;
    }

    setIsExecuting(true);
    setOutput("⏳ Executing code...");
    setTestResults([]);
    setActiveTab("output");

    // Animate output panel
    if (outputRef.current) {
      gsap.from(outputRef.current, {
        scale: 0.95,
        opacity: 0.5,
        duration: 0.3
      });
    }

    try {
      const response = await fetch("/api/code/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          userId,
          problemId: selectedProblem?.id
        })
      });

      const data: ExecutionResponse = await response.json();

      if (data.success) {
        setOutput(data.output);
        setExecutionTime(data.executionTime);

        void trackLearning({
          topicName: selectedProblem?.title || "Coding Practice",
          score: 74,
          responseTimeMs: Math.max(0, data.executionTime),
          retries: 0,
          confidence: 74,
          difficultyPreference: "medium",
        });
        
        // Run test cases if problem is selected
        if (selectedProblem) {
          await runTestCases();
        } else {
          setLatestMicroSummary(`Execution successful in ${data.executionTime}ms. Run AI Evaluate for deeper scoring.`);
          void liveCoach.streamFeedback({
            userId,
            module: "coding",
            event: "code_executed",
            metrics: {
              topic: "Coding Practice",
              score: 70,
              accuracy: 70,
              responseTimeMs: Math.max(0, data.executionTime),
              retries: 0,
              difficulty: "Medium",
            },
          });
        }
      } else {
        setOutput(`❌ Error:\n${data.error || "Execution failed"}`);
        setExecutionTime(data.executionTime);
        setLatestMicroSummary("Execution failed. Focus on compiler/runtime issues before optimization.");

        void trackLearning({
          topicName: selectedProblem?.title || "Coding Practice",
          score: 34,
          responseTimeMs: Math.max(0, data.executionTime),
          retries: 1,
          confidence: 34,
          difficultyPreference: "easy",
        });

        void liveCoach.streamFeedback({
          userId,
          module: "coding",
          event: "code_executed",
          metrics: {
            topic: selectedProblem?.title || "Coding Practice",
            score: 32,
            accuracy: 32,
            responseTimeMs: Math.max(0, data.executionTime),
            retries: 1,
            difficulty: selectedProblem?.difficulty || "Medium",
          },
        });
      }
    } catch (error) {
      setOutput(`❌ Execution failed: ${error instanceof Error ? error.message : String(error)}`);
      setLatestMicroSummary("Execution request failed. Check network and retry.");
    } finally {
      setIsExecuting(false);
    }
  };

  // Run Test Cases
  const runTestCases = async () => {
    if (!selectedProblem) return;

    setActiveTab("tests");
    const results: TestResult[] = [];
    
    for (const testCase of selectedProblem.testCases) {
      try {
        const response = await fetch("/api/code/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            language,
            input: testCase.input,
            userId
          })
        });

        const data: ExecutionResponse = await response.json();
        
        results.push({
          testCaseId: testCase.id,
          passed: data.success && data.output.trim() === testCase.expectedOutput.trim(),
          actualOutput: data.output.trim(),
          expectedOutput: testCase.expectedOutput.trim(),
          executionTime: data.executionTime,
          memoryUsed: data.memoryUsed,
          error: data.error
        });
      } catch (error) {
        results.push({
          testCaseId: testCase.id,
          passed: false,
          actualOutput: "",
          expectedOutput: testCase.expectedOutput,
          executionTime: 0,
          memoryUsed: 0,
          error: error instanceof Error ? error.message : "Test execution failed"
        });
      }
    }

    setTestResults(results);

    if (results.length > 0) {
      const passed = results.filter((result) => result.passed).length;
      const score = Math.round((passed / results.length) * 100);
      const averageExecutionMs = Math.round(
        results.reduce((sum, result) => sum + result.executionTime, 0) / Math.max(1, results.length)
      );

      setLatestMicroSummary(
        `Tests ${passed}/${results.length} passed • Pass rate ${score}% • Avg execution ${averageExecutionMs}ms`
      );

      void markTopicProgress({
        subject: "Coding",
        topicName: selectedProblem?.title || "Coding Practice",
        score,
        responseTimeMs: Math.max(0, Date.now() - codingSessionStartedAtRef.current),
        retries: Math.max(0, results.length - passed),
      });

      void setDifficultyPreference(score <= 45 ? "easy" : score <= 72 ? "medium" : "hard");

      void liveCoach.streamFeedback({
        userId,
        module: "coding",
        event: "code_executed",
        metrics: {
          topic: selectedProblem?.title || "Coding Practice",
          score,
          accuracy: score,
          passRate: score,
          responseTimeMs: averageExecutionMs,
          retries: Math.max(0, results.length - passed),
          difficulty: selectedProblem?.difficulty || "Medium",
        },
        history: selectedProblem?.hints?.slice(0, 4),
      });
    }
  };

  // AI Evaluation
  const handleEvaluate = async () => {
    if (!code.trim()) {
      alert("Please write some code before evaluating!");
      return;
    }

    setIsEvaluating(true);
    setActiveTab("evaluation");

    try {
      const response = await fetch("/api/code/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          problemId: selectedProblem?.title || "General Code Review",
          testResults,
          userId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setEvaluation(data.evaluation);

        const evaluationScore = Number(data.evaluation?.score ?? 0);
        const responseTimeMs = Math.max(0, Date.now() - codingSessionStartedAtRef.current);
        const qualityAverage =
          Number(data.evaluation?.codeQuality?.readability ?? 0) +
          Number(data.evaluation?.codeQuality?.efficiency ?? 0) +
          Number(data.evaluation?.codeQuality?.correctness ?? 0);
        const qualityScore = Math.round((qualityAverage / 3) * 10);

        setLatestMicroSummary(
          `AI score ${evaluationScore}/100 • Quality ${qualityScore}/100 • Next step: apply top suggestion and re-run.`
        );

        void markTopicProgress({
          subject: "Coding",
          topicName: selectedProblem?.title || "General Code Review",
          score: evaluationScore,
          responseTimeMs,
          retries: 0,
        });

        void trackLearning({
          topicName: selectedProblem?.title || "General Code Review",
          score: evaluationScore,
          responseTimeMs,
          retries: 0,
          confidence: evaluationScore,
          difficultyPreference: evaluationScore <= 45 ? "easy" : evaluationScore <= 72 ? "medium" : "hard",
        });

        void setDifficultyPreference(
          evaluationScore <= 45 ? "easy" : evaluationScore <= 72 ? "medium" : "hard"
        );

        void liveCoach.streamFeedback({
          userId,
          module: "coding",
          event: "code_evaluated",
          metrics: {
            topic: selectedProblem?.title || "General Code Review",
            score: evaluationScore,
            accuracy: testResults.length > 0 ? Math.round((testResults.filter((result) => result.passed).length / testResults.length) * 100) : evaluationScore,
            passRate: testResults.length > 0 ? Math.round((testResults.filter((result) => result.passed).length / testResults.length) * 100) : undefined,
            responseTimeMs,
            retries: 0,
            difficulty: selectedProblem?.difficulty || "Medium",
            codeQuality: data.evaluation?.codeQuality,
          },
          history: data.evaluation?.improvements?.slice(0, 3),
        });
        
        // Animate evaluation appearance
        gsap.from(".evaluation-panel", {
          scale: 0.9,
          opacity: 0,
          duration: 0.5,
          ease: "back.out(1.7)"
        });
      } else {
        alert(data.error || "Evaluation failed. Please try again.");
      }
    } catch (error) {
      console.error("Evaluation failed:", error);
      alert("Failed to evaluate code. Please try again.");
    } finally {
      setIsEvaluating(false);
    }
  };

  // Save Session
  const handleSave = async () => {
    if (!code.trim()) return;

    setIsSaving(true);
    
    try {
      const response = await fetch("/api/code/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          interviewId,
          problemId: selectedProblem?.id,
          code,
          language,
          output,
          evaluation,
          testResults,
          recordingUrl: recordingUrl || undefined,
        })
      });

      const saveData = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(saveData?.error || "Failed to save session");
      }

      if (saveData?.sessionId) {
        setSavedSessionId(saveData.sessionId as string);

        if (recordingUrl) {
          linkedRecordingRef.current = `${saveData.sessionId as string}:${recordingUrl}`;
        }
      }

      const saveSuccessMessage = recordingUrl
        ? "Session and recording saved successfully!"
        : recordingUploadState === "uploading" || recordingUploadState === "processing"
          ? "Session saved. Recording is still uploading and will be linked automatically."
          : "Session saved successfully!";

      setLatestMicroSummary(
        recordingUrl
          ? "Session saved with recording playback attached."
          : recordingUploadState === "uploading" || recordingUploadState === "processing"
            ? "Session saved while recording uploads in background."
            : "Session saved."
      );

      void liveCoach.streamFeedback({
        userId,
        module: "coding",
        event: "session_summary",
        metrics: {
          topic: selectedProblem?.title || "Coding Practice",
          score: liveScore,
          accuracy: testPassRate,
          passRate: testPassRate,
          responseTimeMs: avgTestExecutionMs || executionTime,
          retries: Math.max(0, testResults.length - testsPassed),
          difficulty: selectedProblem?.difficulty || "Medium",
          codeQuality: evaluation?.codeQuality,
        },
        history: evaluation?.suggestions?.slice(0, 3),
      });
      
      // Show success animation
      gsap.to(".save-btn", {
        scale: 1.1,
        duration: 0.2,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          alert(saveSuccessMessage);
        }
      });
    } catch (error) {
      console.error("Save failed:", error);
      alert(error instanceof Error ? error.message : "Failed to save session");
    } finally {
      setIsSaving(false);
    }
  };

  const getLanguageIcon = () => {
    const icons: Record<string, string> = {
      python: "🐍",
      java: "☕",
      cpp: "⚡",
      javascript: "🟨"
    };
    return icons[language];
  };

  return (
    <div ref={containerRef} className="code-playground-container">
      
      {/* Header */}
      <motion.div 
        className="playground-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="header-left">
          <Code2 className="header-icon" size={32} />
          <div>
            <h1 className="gradient-text">Code Execution Playground</h1>
            <p className="header-subtitle">
              {mode === "interview" ? "🎤 Interview Mode" : "💻 Practice Mode"}
            </p>
          </div>
        </div>

        <div className="header-actions">
          <CodeSessionRecorder 
            isRecording={isRecording}
            onToggle={() => {
              const nextRecordingState = !isRecording;

              if (nextRecordingState) {
                setRecordingUrl(null);
                setRecordingUploadError(null);
                setRecordingUploadProgress(0);
                setRecordingUploadState("idle");
                linkedRecordingRef.current = "";
              }

              setIsRecording(nextRecordingState);
            }}
            userId={userId}
            sessionContextId={interviewId || selectedProblem?.id || mode}
            onUploadComplete={handleRecordingUploadComplete}
            onUploadStatusChange={handleRecorderStatusChange}
          />
          
          <motion.select
            className="language-selector"
            value={language}
            onChange={(e) => setLanguage(e.target.value as "python" | "java" | "cpp" | "javascript")}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <option value="python">{getLanguageIcon()} Python</option>
            <option value="java">{getLanguageIcon()} Java</option>
            <option value="cpp">⚡ C++</option>
            <option value="javascript">🟨 JavaScript</option>
          </motion.select>
        </div>
      </motion.div>

      {/* Main Layout */}
      <div className="playground-layout">
        
        {/* Left: Problem List + Statement */}
        <motion.div 
          className="problem-panel"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="problem-panel-split">
            <div className="problem-list-pane">
              <CodeProblemSelector 
                selectedProblem={selectedProblem}
                onSelect={setSelectedProblem}
                mode={mode}
              />
            </div>

            <div className="problem-description-pane">
              <div className="problem-description-header">
                <p>Problem Description</p>
                {selectedProblem ? (
                  <span className={`statement-difficulty ${selectedProblem.difficulty.toLowerCase()}`}>
                    {selectedProblem.difficulty}
                  </span>
                ) : null}
              </div>

              <div className="problem-description-content">
                {selectedProblem ? (
                  <>
                    <h2 className="statement-title">{selectedProblem.title}</h2>
                    <p className="statement-text">{selectedProblem.description}</p>

                    <section className="statement-section">
                      <h3>
                        <ListChecks size={15} /> Examples
                      </h3>
                      <div className="example-list">
                        {selectedProblem.examples.map((example, index) => (
                          <div key={`example-${index}`} className="example-card">
                            <p className="example-heading">Example {index + 1}</p>
                            <p><strong>Input:</strong> {example.input}</p>
                            <p><strong>Output:</strong> {example.output}</p>
                            <p className="example-explanation"><strong>Explanation:</strong> {example.explanation}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="statement-section">
                      <h3>Constraints</h3>
                      <ul className="constraint-list">
                        {selectedProblem.constraints.map((constraint, index) => (
                          <li key={`constraint-${index}`}>{constraint}</li>
                        ))}
                      </ul>
                    </section>

                    {selectedProblem.hints?.length ? (
                      <section className="statement-section">
                        <h3>
                          <Lightbulb size={15} /> Hints
                        </h3>
                        <ul className="hint-list">
                          {selectedProblem.hints.slice(0, 3).map((hint, index) => (
                            <li key={`hint-${index}`}>{hint}</li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </>
                ) : (
                  <div className="statement-empty-state">
                    <Code2 size={28} />
                    <p>Select a problem to view full statement, examples, and constraints.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Center: Code Editor */}
        <motion.div 
          className="editor-panel"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="editor-toolbar">
            <div className="toolbar-left">
              <FileCode size={18} />
              <span>
                main.{language === "cpp" ? "cpp" : language === "java" ? "java" : language === "javascript" ? "js" : "py"}
              </span>
            </div>
            
            <div className="toolbar-right">
              <motion.button
                className="btn-save save-btn"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Save
              </motion.button>

              <motion.button
                className="btn-recording"
                whileHover={{ scale: !recordingUrl ? 1 : 1.05 }}
                whileTap={{ scale: !recordingUrl ? 1 : 0.95 }}
                onClick={() => setShowRecordingModal(true)}
                disabled={!recordingUrl}
              >
                <MonitorPlay size={18} />
                {recordingButtonLabel}
              </motion.button>

              <motion.button
                className="btn-run"
                disabled={isExecuting}
                onClick={handleExecute}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isExecuting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    Run Code
                  </>
                )}
              </motion.button>

              <motion.button
                className="btn-evaluate"
                disabled={isEvaluating || !code}
                onClick={handleEvaluate}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isEvaluating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain size={18} />
                    AI Evaluate
                  </>
                )}
              </motion.button>
            </div>
          </div>

          <CodeEditor 
            code={code}
            language={language}
            onChange={setCode}
            height="calc(100vh - 280px)"
          />
        </motion.div>

        {/* Right: Output & Evaluation */}
        <motion.div 
          className="output-panel"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="mx-4 mt-4 rounded-2xl border border-primary/30 bg-card/80 p-3 text-foreground shadow-lg shadow-black/20">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live Coding Score</p>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-border/70 bg-secondary/60 px-2 py-1.5">
                <p className="text-xs text-muted-foreground">Blended Score</p>
                <p className="tabular-nums font-semibold">{liveScore > 0 ? `${liveScore}/100` : "--"}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-secondary/60 px-2 py-1.5">
                <p className="text-xs text-muted-foreground">Pass Rate</p>
                <p className="tabular-nums font-semibold">{testResults.length > 0 ? `${testPassRate}%` : "--"}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-secondary/60 px-2 py-1.5">
                <p className="text-xs text-muted-foreground">Quality Score</p>
                <p className="tabular-nums font-semibold">{evaluation ? `${codeQualityScore}/100` : "--"}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-secondary/60 px-2 py-1.5">
                <p className="text-xs text-muted-foreground">Avg Test Time</p>
                <p className="tabular-nums font-semibold">{avgTestExecutionMs > 0 ? `${avgTestExecutionMs}ms` : "--"}</p>
              </div>
            </div>

            {latestMicroSummary ? (
              <p className="mt-2 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs text-accent">
                {latestMicroSummary}
              </p>
            ) : null}

            {liveCoach.bullets.length > 0 ? (
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                {liveCoach.bullets.map((bullet, index) => (
                  <li key={`${index}-${bullet}`} className="rounded-lg border border-border/70 bg-secondary/55 px-2 py-1.5">
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}

            {liveCoach.isStreaming ? <p className="mt-2 text-xs text-primary/80">Streaming coaching cues...</p> : null}
            {liveCoach.error ? (
              <p className="mt-2 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs text-danger">
                {liveCoach.error}
              </p>
            ) : null}

            <div className="mt-2 rounded-lg border border-border/70 bg-secondary/55 px-2.5 py-2 text-xs">
              <p className="font-semibold text-foreground">Recording</p>
              <p className="mt-1 text-muted-foreground">
                {recordingUrl
                  ? "Uploaded and ready for playback."
                  : recordingUploadState === "uploading"
                    ? `Uploading ${recordingUploadProgress}% in the background.`
                    : recordingUploadState === "processing"
                      ? "Finalizing recording file..."
                      : recordingUploadState === "recording"
                        ? "Recording in progress."
                        : "Start recording to capture this coding session."}
              </p>

              {isSyncingRecordingReference ? (
                <p className="mt-1 text-primary/85">Linking recording URL to saved session...</p>
              ) : null}

              {recordingUploadError ? (
                <p className="mt-1 text-danger">{recordingUploadError}</p>
              ) : null}
            </div>
          </div>

          <div className="panel-tabs">
            <button 
              className={`tab ${activeTab === "output" ? "active" : ""}`}
              onClick={() => setActiveTab("output")}
            >
              <Terminal size={16} />
              Output
            </button>
            <button 
              className={`tab ${activeTab === "tests" ? "active" : ""}`}
              onClick={() => setActiveTab("tests")}
            >
              <CheckCircle size={16} />
              Tests ({testResults.length})
            </button>
            <button 
              className={`tab ${activeTab === "evaluation" ? "active" : ""}`}
              onClick={() => setActiveTab("evaluation")}
            >
              <Brain size={16} />
              Analysis
            </button>
          </div>

          <div ref={outputRef} className="panel-content">
            {activeTab === "output" && (
              <CodeOutput output={output} isExecuting={isExecuting} executionTime={executionTime} />
            )}

            {activeTab === "tests" && (
              <div className="test-results">
                {testResults.length === 0 ? (
                  <div className="empty-state">
                    <CheckCircle size={48} />
                    <p>No test results yet</p>
                    <p className="empty-hint">Run your code to see test case results</p>
                  </div>
                ) : (
                  testResults.map((result, idx) => (
                    <motion.div
                      key={result.testCaseId}
                      className={`test-case ${result.passed ? "passed" : "failed"}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <div className="test-header">
                        <span className="test-title">Test Case {idx + 1}</span>
                        <span className={`test-status ${result.passed ? "pass" : "fail"}`}>
                          {result.passed ? "✓ PASSED" : "✗ FAILED"}
                        </span>
                      </div>
                      {result.error && (
                        <div className="test-error">Error: {result.error}</div>
                      )}
                      {!result.passed && (
                        <>
                          <div className="test-detail">
                            <strong>Expected:</strong> {result.expectedOutput}
                          </div>
                          <div className="test-detail">
                            <strong>Got:</strong> {result.actualOutput}
                          </div>
                        </>
                      )}
                      <div className="test-meta">
                        ⚡ {result.executionTime}ms
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}

            {activeTab === "evaluation" && (
              evaluation ? (
                <CodeEvaluationPanel evaluation={evaluation} />
              ) : (
                <div className="empty-state">
                  <Brain size={48} />
                  <p>No evaluation yet</p>
                  <p className="empty-hint">Click &quot;AI Evaluate&quot; to analyze your code</p>
                </div>
              )
            )}
          </div>
        </motion.div>
      </div>

      {showRecordingModal ? (
        <div
          className="recording-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Session recording playback"
          onClick={() => setShowRecordingModal(false)}
        >
          <motion.div
            className="recording-modal"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="recording-modal-header">
              <div>
                <h3>Session Recording</h3>
                <p>Review your coding walkthrough with full playback controls.</p>
              </div>
              <button
                type="button"
                className="recording-close-btn"
                onClick={() => setShowRecordingModal(false)}
                aria-label="Close recording modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="recording-modal-content">
              {recordingUrl ? (
                <video
                  className="recording-player"
                  controls
                  playsInline
                  preload="metadata"
                  src={recordingUrl}
                >
                  Your browser does not support video playback.
                </video>
              ) : (
                <div className="recording-empty-state">
                  <p>Recording is not ready yet. Wait for upload to complete and try again.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      ) : null}

      <style jsx>{`
        .code-playground-container {
          min-height: 100vh;
          background:
            radial-gradient(circle at 12% 8%, hsl(var(--primary) / 0.2), transparent 38%),
            radial-gradient(circle at 86% 92%, hsl(var(--accent) / 0.14), transparent 34%),
            hsl(var(--background));
          padding: 1.25rem;
        }

        .playground-header {
          background: hsl(var(--card) / 0.85);
          border-radius: 20px;
          border: 1px solid hsl(var(--border) / 0.9);
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 18px 44px hsl(var(--background) / 0.55);
          backdrop-filter: blur(14px);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .header-icon {
          background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)));
          color: hsl(var(--primary-foreground));
          padding: 1rem;
          border-radius: 16px;
          box-shadow: 0 14px 28px hsl(var(--primary) / 0.28);
        }

        .gradient-text {
          background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-size: 2rem;
          font-weight: 700;
          margin: 0;
        }

        .header-subtitle {
          color: hsl(var(--muted-foreground));
          font-size: 0.9rem;
          margin: 0.25rem 0 0 0;
        }

        .header-actions {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .language-selector {
          padding: 0.75rem 1.5rem;
          border: 1px solid hsl(var(--border) / 0.9);
          border-radius: 12px;
          background: hsl(var(--secondary) / 0.85);
          color: hsl(var(--foreground));
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .language-selector:hover {
          border-color: hsl(var(--primary) / 0.6);
          background: hsl(var(--secondary));
        }

        .playground-layout {
          display: grid;
          grid-template-columns: minmax(340px, 420px) minmax(0, 1fr) minmax(320px, 380px);
          gap: 1.5rem;
          height: calc(100vh - 200px);
        }

        .problem-panel,
        .editor-panel,
        .output-panel {
          background: hsl(var(--card) / 0.82);
          border-radius: 20px;
          border: 1px solid hsl(var(--border) / 0.88);
          box-shadow: 0 18px 44px hsl(var(--background) / 0.55);
          backdrop-filter: blur(12px);
          overflow: hidden;
        }

        .problem-panel-split {
          display: grid;
          grid-template-rows: minmax(230px, 0.95fr) minmax(0, 1.05fr);
          height: 100%;
        }

        .problem-list-pane {
          min-height: 0;
          border-bottom: 1px solid hsl(var(--border) / 0.85);
          overflow: hidden;
        }

        .problem-description-pane {
          display: flex;
          flex-direction: column;
          min-height: 0;
          background: hsl(var(--card) / 0.78);
        }

        .problem-description-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.8rem;
          padding: 0.8rem 1rem;
          border-bottom: 1px solid hsl(var(--border) / 0.8);
          background: hsl(var(--secondary) / 0.6);
        }

        .problem-description-header p {
          margin: 0;
          font-size: 0.78rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: hsl(var(--muted-foreground));
          font-weight: 700;
        }

        .statement-difficulty {
          padding: 0.25rem 0.65rem;
          border-radius: 999px;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border: 1px solid transparent;
        }

        .statement-difficulty.easy {
          background: hsl(var(--accent) / 0.15);
          color: hsl(var(--accent));
          border-color: hsl(var(--accent) / 0.35);
        }

        .statement-difficulty.medium {
          background: hsl(var(--warning) / 0.15);
          color: hsl(var(--warning));
          border-color: hsl(var(--warning) / 0.35);
        }

        .statement-difficulty.hard {
          background: hsl(var(--danger) / 0.15);
          color: hsl(var(--danger));
          border-color: hsl(var(--danger) / 0.35);
        }

        .problem-description-content {
          overflow-y: auto;
          padding: 0.9rem 1rem 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .statement-title {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: hsl(var(--foreground));
        }

        .statement-text {
          margin: 0;
          font-size: 0.84rem;
          line-height: 1.55;
          color: hsl(var(--muted-foreground));
        }

        .statement-section h3 {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          margin: 0 0 0.5rem;
          font-size: 0.82rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: hsl(var(--foreground));
        }

        .example-list,
        .constraint-list,
        .hint-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }

        .example-card {
          border: 1px solid hsl(var(--border) / 0.82);
          border-radius: 10px;
          background: hsl(var(--secondary) / 0.48);
          padding: 0.7rem 0.75rem;
          font-size: 0.78rem;
          color: hsl(var(--foreground));
        }

        .example-card p {
          margin: 0;
          line-height: 1.45;
        }

        .example-card p + p {
          margin-top: 0.25rem;
        }

        .example-heading {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: hsl(var(--primary));
          font-weight: 700;
        }

        .example-explanation {
          color: hsl(var(--muted-foreground));
        }

        .constraint-list li,
        .hint-list li {
          border-radius: 9px;
          border: 1px solid hsl(var(--border) / 0.75);
          background: hsl(var(--secondary) / 0.42);
          padding: 0.52rem 0.65rem;
          font-size: 0.78rem;
          line-height: 1.4;
          color: hsl(var(--foreground));
        }

        .statement-empty-state {
          border-radius: 12px;
          border: 1px dashed hsl(var(--border));
          min-height: 140px;
          display: grid;
          place-items: center;
          text-align: center;
          gap: 0.6rem;
          color: hsl(var(--muted-foreground));
          padding: 1rem;
        }

        .statement-empty-state p {
          margin: 0;
          font-size: 0.82rem;
        }

        .editor-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          background: hsl(var(--secondary) / 0.75);
          border-bottom: 1px solid hsl(var(--border) / 0.9);
        }

        .toolbar-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-weight: 600;
          color: hsl(var(--foreground));
        }

        .toolbar-right {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .btn-run,
        .btn-evaluate,
        .btn-save,
        .btn-recording {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.3s ease;
        }

        .btn-run {
          background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85));
          color: hsl(var(--primary-foreground));
          box-shadow: 0 10px 24px hsl(var(--primary) / 0.3);
        }

        .btn-run:hover:not(:disabled) {
          box-shadow: 0 16px 32px hsl(var(--primary) / 0.34);
          transform: translateY(-1px);
        }

        .btn-evaluate {
          background: hsl(var(--secondary) / 0.88);
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border) / 0.92);
        }

        .btn-evaluate:hover:not(:disabled) {
          border-color: hsl(var(--primary) / 0.5);
          background: hsl(var(--secondary));
          transform: translateY(-1px);
        }

        .btn-save {
          background: linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent) / 0.82));
          color: hsl(var(--accent-foreground));
          box-shadow: 0 10px 24px hsl(var(--accent) / 0.26);
        }

        .btn-save:hover:not(:disabled) {
          box-shadow: 0 16px 32px hsl(var(--accent) / 0.3);
          transform: translateY(-1px);
        }

        .btn-recording {
          background: hsl(var(--secondary) / 0.88);
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border) / 0.92);
        }

        .btn-recording:hover:not(:disabled) {
          border-color: hsl(var(--accent) / 0.45);
          background: hsl(var(--secondary));
          transform: translateY(-1px);
        }

        .btn-run:disabled,
        .btn-evaluate:disabled,
        .btn-save:disabled,
        .btn-recording:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .recording-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: hsl(var(--background) / 0.78);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .recording-modal {
          width: min(920px, 100%);
          background: hsl(var(--card) / 0.98);
          border: 1px solid hsl(var(--border) / 0.9);
          border-radius: 20px;
          box-shadow: 0 30px 60px hsl(var(--background) / 0.65);
          overflow: hidden;
        }

        .recording-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid hsl(var(--border) / 0.85);
          background: hsl(var(--secondary) / 0.75);
        }

        .recording-modal-header h3 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: hsl(var(--foreground));
        }

        .recording-modal-header p {
          margin: 0.3rem 0 0;
          font-size: 0.82rem;
          color: hsl(var(--muted-foreground));
        }

        .recording-close-btn {
          border: 1px solid hsl(var(--border) / 0.9);
          background: hsl(var(--card));
          color: hsl(var(--foreground));
          border-radius: 10px;
          padding: 0.4rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .recording-close-btn:hover {
          border-color: hsl(var(--primary) / 0.5);
          background: hsl(var(--secondary));
        }

        .recording-modal-content {
          padding: 1rem;
          background: hsl(var(--card));
        }

        .recording-player {
          width: 100%;
          max-height: 72vh;
          border-radius: 14px;
          border: 1px solid hsl(var(--border) / 0.9);
          background: hsl(0 0% 4%);
        }

        .recording-empty-state {
          min-height: 180px;
          border-radius: 14px;
          border: 1px dashed hsl(var(--border));
          display: grid;
          place-items: center;
          color: hsl(var(--muted-foreground));
          text-align: center;
          padding: 1rem;
        }

        .panel-tabs {
          display: flex;
          border-bottom: 1px solid hsl(var(--border) / 0.85);
          background: hsl(var(--secondary) / 0.7);
        }

        .tab {
          flex: 1;
          padding: 1rem;
          border: none;
          background: transparent;
          cursor: pointer;
          font-weight: 600;
          color: hsl(var(--muted-foreground));
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.3s ease;
          position: relative;
        }

        .tab.active {
          color: hsl(var(--primary));
          background: hsl(var(--card) / 0.9);
        }

        .tab.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)));
        }

        .panel-content {
          padding: 1.5rem;
          height: calc(100% - 60px);
          overflow-y: auto;
          background: hsl(var(--card) / 0.72);
        }

        .test-results {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .test-case {
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid hsl(var(--border) / 0.85);
          background: hsl(var(--secondary) / 0.65);
        }

        .test-case.passed {
          background: hsl(var(--accent) / 0.12);
          border-color: hsl(var(--accent) / 0.52);
        }

        .test-case.failed {
          background: hsl(var(--danger) / 0.12);
          border-color: hsl(var(--danger) / 0.55);
        }

        .test-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .test-title {
          font-weight: 700;
          color: hsl(var(--foreground));
        }

        .test-status {
          padding: 0.25rem 0.75rem;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .test-status.pass {
          background: hsl(var(--accent));
          color: hsl(var(--accent-foreground));
        }

        .test-status.fail {
          background: hsl(var(--danger));
          color: hsl(var(--danger-foreground));
        }

        .test-detail {
          margin: 0.5rem 0;
          font-size: 0.875rem;
          font-family: 'Courier New', monospace;
        }

        .test-error {
          color: hsl(var(--danger));
          font-size: 0.875rem;
          margin: 0.5rem 0;
          font-weight: 600;
        }

        .test-meta {
          margin-top: 0.5rem;
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground));
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 3rem 1rem;
          color: hsl(var(--muted-foreground));
          text-align: center;
          min-height: 300px;
        }

        .empty-state p {
          margin: 0;
        }

        .empty-hint {
          font-size: 0.875rem;
          color: hsl(var(--muted-foreground));
        }

        /* Responsive Design */
        @media (max-width: 1280px) {
          .playground-layout {
            grid-template-columns: 1fr;
            grid-template-rows: minmax(620px, auto) minmax(500px, auto) minmax(420px, auto);
            height: auto;
          }

          .problem-panel {
            min-height: 620px;
          }

          .problem-panel-split {
            grid-template-rows: minmax(260px, 0.8fr) minmax(280px, 1fr);
          }

          .output-panel {
            min-height: 420px;
          }

          .editor-panel {
            min-height: 500px;
          }
        }

        @media (max-width: 768px) {
          .code-playground-container {
            padding: 1rem;
          }

          .playground-header {
            flex-direction: column;
            gap: 1.5rem;
            padding: 1.5rem;
          }

          .header-actions {
            width: 100%;
            justify-content: space-between;
            flex-wrap: wrap;
          }

          .toolbar-right {
            flex-wrap: wrap;
            justify-content: flex-start;
          }

          .problem-panel-split {
            grid-template-rows: minmax(280px, 0.9fr) minmax(240px, 1fr);
          }

          .problem-description-content {
            padding: 0.8rem;
          }

          .statement-title {
            font-size: 0.98rem;
          }

          .statement-text,
          .example-card,
          .constraint-list li,
          .hint-list li,
          .statement-empty-state p {
            font-size: 0.76rem;
          }

          .gradient-text {
            font-size: 1.5rem;
          }

          .btn-run,
          .btn-evaluate,
          .btn-save,
          .btn-recording {
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
          }

          .recording-modal {
            border-radius: 14px;
          }

          .recording-modal-content {
            padding: 0.75rem;
          }

          .recording-player {
            max-height: 56vh;
            border-radius: 10px;
          }
        }
      `}</style>
    </div>
  );
}
