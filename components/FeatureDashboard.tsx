import Link from "next/link";
import Image from "next/image";
import { 
  Home, 
  Mic, 
  GraduationCap, 
  Brain, 
  FileText, 
  ClipboardCheck, 
  Calculator, 
  Lightbulb, 
  TrendingUp, 
  Building2,
  Bot,
  Code2
} from "lucide-react";

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: typeof Brain;
  color: string;
  href: string;
  badge?: string;
  badgeColor?: string;
  isNew?: boolean;
  isHot?: boolean;
}

const FEATURES: Feature[] = [
  {
    id: "home",
    title: "Dashboard",
    description: "Your learning overview and progress summary",
    icon: Home,
    color: "#3b82f6",
    href: "/",
  },
  {
    id: "ai-interview",
    title: "AI Interview",
    description: "Voice-based mock interviews with instant feedback",
    icon: Mic,
    color: "#3b82f6",
    href: "/interview",
    badge: "Voice",
    badgeColor: "#3b82f6",
    isHot: true,
  },
  {
    id: "ai-tutor",
    title: "AI Tutor",
    description: "Personalized learning assistant for all CS topics",
    icon: GraduationCap,
    color: "#10b981",
    href: "/tutor",
    isNew: true,
    badgeColor: "#10b981",
  },
  {
    id: "smart-revision",
    title: "Smart Revision",
    description: "AI-powered study materials and revision plans",
    icon: Brain,
    color: "#667eea",
    href: "/revision",
    isHot: true,
    badgeColor: "#667eea",
  },
  {
    id: "resume-analysis",
    title: "Resume Intelligence",
    description: "Deep skill extraction, weakness engine, adaptive questions",
    icon: FileText,
    color: "#8b5cf6",
    href: "/resume-analysis",
    isHot: true,
    badgeColor: "#8b5cf6",
  },
  {
    id: "resume-prep",
    title: "Resume Prep (Legacy)",
    description: "Legacy resume mapping experience",
    icon: FileText,
    color: "#64748b",
    href: "/resume-prep",
    badgeColor: "#64748b",
  },
  {
    id: "mcq-practice",
    title: "MCQ Practice",
    description: "Placement-level multiple choice questions",
    icon: ClipboardCheck,
    color: "#3b82f6",
    href: "/mcq",
    isNew: true,
    badgeColor: "#3b82f6",
  },
  {
    id: "aptitude-trainer",
    title: "Aptitude Trainer",
    description: "Master reasoning and aptitude tests",
    icon: Calculator,
    color: "#8b5cf6",
    href: "/aptitude",
    isNew: true,
    badgeColor: "#8b5cf6",
  },
 
  {
    id: "ai-viva",
    title: "AI Quiz",
    description: "Adaptive questioning for deeper understanding",
    icon: Lightbulb,
    color: "#8b5cf6",
    href: "/viva",
    isNew: true,
    badgeColor: "#8b5cf6",
  },
  {
    id: "progress",
    title: "Progress Tracker",
    description: "Track your learning journey and improvements",
    icon: TrendingUp,
    color: "#f59e0b",
    href: "/progress",
  },
  {
    id: "company-mode",
    title: "Company-wise Prep",
    description: "Targeted preparation by company and role",
    icon: Building2,
    color: "#f97316",
    href: "/company-prep",
    isNew: true,
    badgeColor: "#f97316",
  },
  {
    id: "engineering-chat",
    title: "Engineering Chat",
    description: "CS topics expert chatbot assistant",
    icon: Bot,
    color: "#667eea",
    href: "/engineering-chat",
    isNew: true,
    badgeColor: "#667eea",
  },
  {
    id: "code-playground",
    title: "Code Playground",
    description: "Live coding with DSA problems, execution & AI evaluation",
    icon: Code2,
    color: "#8b5cf6",
    href: "/code-playground",
    badge: "New",
    badgeColor: "#8b5cf6",
    isNew: true,
    isHot: true,
  },
];

const FeatureDashboard = () => {
  return (
    <div className="feature-dashboard-container">
      {/* Hero Section */}
      <section className="feature-dashboard-hero">
        <div className="feature-dashboard-hero-image-wrapper">
          <Image
            src="/hero.png"
            alt="Cogniview - AI-Powered Learning Platform"
            width={1000}
            height={400}
            priority
            className="feature-dashboard-hero-image"
            quality={85}
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
            }}
          />
        </div>
      </section>

      {/* Features Grid */}
      <section className="feature-dashboard-grid-section">
        <h2 className="feature-dashboard-section-title">
          Explore All Features
        </h2>
        
        <div className="feature-dashboard-grid">
          {FEATURES.map((feature) => {
            const IconComponent = feature.icon;
            return (
              <div
                key={feature.id}
              >
                <Link href={feature.href} className="feature-dashboard-card">
                  <div className="feature-dashboard-card-header">
                    <div 
                      className="feature-dashboard-card-icon"
                      style={{ backgroundColor: `${feature.color}15` }}
                    >
                      <IconComponent 
                        size={28} 
                        style={{ color: feature.color }}
                      />
                    </div>
                    
                    {(feature.isNew || feature.isHot) && (
                      <span 
                        className="feature-dashboard-card-badge"
                        style={{ backgroundColor: feature.badgeColor || feature.color }}
                      >
                        {feature.isNew && "NEW"}
                        {feature.isHot && !feature.isNew && "🔥"}
                      </span>
                    )}
                  </div>
                  
                  <h3 className="feature-dashboard-card-title">{feature.title}</h3>
                  <p className="feature-dashboard-card-description">{feature.description}</p>
                  
                  <div className="feature-dashboard-card-footer">
                    <span className="feature-dashboard-card-link">
                      Explore →
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Call to Action */}
      <section className="feature-dashboard-cta">
        <div className="feature-dashboard-cta-content">
          <h2 className="feature-dashboard-cta-title">
            Ready to Start Your Journey?
          </h2>
          <p className="feature-dashboard-cta-subtitle">
            Begin with an AI interview or explore our learning tools
          </p>
          <div className="feature-dashboard-cta-buttons">
            <Link href="/interview" className="feature-dashboard-cta-button primary">
              <Mic size={20} />
              Start AI Interview
            </Link>
            <Link href="/tutor" className="feature-dashboard-cta-button secondary">
              <GraduationCap size={20} />
              Launch AI Tutor
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FeatureDashboard;
