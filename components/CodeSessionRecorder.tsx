"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, Square, Video } from "lucide-react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "@/firebase/client";

interface CodeSessionRecorderProps {
  isRecording: boolean;
  onToggle: () => void;
  userId: string;
  sessionContextId?: string;
  onUploadComplete?: (recordingUrl: string) => void;
  onUploadStatusChange?: (status: RecorderUploadStatus) => void;
}

type RecorderState = "idle" | "recording" | "processing" | "uploading" | "uploaded" | "error";

interface RecorderUploadStatus {
  state: RecorderState;
  progress: number;
  error?: string;
}

type RecordRTCRecorder = {
  startRecording: () => void;
  stopRecording: (cb: () => void) => void;
  getBlob: () => Blob | null | undefined;
};

export default function CodeSessionRecorder({
  isRecording,
  onToggle,
  userId,
  sessionContextId,
  onUploadComplete,
  onUploadStatusChange,
}: CodeSessionRecorderProps) {
  const [recordingTime, setRecordingTime] = useState(0);
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<RecordRTCRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const setStatus = useCallback(
    (state: RecorderState, progress: number, error?: string) => {
      setRecorderState(state);
      setUploadProgress(progress);
      setUploadError(error ?? null);
      onUploadStatusChange?.({ state, progress, error });
    },
    [onUploadStatusChange]
  );

  const releaseRecordingResources = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => {
    setStatus("idle", 0);
  }, [setStatus]);

  useEffect(() => {
    return () => {
      releaseRecordingResources();
    };
  }, [releaseRecordingResources]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const buildRecordingPath = useCallback(() => {
    const safeUserId = userId.trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "anonymous";
    const safeContext = (sessionContextId || "practice").replace(/[^a-zA-Z0-9_-]/g, "_");
    return `code-recordings/${safeUserId}/${safeContext}/recording-${Date.now()}.webm`;
  }, [sessionContextId, userId]);

  const uploadRecording = useCallback(
    async (blob: Blob) => {
      setStatus("uploading", 0);

      const recordingPath = buildRecordingPath();
      const recordingRef = ref(storage, recordingPath);

      const uploadTask = uploadBytesResumable(recordingRef, blob, {
        contentType: "video/webm",
      });

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setStatus("uploading", progress);
        },
        (error) => {
          const message = error.message || "Recording upload failed";
          setStatus("error", 0, message);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          setStatus("uploaded", 100);
          onUploadComplete?.(downloadUrl);
        }
      );
    },
    [buildRecordingPath, onUploadComplete, setStatus]
  );

  const startRecording = async () => {
    try {
      // Dynamic import RecordRTC only when needed (client-side)
      const RecordRTCModule = await import("recordrtc");
      const RecordRTCConstructor = RecordRTCModule.default;

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "window" as DisplayCaptureSurfaceType,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: true
      });

      streamRef.current = stream;
      setUploadError(null);

      const recorder = new RecordRTCConstructor(stream, {
        type: "video",
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 2500000
      }) as RecordRTCRecorder;

      recorder.startRecording();
      mediaRecorderRef.current = recorder;

      // Start timer
      setRecordingTime(0);
      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      setStatus("recording", 0);
      onToggle();

      // Handle stream ending
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (mediaRecorderRef.current) {
          void stopRecording();
        }
      });

    } catch (error) {
      const err = error as { name?: string; message?: string };
      // Handle permission denial gracefully without console errors
      if (err?.name === "NotAllowedError" || err?.message?.includes("Permission denied")) {
        // User denied permission - silently handle it
        console.log("Screen recording permission denied by user");
        setStatus("error", 0, "Screen recording permission was denied.");
      } else if (err?.name === "NotFoundError") {
        console.log("No screen sharing source available");
        setStatus("error", 0, "No shareable screen source is available.");
      } else {
        console.warn("Screen recording unavailable:", err?.message || "Unknown error");
        setStatus("error", 0, err?.message || "Unable to start recording.");
      }
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !streamRef.current) return;

    setStatus("processing", 0);

    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isRecording) {
      onToggle();
    }

    // Stop recording
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stopRecording(() => {
        const blob = mediaRecorderRef.current?.getBlob();

        releaseRecordingResources();
        setRecordingTime(0);

        if (!blob) {
          setStatus("error", 0, "Could not finalize recording.");
          return;
        }

        void uploadRecording(blob);
      });
    }
  };

  const isBusy = recorderState === "processing" || recorderState === "uploading";

  return (
    <div className="recorder-wrapper">
      <motion.button
        className={`record-btn ${isRecording ? "recording" : ""} ${isBusy ? "processing" : ""}`}
        onClick={isRecording ? stopRecording : startRecording}
        whileHover={{ scale: isBusy ? 1 : 1.05 }}
        whileTap={{ scale: isBusy ? 1 : 0.95 }}
        disabled={isBusy}
      >
        {recorderState === "uploading" ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Uploading {uploadProgress}%</span>
          </>
        ) : recorderState === "processing" ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Processing...</span>
          </>
        ) : isRecording || recorderState === "recording" ? (
          <>
            <Square size={18} fill="currentColor" />
            <span>Stop Recording</span>
            <span className="recording-time">{formatTime(recordingTime)}</span>
          </>
        ) : (
          <>
            <Video size={18} />
            <span>Record Session</span>
          </>
        )}
      </motion.button>

      <div className="status-row" aria-live="polite">
        {recorderState === "uploaded" ? (
          <p className="status success">
            <CheckCircle2 size={14} /> Recording synced and ready to save.
          </p>
        ) : null}

        {recorderState === "uploading" ? (
          <p className="status neutral">
            <Loader2 size={14} className="animate-spin" /> Uploading in background.
          </p>
        ) : null}

        {uploadError ? (
          <p className="status error">
            <AlertCircle size={14} /> {uploadError}
          </p>
        ) : null}
      </div>

      <style jsx>{`
        .recorder-wrapper {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.45rem;
          min-width: 240px;
        }

        .record-btn {
          padding: 0.75rem 1.5rem;
          border: 1px solid hsl(var(--danger) / 0.35);
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, hsl(var(--danger)), hsl(var(--danger) / 0.82));
          color: hsl(var(--danger-foreground));
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          box-shadow: 0 10px 24px hsl(var(--danger) / 0.24);
        }

        .record-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .record-btn.recording {
          background: linear-gradient(135deg, hsl(var(--danger)), hsl(var(--danger) / 0.72));
          animation: pulse-glow 2s infinite;
        }

        .record-btn.processing {
          background: hsl(var(--secondary));
          border-color: hsl(var(--border));
          box-shadow: none;
        }

        @keyframes pulse-glow {
          0%, 100% { 
            box-shadow: 0 0 0 0 hsl(var(--danger) / 0.55);
          }
          50% { 
            box-shadow: 0 0 0 10px hsl(var(--danger) / 0);
          }
        }

        .record-btn:hover:not(:disabled) {
          box-shadow: 0 16px 30px hsl(var(--danger) / 0.3);
          transform: translateY(-1px);
        }

        .recording-time {
          padding: 0.25rem 0.5rem;
          background: hsl(var(--background) / 0.25);
          border-radius: 6px;
          font-family: 'Courier New', monospace;
          font-size: 0.875rem;
        }

        .status-row {
          min-height: 20px;
          width: 100%;
          display: flex;
          justify-content: flex-end;
        }

        .status {
          margin: 0;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .status.neutral {
          color: hsl(var(--muted-foreground));
        }

        .status.success {
          color: hsl(var(--accent));
        }

        .status.error {
          color: hsl(var(--danger));
        }

        @media (max-width: 768px) {
          .recorder-wrapper {
            width: 100%;
            min-width: 0;
            align-items: stretch;
          }

          .status-row {
            justify-content: flex-start;
          }

          .record-btn {
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
          }
        }
      `}</style>
    </div>
  );
}
