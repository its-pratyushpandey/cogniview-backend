"use client";

import { motion } from "framer-motion";
import { Terminal, Loader2 } from "lucide-react";

interface CodeOutputProps {
  output: string;
  isExecuting: boolean;
  executionTime?: number;
}

export default function CodeOutput({ output, isExecuting, executionTime }: CodeOutputProps) {
  
  const getOutputStatus = () => {
    if (isExecuting) return "running";
    if (output.includes("❌")) return "error";
    if (output.includes("✅")) return "success";
    return "info";
  };

  const status = getOutputStatus();

  return (
    <motion.div 
      className="code-output-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="output-header">
        <div className="output-title">
          <Terminal size={18} />
          <span>Output</span>
        </div>
        
        {executionTime && !isExecuting && (
          <div className="execution-time">
            ⚡ {executionTime}ms
          </div>
        )}
        
        {isExecuting && (
          <div className="executing-indicator">
            <Loader2 size={16} className="animate-spin" />
            <span>Running...</span>
          </div>
        )}
      </div>

      <div className={`output-content ${status}`}>
        {isExecuting ? (
          <div className="loading-output">
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p>Executing your code...</p>
          </div>
        ) : output ? (
          <pre>{output}</pre>
        ) : (
          <div className="empty-output">
            <Terminal size={32} />
            <p>No output yet. Run your code to see the results here.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .code-output-container {
          background: hsl(var(--card) / 0.82);
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid hsl(var(--border) / 0.85);
          box-shadow: 
            inset 0 0 50px hsl(var(--primary) / 0.05),
            0 12px 30px hsl(var(--background) / 0.5);
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .output-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          background: hsl(var(--secondary) / 0.75);
          border-bottom: 1px solid hsl(var(--border) / 0.85);
          flex-shrink: 0;
        }

        .output-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: hsl(var(--foreground));
          font-weight: 600;
          font-size: 0.95rem;
        }

        .execution-time {
          padding: 0.4rem 0.8rem;
          background: hsl(var(--accent) / 0.14);
          color: hsl(var(--accent));
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          border: 1px solid hsl(var(--accent) / 0.35);
        }

        .executing-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: hsl(var(--primary));
          font-size: 0.85rem;
          font-weight: 600;
        }

        .output-content {
          padding: 1.5rem;
          overflow-y: auto;
          font-family: 'Fira Code', 'Monaco', 'Courier New', monospace;
          font-size: 0.9rem;
          line-height: 1.6;
          background: hsl(var(--background));
          flex: 1;
        }

        .output-content pre {
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: hsl(var(--foreground));
        }

        .output-content.running {
          background: linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, hsl(var(--background)) 100%);
        }

        .output-content.success {
          background: linear-gradient(135deg, hsl(var(--accent) / 0.08) 0%, hsl(var(--background)) 100%);
          border-left: 3px solid hsl(var(--accent));
        }

        .output-content.error {
          background: linear-gradient(135deg, hsl(var(--danger) / 0.08) 0%, hsl(var(--background)) 100%);
          border-left: 3px solid hsl(var(--danger));
        }

        .output-content.info {
          background: hsl(var(--background));
        }

        .loading-output,
        .empty-output {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: hsl(var(--muted-foreground));
          gap: 1rem;
        }

        .loading-dots {
          display: flex;
          gap: 0.5rem;
        }

        .loading-dots span {
          width: 8px;
          height: 8px;
          background: hsl(var(--primary));
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }

        .loading-dots span:nth-child(1) {
          animation-delay: -0.32s;
        }

        .loading-dots span:nth-child(2) {
          animation-delay: -0.16s;
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .empty-output svg {
          opacity: 0.3;
          color: hsl(var(--primary));
        }

        .empty-output p,
        .loading-output p {
          margin: 0;
          font-size: 0.95rem;
        }

        .output-content::-webkit-scrollbar {
          width: 6px;
        }

        .output-content::-webkit-scrollbar-track {
          background: hsl(var(--secondary) / 0.5);
        }

        .output-content::-webkit-scrollbar-thumb {
          background: hsl(var(--primary) / 0.55);
          border-radius: 3px;
        }

        .output-content::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--primary) / 0.75);
        }

        @media (max-width: 768px) {
          .output-header {
            padding: 0.75rem 1rem;
          }
          
          .output-content {
            padding: 1rem;
          }
        }
      `}</style>
    </motion.div>
  );
}
