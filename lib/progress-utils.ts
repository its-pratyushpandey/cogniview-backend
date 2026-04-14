// Company Mode Utility Functions

const COMPANY_MODE_MODIFIERS: CompanyModeModifiers = {
  SERVICE_BASED: {
    temperature: 0.6,
    depthLevel: "moderate",
    focusAreas: ["Fundamentals", "Concepts", "Simple coding"],
    promptAddition:
      "Focus on TCS/Wipro/Infosys level questions. Keep explanations moderate depth. Include basic coding problems. Emphasize fundamental concepts and standard approaches.",
  },
  PRODUCT_BASED: {
    temperature: 0.8,
    depthLevel: "deep",
    focusAreas: ["System Design", "Optimization", "Edge cases"],
    promptAddition:
      "Ask Amazon/Google/Microsoft level questions. Expect deep understanding of algorithms, data structures, and system design. Include optimization challenges and trade-offs analysis. Test scalability thinking.",
  },
  STARTUP: {
    temperature: 0.7,
    depthLevel: "practical",
    focusAreas: ["Real scenarios", "Problem solving", "Quick thinking"],
    promptAddition:
      "Focus on practical scenarios and adaptability. Ask 'how would you build X' questions. Test problem-solving skills and ability to work with constraints. Emphasize quick learning and pragmatic solutions.",
  },
};

/**
 * Apply company mode modifier to a base prompt
 * @param basePrompt - The original prompt
 * @param companyType - Type of company (SERVICE_BASED, PRODUCT_BASED, STARTUP)
 * @returns Enhanced prompt with company-specific modifiers
 */
export const applyCompanyMode = (
  basePrompt: string,
  companyType: CompanyType | null
): { enhancedPrompt: string; temperature: number } => {
  if (!companyType) {
    return { enhancedPrompt: basePrompt, temperature: 0.7 };
  }

  const modifier = COMPANY_MODE_MODIFIERS[companyType];
  const enhancedPrompt = `${basePrompt}\n\n**COMPANY MODE: ${companyType}**\n${modifier.promptAddition}`;

  return {
    enhancedPrompt,
    temperature: modifier.temperature,
  };
};

/**
 * Get user's company preference from API
 * @param userId - User ID
 * @returns User's company preference or null
 */
export const getUserCompanyPreference = async (
  userId: string
): Promise<CompanyType | null> => {
  try {
    const response = await fetch(`/api/company-mode/preferences?userId=${userId}`);
    const data = await response.json();
    return data.companyType || null;
  } catch (error) {
    console.error("Error fetching company preference:", error);
    return null;
  }
};

/**
 * Get company mode configuration
 * @param companyType - Type of company
 * @returns Company mode configuration
 */
export const getCompanyModeConfig = (
  companyType: CompanyType
): CompanyModeConfig => {
  return COMPANY_MODE_MODIFIERS[companyType];
};

/**
 * Update progress after user activity
 * @param userId - User ID
 * @param subject - Subject (OS, DBMS, etc.)
 * @param topicName - Topic name
 * @param score - Score achieved (0-100)
 * @param timeTaken - Time taken in seconds
 */
export const updateUserProgress = async (
  userId: string,
  subject: string,
  topicName: string,
  score: number,
  timeTaken?: number
): Promise<void> => {
  try {
    await fetch("/api/progress/update-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        subject,
        topicName,
        score,
        timeTaken,
      }),
    });
  } catch (error) {
    console.error("Error updating progress:", error);
  }
};

/**
 * Calculate topic status based on success rate and attempts
 * @param successRate - Success rate (0-100)
 * @param attempts - Number of attempts
 * @returns Topic status and color
 */
export const calculateTopicStatus = (
  successRate: number,
  attempts: number
): { status: "STRONG" | "MODERATE" | "WEAK" | "NOT_ATTEMPTED"; color: "green" | "yellow" | "red" | "gray" } => {
  if (attempts === 0) return { status: "NOT_ATTEMPTED", color: "gray" };
  if (successRate >= 75) return { status: "STRONG", color: "green" };
  if (successRate >= 50) return { status: "MODERATE", color: "yellow" };
  return { status: "WEAK", color: "red" };
};

const progressUtils = {
  applyCompanyMode,
  getUserCompanyPreference,
  getCompanyModeConfig,
  updateUserProgress,
  calculateTopicStatus,
};

export default progressUtils;
