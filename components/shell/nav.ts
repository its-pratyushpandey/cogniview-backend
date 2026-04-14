import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Brain,
  Code2,
  FileSearch,
  FilePenLine,
  LayoutDashboard,
  Mic,
  Building2,
  ClipboardCheck,
  Calculator,
  Sparkles,
  MessageSquare,
  GraduationCap,
  UserCircle2,
  Target,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  exact?: boolean;
  badge?: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const APP_NAV: NavSection[] = [
  {
    title: "Dashboard",
    items: [
      {
        title: "Overview",
        href: "/",
        icon: LayoutDashboard,
        description: "Stats, insights, and quick actions",
        exact: true,
      },
      {
        title: "Intelligence Core",
        href: "/intelligence",
        icon: Brain,
        description: "Unified adaptive intelligence dashboard",
      },
      {
        title: "Profile",
        href: "/profile",
        icon: UserCircle2,
        description: "Account details and preferences",
      },
    ],
  },
  {
    title: "Mock Interviews",
    items: [
      {
        title: "Voice Interview",
        href: "/interview",
        icon: Mic,
        description: "Full mock interview session",
      },
      {
        title: "Answer Analysis",
        href: "/answer-scoring",
        icon: BarChart3,
        description: "Score and improve interview answers",
      },
      {
        title: "AI Quiz",
        href: "/viva",
        icon: Sparkles,
        description: "Adaptive follow-up chain",
        badge: "New",
      },
     
    ],
  },
  {
    title: "Resume",
    items: [
      {
        title: "Resume Intelligence",
        href: "/resume-analysis",
        icon: FileSearch,
        description: "Skills, weaknesses, adaptive questions",
        badge: "New",
      },
      
      {
        title: "Resume Builder",
        href: "/resume-prep?tab=builder",
        icon: FilePenLine,
        description: "Edit, iterate, and version",
      },
    ],
  },
  {
    title: "Practice",
    items: [
      {
        title: "Practice Hub",
        href: "/practice",
        icon: Target,
        description: "Unified practice control center",
        badge: "New",
      },
      {
        title: "MCQ Practice",
        href: "/mcq",
        icon: ClipboardCheck,
        description: "Timed MCQ sessions",
      },
      {
        title: "Aptitude Trainer",
        href: "/aptitude",
        icon: Calculator,
        description: "Problem solving with hints",
      },
      {
        title: "AI Tutor",
        href: "/tutor",
        icon: GraduationCap,
        description: "Learn topics interactively",
      },
      {
        title: "Smart Revision",
        href: "/revision",
        icon: Brain,
        description: "Quick notes and last-day prep",
      },
    ],
  },
  {
    title: "Coding",
    items: [
      {
        title: "Coding Playground",
        href: "/code-playground",
        icon: Code2,
        description: "Editor, run, evaluate",
      },
    ],
  },
  {
    title: "Company Prep",
    items: [
      {
        title: "Company-wise Prep",
        href: "/company-prep",
        icon: Building2,
        description: "Role + company adaptive preparation",
        badge: "New",
      },
      
      {
        title: "Engineering Chat",
        href: "/engineering-chat",
        icon: MessageSquare,
        description: "Ask CS topics & interview Qs",
      },
    ],
  },
  {
    title: "Progress & Analytics",
    items: [
      {
        title: "Progress Heatmap",
        href: "/progress",
        icon: BarChart3,
        description: "Subject-level mastery map",
      },
    ],
  },
];

export const FULLSCREEN_ROUTES = ["/code-playground", "/interview", "/viva"] as const;

export function isFullScreenRoute(pathname: string): boolean {
  return FULLSCREEN_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
