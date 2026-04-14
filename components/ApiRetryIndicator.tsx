"use client";

import React from "react";
import { motion } from "framer-motion";
import { Loader2, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";

interface ApiRetryIndicatorProps {
  isRetrying: boolean;
  retryCount?: number;
  maxRetries?: number;
  message?: string;
  className?: string;
}

/**
 * Visual indicator for API retry status
 * Shows when requests are being retried due to rate limiting
 */
export function ApiRetryIndicator({
  isRetrying,
  retryCount = 0,
  maxRetries = 3,
  message,
  className = "",
}: ApiRetryIndicatorProps) {
  if (!isRetrying && retryCount === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 ${className}`}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      >
        <RefreshCw size={16} />
      </motion.div>
      <span className="text-sm font-medium">
        {message || `Retrying request... (${retryCount}/${maxRetries})`}
      </span>
    </motion.div>
  );
}

interface LoadingStateProps {
  status: "idle" | "loading" | "retrying" | "success" | "error";
  retryCount?: number;
  maxRetries?: number;
  error?: string;
  successMessage?: string;
  children?: React.ReactNode;
}

/**
 * Comprehensive loading state component
 * Handles loading, retrying, success, and error states
 */
export function LoadingState({
  status,
  retryCount = 0,
  maxRetries = 3,
  error,
  successMessage,
  children,
}: LoadingStateProps) {
  if (status === "idle") {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      {status === "loading" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 size={48} className="text-blue-500" />
          </motion.div>
          <p className="text-gray-600 font-medium">Processing request...</p>
        </motion.div>
      )}

      {status === "retrying" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <RefreshCw size={48} className="text-orange-500" />
            </motion.div>
            <motion.div
              className="absolute -top-1 -right-1 bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
              initial={{ scale: 0 }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              {retryCount}
            </motion.div>
          </div>
          <div className="text-center">
            <p className="text-gray-700 font-medium">
              Request rate limited. Retrying...
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Attempt {retryCount} of {maxRetries}
            </p>
          </div>
          <div className="flex gap-1 mt-2">
            {Array.from({ length: maxRetries }).map((_, i) => (
              <motion.div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i < retryCount ? "bg-orange-500" : "bg-gray-300"
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: i < retryCount ? [1, 1.3, 1] : 1 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
              />
            ))}
          </div>
        </motion.div>
      )}

      {status === "success" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
            }}
          >
            <CheckCircle2 size={48} className="text-green-500" />
          </motion.div>
          <p className="text-gray-700 font-medium">
            {successMessage || "Request successful!"}
          </p>
        </motion.div>
      )}

      {status === "error" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3 max-w-md"
        >
          <AlertCircle size={48} className="text-red-500" />
          <div className="text-center">
            <p className="text-gray-700 font-medium mb-2">Request Failed</p>
            {error && (
              <p className="text-sm text-gray-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                {error}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Simple inline loading spinner
 */
export function InlineLoader({ size = 16, className = "" }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className={className}
    >
      <Loader2 size={size} />
    </motion.div>
  );
}
