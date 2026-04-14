"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CompanyModeSettingsProps {
  userId: string;
  onModeChange?: (mode: CompanyType) => void;
}

const COMPANY_INFO = {
  SERVICE_BASED: {
    name: "Service-Based Companies",
    icon: "🏢",
    color: "var(--primary-500)",
    description: "TCS, Wipro, Infosys, Accenture, Cognizant",
    features: [
      "Fundamental concepts focus",
      "Moderate difficulty level",
      "Basic coding problems",
      "Standard interview patterns",
    ],
    examples: ["TCS", "Wipro", "Infosys", "Accenture", "Cognizant", "HCL"],
  },
  PRODUCT_BASED: {
    name: "Product-Based Companies",
    icon: "🚀",
    color: "var(--purple-500)",
    description: "Amazon, Google, Microsoft, Meta, Apple",
    features: [
      "Deep technical knowledge",
      "System design & scalability",
      "Complex problem solving",
      "Optimization & trade-offs",
    ],
    examples: ["Amazon", "Google", "Microsoft", "Meta", "Apple", "Netflix"],
  },
  STARTUP: {
    name: "Startup Companies",
    icon: "💡",
    color: "var(--success-500)",
    description: "High-growth startups and unicorns",
    features: [
      "Practical problem solving",
      "Quick adaptability",
      "Real-world scenarios",
      "Hands-on coding",
    ],
    examples: ["Razorpay", "Zomato", "Swiggy", "CRED", "PhonePe", "Paytm"],
  },
};

const CompanyModeSettings = ({ userId, onModeChange }: CompanyModeSettingsProps) => {
  const [selectedMode, setSelectedMode] = useState<CompanyType | null>(null);
  const [targetCompanies, setTargetCompanies] = useState<string[]>([]);
  const [customCompany, setCustomCompany] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/company-mode/preferences?userId=${userId}`);
        const data = await response.json();
        if (data.companyType) {
          setSelectedMode(data.companyType);
          setTargetCompanies(data.targetCompanies || []);
        }
      } catch (error) {
        console.error("Error fetching preferences:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchPreferences();
  }, [userId]);

  const savePreferences = async () => {
    if (!selectedMode) return;

    try {
      setSaving(true);
      const response = await fetch("/api/company-mode/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          companyType: selectedMode,
          targetCompanies,
        }),
      });

      if (response.ok) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        if (onModeChange) {
          onModeChange(selectedMode);
        }
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleModeSelect = (mode: CompanyType) => {
    setSelectedMode(mode);
    setTargetCompanies([]);
  };

  const addCustomCompany = () => {
    if (customCompany.trim() && !targetCompanies.includes(customCompany.trim())) {
      setTargetCompanies([...targetCompanies, customCompany.trim()]);
      setCustomCompany("");
    }
  };

  const removeCompany = (company: string) => {
    setTargetCompanies(targetCompanies.filter((c) => c !== company));
  };

  if (loading) {
    return (
      <div className="company-mode-loading">
        <div className="loading-spinner-large"></div>
        <p>Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="company-mode-container">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="company-mode-header"
      >
        <h1 className="text-3xl font-bold mb-2">🎯 Company-Oriented Preparation</h1>
        <p className="text-gray-600">
          Customize your learning experience based on target company type
        </p>
      </motion.div>

      {/* Mode Selection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mode-selection-grid"
      >
        {(Object.keys(COMPANY_INFO) as CompanyType[]).map((mode, index) => {
          const info = COMPANY_INFO[mode];
          const isSelected = selectedMode === mode;

          return (
            <motion.div
              key={mode}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleModeSelect(mode)}
              className={`mode-card ${isSelected ? "selected" : ""}`}
              style={{
                borderColor: isSelected ? info.color : "transparent",
              }}
            >
              <div className="mode-icon" style={{ color: info.color }}>
                {info.icon}
              </div>
              <h3 className="mode-name">{info.name}</h3>
              <p className="mode-description">{info.description}</p>
              <div className="mode-features">
                {info.features.map((feature, idx) => (
                  <div key={idx} className="feature-item">
                    <span className="feature-bullet">•</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <div className="mode-examples">
                <strong>Examples:</strong>
                <div className="example-tags">
                  {info.examples.slice(0, 3).map((example) => (
                    <span key={example} className="example-tag">
                      {example}
                    </span>
                  ))}
                </div>
              </div>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="selected-badge"
                >
                  ✓ Selected
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Target Companies */}
      <AnimatePresence>
        {selectedMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="target-companies-section"
          >
            <h3 className="section-title">🎯 Target Companies (Optional)</h3>
            <p className="section-description">
              Add specific companies you&apos;re preparing for
            </p>

            <div className="company-input-group">
              <input
                type="text"
                value={customCompany}
                onChange={(e) => setCustomCompany(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addCustomCompany()}
                placeholder="Enter company name..."
                className="company-input"
              />
              <button onClick={addCustomCompany} className="add-company-btn">
                Add
              </button>
            </div>

            {targetCompanies.length > 0 && (
              <div className="selected-companies">
                {targetCompanies.map((company) => (
                  <motion.div
                    key={company}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="company-chip"
                  >
                    <span>{company}</span>
                    <button
                      onClick={() => removeCompany(company)}
                      className="remove-company-btn"
                    >
                      ×
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Button */}
      {selectedMode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="save-section"
        >
          <button
            onClick={savePreferences}
            disabled={saving}
            className="save-preferences-btn"
          >
            {saving ? (
              <>
                <div className="loading-spinner"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Save Preferences</span>
              </>
            )}
          </button>
        </motion.div>
      )}

      {/* Success Message */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="success-toast"
          >
            ✅ Preferences saved successfully!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="company-mode-info"
      >
        <h4 className="info-title">ℹ️ How it works</h4>
        <ul className="info-list">
          <li>
            Your selected mode will adjust the <strong>difficulty level</strong> and{" "}
            <strong>question types</strong> across all features
          </li>
          <li>
            AI Tutor, Interview, and MCQ modules will adapt to your company type
          </li>
          <li>You can change your preference anytime</li>
          <li>Target companies help personalize question patterns</li>
        </ul>
      </motion.div>
    </div>
  );
};

export default CompanyModeSettings;
