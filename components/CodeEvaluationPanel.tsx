"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Brain, Zap, Award, TrendingUp, Target, CheckCircle } from "lucide-react";

interface CodeEvaluationPanelProps {
  evaluation: CodeEvaluation;
}

export default function CodeEvaluationPanel({ evaluation }: CodeEvaluationPanelProps) {
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return "hsl(var(--accent))";
    if (score >= 60) return "hsl(var(--primary))";
    if (score >= 40) return "hsl(var(--warning))";
    return "hsl(var(--danger))";
  };

  const getQualityColor = (score: number) => {
    if (score >= 8) return "hsl(var(--accent))";
    if (score >= 6) return "hsl(var(--primary))";
    if (score >= 4) return "hsl(var(--warning))";
    return "hsl(var(--danger))";
  };

  return (
    <AnimatePresence>
      <motion.div
        className="evaluation-panel"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.4 }}
      >
        {/* Overall Score */}
        <div className="eval-header">
          <div className="score-circle" style={{ borderColor: getScoreColor(evaluation.score) }}>
            <span className="score-number" style={{ color: getScoreColor(evaluation.score) }}>
              {evaluation.score}
            </span>
            <span className="score-label">/ 100</span>
          </div>
          <div className="eval-title">
            <Brain size={24} />
            <h3>AI Code Evaluation</h3>
          </div>
        </div>

        {/* Complexity Analysis */}
        <div className="complexity-section">
          <div className="complexity-card">
            <Zap size={20} />
            <div>
              <p className="complexity-label">Time Complexity</p>
              <p className="complexity-value">{evaluation.timeComplexity}</p>
            </div>
          </div>
          <div className="complexity-card">
            <Target size={20} />
            <div>
              <p className="complexity-label">Space Complexity</p>
              <p className="complexity-value">{evaluation.spaceComplexity}</p>
            </div>
          </div>
        </div>

        {/* Code Quality Metrics */}
        <div className="quality-section">
          <h4>Code Quality Metrics</h4>
          <div className="quality-grid">
            <div className="quality-item">
              <div className="quality-header">
                <span>Readability</span>
                <span style={{ color: getQualityColor(evaluation.codeQuality.readability) }}>
                  {evaluation.codeQuality.readability}/10
                </span>
              </div>
              <div className="quality-bar">
                <motion.div
                  className="quality-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${evaluation.codeQuality.readability * 10}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  style={{ background: getQualityColor(evaluation.codeQuality.readability) }}
                />
              </div>
            </div>

            <div className="quality-item">
              <div className="quality-header">
                <span>Efficiency</span>
                <span style={{ color: getQualityColor(evaluation.codeQuality.efficiency) }}>
                  {evaluation.codeQuality.efficiency}/10
                </span>
              </div>
              <div className="quality-bar">
                <motion.div
                  className="quality-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${evaluation.codeQuality.efficiency * 10}%` }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  style={{ background: getQualityColor(evaluation.codeQuality.efficiency) }}
                />
              </div>
            </div>

            <div className="quality-item">
              <div className="quality-header">
                <span>Correctness</span>
                <span style={{ color: getQualityColor(evaluation.codeQuality.correctness) }}>
                  {evaluation.codeQuality.correctness}/10
                </span>
              </div>
              <div className="quality-bar">
                <motion.div
                  className="quality-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${evaluation.codeQuality.correctness * 10}%` }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  style={{ background: getQualityColor(evaluation.codeQuality.correctness) }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Strengths */}
        {evaluation.strengths.length > 0 && (
          <div className="feedback-section strengths">
            <h4><CheckCircle size={18} /> Strengths</h4>
            <ul>
              {evaluation.strengths.map((strength, idx) => (
                <motion.li
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + idx * 0.1 }}
                >
                  {strength}
                </motion.li>
              ))}
            </ul>
          </div>
        )}

        {/* Suggestions */}
        {evaluation.suggestions.length > 0 && (
          <div className="feedback-section suggestions">
            <h4><TrendingUp size={18} /> Suggestions</h4>
            <ul>
              {evaluation.suggestions.map((suggestion, idx) => (
                <motion.li
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + idx * 0.1 }}
                >
                  {suggestion}
                </motion.li>
              ))}
            </ul>
          </div>
        )}

        {/* Improvements */}
        {evaluation.improvements.length > 0 && (
          <div className="feedback-section improvements">
            <h4><Award size={18} /> Areas for Improvement</h4>
            <ul>
              {evaluation.improvements.map((improvement, idx) => (
                <motion.li
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + idx * 0.1 }}
                >
                  {improvement}
                </motion.li>
              ))}
            </ul>
          </div>
        )}

        {/* Detailed Analysis */}
        <div className="analysis-section">
          <h4>Detailed Analysis</h4>
          <p>{evaluation.geminiAnalysis}</p>
        </div>

        <style jsx>{`
          .evaluation-panel {
            background: hsl(var(--card) / 0.85);
            border-radius: 16px;
            padding: 2rem;
            margin-top: 1.5rem;
            box-shadow: 0 16px 34px hsl(var(--background) / 0.5);
            border: 1px solid hsl(var(--border) / 0.85);
            backdrop-filter: blur(10px);
          }

          .eval-header {
            display: flex;
            align-items: center;
            gap: 2rem;
            margin-bottom: 2rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid hsl(var(--border) / 0.85);
          }

          .score-circle {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            border: 6px solid;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .score-number {
            font-size: 2rem;
            font-weight: 800;
            line-height: 1;
          }

          .score-label {
            font-size: 0.75rem;
            color: hsl(var(--muted-foreground));
          }

          .eval-title {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }

          .eval-title h3 {
            font-size: 1.5rem;
            font-weight: 700;
            margin: 0;
            background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }

          .complexity-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
          }

          .complexity-card {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1.25rem;
            background: hsl(var(--secondary) / 0.7);
            border: 1px solid hsl(var(--border) / 0.85);
            border-radius: 12px;
          }

          .complexity-label {
            font-size: 0.875rem;
            color: hsl(var(--muted-foreground));
            margin: 0 0 0.25rem 0;
          }

          .complexity-value {
            font-size: 1.125rem;
            font-weight: 700;
            color: hsl(var(--foreground));
            margin: 0;
            font-family: 'Courier New', monospace;
          }

          .quality-section {
            margin-bottom: 2rem;
          }

          .quality-section h4 {
            font-size: 1.125rem;
            font-weight: 700;
            margin: 0 0 1rem 0;
            color: hsl(var(--foreground));
          }

          .quality-grid {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .quality-item {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .quality-header {
            display: flex;
            justify-content: space-between;
            font-size: 0.875rem;
            font-weight: 600;
          }

          .quality-bar {
            height: 8px;
            background: hsl(var(--muted));
            border-radius: 4px;
            overflow: hidden;
          }

          .quality-fill {
            height: 100%;
            border-radius: 4px;
          }

          .feedback-section {
            margin-bottom: 1.5rem;
          }

          .feedback-section h4 {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 1rem;
            font-weight: 700;
            margin: 0 0 0.75rem 0;
          }

          .feedback-section ul {
            list-style: none;
            padding: 0;
            margin: 0;
          }

          .feedback-section li {
            padding: 0.75rem 1rem;
            margin-bottom: 0.5rem;
            border-radius: 8px;
            font-size: 0.875rem;
            line-height: 1.6;
          }

          .strengths h4 { color: hsl(var(--accent)); }
          .strengths li {
            background: hsl(var(--accent) / 0.12);
            border-left: 4px solid hsl(var(--accent));
          }

          .suggestions h4 { color: hsl(var(--primary)); }
          .suggestions li {
            background: hsl(var(--primary) / 0.12);
            border-left: 4px solid hsl(var(--primary));
          }

          .improvements h4 { color: hsl(var(--warning)); }
          .improvements li {
            background: hsl(var(--warning) / 0.12);
            border-left: 4px solid hsl(var(--warning));
          }

          .analysis-section {
            padding: 1.5rem;
            background: hsl(var(--secondary) / 0.7);
            border-radius: 12px;
            border: 1px solid hsl(var(--border) / 0.85);
          }

          .analysis-section h4 {
            font-size: 1rem;
            font-weight: 700;
            margin: 0 0 0.75rem 0;
            color: hsl(var(--foreground));
          }

          .analysis-section p {
            margin: 0;
            line-height: 1.7;
            color: hsl(var(--muted-foreground));
            font-size: 0.875rem;
          }

          @media (max-width: 768px) {
            .evaluation-panel {
              padding: 1.5rem;
            }

            .eval-header {
              flex-direction: column;
              align-items: flex-start;
              gap: 1rem;
            }

            .score-circle {
              width: 80px;
              height: 80px;
            }

            .complexity-section {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}
