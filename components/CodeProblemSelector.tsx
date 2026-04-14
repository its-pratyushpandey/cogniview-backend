"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Code2, Clock, Database } from "lucide-react";
import { DSA_PROBLEMS, PROBLEM_CATEGORIES } from "@/constants/dsa-problems";

interface CodeProblemSelectorProps {
  selectedProblem: DSAProblem | null;
  onSelect: (problem: DSAProblem) => void;
  mode?: "practice" | "interview";
}

export default function CodeProblemSelector({ 
  selectedProblem, 
  onSelect
}: CodeProblemSelectorProps) {
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);

  const filteredProblems = DSA_PROBLEMS.filter(problem => {
    const matchesSearch = problem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         problem.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || problem.category === selectedCategory;
    const matchesDifficulty = !selectedDifficulty || problem.difficulty === selectedDifficulty;
    
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  return (
    <div className="problem-selector">
      {/* Header */}
      <div className="selector-header">
        <div className="header-content">
          <Code2 size={22} />
          <h3>DSA Problems</h3>
        </div>
        <span className="problem-count">{filteredProblems.length}</span>
      </div>

      {/* Search & Filters Container */}
      <div className="controls-container">
        {/* Search */}
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search problems..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category Filter */}
        <select
          className="filter-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {PROBLEM_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Difficulty Filters */}
        <div className="difficulty-filters">
          {["Easy", "Medium", "Hard"].map(diff => (
            <button
              key={diff}
              className={`diff-btn ${selectedDifficulty === diff ? "active" : ""}`}
              onClick={() => setSelectedDifficulty(selectedDifficulty === diff ? null : diff)}
              data-difficulty={diff.toLowerCase()}
            >
              {diff}
            </button>
          ))}
        </div>
      </div>

      {/* Problems List */}
      <div className="problems-list">
        <AnimatePresence mode="popLayout">
          {filteredProblems.map((problem, idx) => (
            <motion.div
              key={problem.id}
              className={`problem-item ${selectedProblem?.id === problem.id ? "selected" : ""}`}
              onClick={() => onSelect(problem)}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: idx * 0.03 }}
              whileHover={{ x: 4 }}
            >
              <div className="problem-main">
                <div className="problem-title">{problem.title}</div>
                <div className="problem-category">{problem.category}</div>
              </div>
              
              <div className="problem-info">
                <span 
                  className={`difficulty-badge ${problem.difficulty.toLowerCase()}`}
                >
                  {problem.difficulty}
                </span>
                <div className="problem-stats">
                  <span title="Time Limit">
                    <Clock size={12} />
                    {problem.timeLimit}ms
                  </span>
                  <span title="Memory Limit">
                    <Database size={12} />
                    {problem.memoryLimit}MB
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredProblems.length === 0 && (
          <div className="no-problems">
            <Code2 size={48} />
            <p>No problems found</p>
            <button onClick={() => {
              setSearchQuery("");
              setSelectedCategory("All");
              setSelectedDifficulty(null);
            }}>
              Clear Filters
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .problem-selector {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          background: hsl(var(--card) / 0.65);
        }

        .selector-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          background: linear-gradient(135deg, hsl(var(--primary) / 0.2) 0%, hsl(var(--accent) / 0.12) 100%);
          border-bottom: 1px solid hsl(var(--border) / 0.85);
          flex-shrink: 0;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: hsl(var(--foreground));
        }

        .selector-header h3 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .problem-count {
          background: hsl(var(--primary) / 0.18);
          color: hsl(var(--primary));
          padding: 0.35rem 0.85rem;
          border-radius: 10px;
          font-size: 0.875rem;
          font-weight: 700;
          border: 1px solid hsl(var(--primary) / 0.35);
        }

        .controls-container {
          padding: 1rem 1rem 0.75rem 1rem;
          background: hsl(var(--secondary) / 0.62);
          border-bottom: 1px solid hsl(var(--border) / 0.8);
          flex-shrink: 0;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          margin-bottom: 0.75rem;
          background: hsl(var(--card) / 0.75);
          border: 1px solid hsl(var(--border) / 0.82);
          border-radius: 10px;
          transition: all 0.3s ease;
        }

        .search-box:focus-within {
          border-color: hsl(var(--primary) / 0.45);
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.2);
        }

        .search-box svg {
          color: hsl(var(--muted-foreground));
        }

        .search-box input {
          flex: 1;
          border: none;
          background: transparent;
          outline: none;
          font-size: 0.9rem;
          color: hsl(var(--foreground));
        }

        .search-box input::placeholder {
          color: hsl(var(--muted-foreground));
        }

        .filter-select {
          width: 100%;
          padding: 0.7rem 1rem;
          margin-bottom: 0.75rem;
          border: 1px solid hsl(var(--border) / 0.82);
          border-radius: 10px;
          background: hsl(var(--card) / 0.75);
          color: hsl(var(--foreground));
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          outline: none;
          transition: all 0.3s ease;
        }

        .filter-select:hover {
          border-color: hsl(var(--primary) / 0.45);
        }

        .filter-select option {
          background: hsl(var(--card));
          color: hsl(var(--foreground));
          padding: 0.5rem;
        }

        .difficulty-filters {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }

        .diff-btn {
          padding: 0.65rem 0.5rem;
          border: 1px solid hsl(var(--border) / 0.8);
          border-radius: 8px;
          background: hsl(var(--card) / 0.72);
          color: hsl(var(--muted-foreground));
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .diff-btn:hover {
          color: hsl(var(--foreground));
          border-color: hsl(var(--primary) / 0.35);
        }

        .diff-btn.active[data-difficulty="easy"] {
          background: hsl(var(--accent) / 0.14);
          border-color: hsl(var(--accent) / 0.55);
          color: hsl(var(--accent));
          box-shadow: 0 0 15px hsl(var(--accent) / 0.25);
        }

        .diff-btn.active[data-difficulty="medium"] {
          background: hsl(var(--warning) / 0.16);
          border-color: hsl(var(--warning) / 0.55);
          color: hsl(var(--warning));
          box-shadow: 0 0 15px hsl(var(--warning) / 0.26);
        }

        .diff-btn.active[data-difficulty="hard"] {
          background: hsl(var(--danger) / 0.16);
          border-color: hsl(var(--danger) / 0.58);
          color: hsl(var(--danger));
          box-shadow: 0 0 15px hsl(var(--danger) / 0.28);
        }

        .problems-list {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem;
        }

        .problem-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          margin-bottom: 0.25rem;
          background: hsl(var(--secondary) / 0.45);
          border-left: 3px solid transparent;
          cursor: pointer;
          transition: all 0.3s ease;
          border-radius: 0 8px 8px 0;
        }

        .problem-item:hover {
          background: hsl(var(--primary) / 0.12);
          border-left-color: hsl(var(--primary) / 0.6);
        }

        .problem-item.selected {
          background: hsl(var(--primary) / 0.2);
          border-left-color: hsl(var(--primary));
          box-shadow: 0 8px 22px hsl(var(--primary) / 0.22);
        }

        .problem-main {
          flex: 1;
          min-width: 0;
        }

        .problem-title {
          font-weight: 600;
          font-size: 0.95rem;
          color: hsl(var(--foreground));
          margin-bottom: 0.25rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .problem-category {
          font-size: 0.75rem;
          color: hsl(var(--muted-foreground));
          font-weight: 500;
        }

        .problem-info {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .difficulty-badge {
          padding: 0.25rem 0.65rem;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .difficulty-badge.easy {
          background: hsl(var(--accent) / 0.14);
          color: hsl(var(--accent));
          border: 1px solid hsl(var(--accent) / 0.34);
        }

        .difficulty-badge.medium {
          background: hsl(var(--warning) / 0.14);
          color: hsl(var(--warning));
          border: 1px solid hsl(var(--warning) / 0.34);
        }

        .difficulty-badge.hard {
          background: hsl(var(--danger) / 0.14);
          color: hsl(var(--danger));
          border: 1px solid hsl(var(--danger) / 0.34);
        }

        .problem-stats {
          display: flex;
          gap: 0.75rem;
          font-size: 0.7rem;
          color: hsl(var(--muted-foreground));
        }

        .problem-stats span {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .no-problems {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 3rem 1rem;
          color: hsl(var(--muted-foreground));
          text-align: center;
        }

        .no-problems svg {
          opacity: 0.3;
        }

        .no-problems button {
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)));
          color: hsl(var(--primary-foreground));
          border: none;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .no-problems button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px hsl(var(--primary) / 0.4);
        }

        .problems-list::-webkit-scrollbar {
          width: 5px;
        }

        .problems-list::-webkit-scrollbar-track {
          background: hsl(var(--secondary) / 0.45);
        }

        .problems-list::-webkit-scrollbar-thumb {
          background: hsl(var(--primary) / 0.55);
          border-radius: 3px;
        }

        .problems-list::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--primary) / 0.75);
        }

        @media (max-width: 768px) {
          .problem-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.75rem;
          }

          .problem-info {
            flex-direction: row;
            align-items: center;
            width: 100%;
            justify-content: space-between;
          }

          .difficulty-filters {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
