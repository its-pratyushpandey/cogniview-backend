import type { ResumeBuilderDocument, ResumeSectionKey } from "@/features/resume-builder/types";

interface WriteContext {
  y: number;
}

const PAGE_MARGIN = 48;
const PAGE_MAX_Y = 792 - PAGE_MARGIN;

function toReadableDateRange(startDate: string, endDate: string, current: boolean): string {
  const start = startDate.trim() || "Start";
  const end = current ? "Present" : endDate.trim() || "End";
  return `${start} - ${end}`;
}

export async function exportResumeToPdf(document: ResumeBuilderDocument): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const pdf = new jsPDF({
    unit: "pt",
    format: "a4",
  });

  const width = pdf.internal.pageSize.getWidth();
  const contentWidth = width - PAGE_MARGIN * 2;
  const cursor: WriteContext = { y: PAGE_MARGIN };

  const ensurePage = (requiredHeight = 24) => {
    if (cursor.y + requiredHeight <= PAGE_MAX_Y) {
      return;
    }

    pdf.addPage();
    cursor.y = PAGE_MARGIN;
  };

  const writeLine = (text: string, options?: { size?: number; bold?: boolean; spacing?: number }) => {
    const lineSize = options?.size ?? 11;
    const spacing = options?.spacing ?? 14;

    ensurePage(spacing + 6);
    pdf.setFont("helvetica", options?.bold ? "bold" : "normal");
    pdf.setFontSize(lineSize);
    pdf.text(text, PAGE_MARGIN, cursor.y);
    cursor.y += spacing;
  };

  const writeWrapped = (text: string, options?: { size?: number; bold?: boolean; spacing?: number }) => {
    const lineSize = options?.size ?? 10;
    const spacing = options?.spacing ?? 13;

    pdf.setFont("helvetica", options?.bold ? "bold" : "normal");
    pdf.setFontSize(lineSize);

    const lines = pdf.splitTextToSize(text, contentWidth) as string[];
    for (const line of lines) {
      ensurePage(spacing + 4);
      pdf.text(line, PAGE_MARGIN, cursor.y);
      cursor.y += spacing;
    }
  };

  const writeSectionTitle = (title: string) => {
    cursor.y += 8;
    ensurePage(24);
    pdf.setDrawColor(160);
    pdf.setLineWidth(0.8);
    pdf.line(PAGE_MARGIN, cursor.y, width - PAGE_MARGIN, cursor.y);
    cursor.y += 14;
    writeLine(title.toUpperCase(), { size: 12, bold: true, spacing: 16 });
  };

  writeLine(document.header.fullName || "Your Name", { size: 22, bold: true, spacing: 24 });

  const contactParts = [
    document.header.headline,
    document.header.email,
    document.header.phone,
    document.header.location,
    document.header.linkedin,
    document.header.github,
    document.header.portfolio,
  ].filter(Boolean);

  if (contactParts.length > 0) {
    writeWrapped(contactParts.join(" | "), { size: 10, spacing: 12 });
  }

  const sections: ResumeSectionKey[] = [...document.sectionOrder];
  for (const section of sections) {
    if (section === "summary") {
      if (!document.summary.trim()) continue;
      writeSectionTitle("Professional Summary");
      writeWrapped(document.summary.trim(), { size: 10, spacing: 13 });
      continue;
    }

    if (section === "experience") {
      const validExperience = document.experience.filter((entry) => entry.company || entry.role || entry.summary);
      if (validExperience.length === 0) continue;

      writeSectionTitle("Experience");
      for (const experience of validExperience) {
        writeLine(`${experience.role || "Role"} | ${experience.company || "Company"}`, {
          size: 11,
          bold: true,
          spacing: 13,
        });
        writeLine(toReadableDateRange(experience.startDate, experience.endDate, experience.current), {
          size: 9,
          spacing: 12,
        });

        if (experience.summary.trim()) {
          writeWrapped(experience.summary.trim(), { size: 10, spacing: 12 });
        }

        for (const bullet of experience.bullets.filter(Boolean)) {
          writeWrapped(`- ${bullet}`, { size: 10, spacing: 12 });
        }

        cursor.y += 4;
      }

      continue;
    }

    if (section === "projects") {
      const validProjects = document.projects.filter((entry) => entry.name || entry.summary || entry.bullets.length > 0);
      if (validProjects.length === 0) continue;

      writeSectionTitle("Projects");
      for (const project of validProjects) {
        writeLine(project.name || "Project", { size: 11, bold: true, spacing: 13 });

        const projectMeta = [
          project.role,
          project.technologies.length > 0 ? `Tech: ${project.technologies.join(", ")}` : "",
          project.link,
        ]
          .filter(Boolean)
          .join(" | ");

        if (projectMeta) {
          writeWrapped(projectMeta, { size: 9, spacing: 11 });
        }

        if (project.summary.trim()) {
          writeWrapped(project.summary.trim(), { size: 10, spacing: 12 });
        }

        for (const bullet of project.bullets.filter(Boolean)) {
          writeWrapped(`- ${bullet}`, { size: 10, spacing: 12 });
        }

        cursor.y += 4;
      }

      continue;
    }

    if (section === "education") {
      const validEducation = document.education.filter((entry) => entry.institution || entry.degree);
      if (validEducation.length === 0) continue;

      writeSectionTitle("Education");
      for (const education of validEducation) {
        writeLine(`${education.degree || "Degree"} | ${education.institution || "Institution"}`, {
          size: 11,
          bold: true,
          spacing: 13,
        });

        const educationMeta = [
          education.score,
          education.startDate || education.endDate ? `${education.startDate || ""} ${education.endDate ? `- ${education.endDate}` : ""}`.trim() : "",
        ]
          .filter(Boolean)
          .join(" | ");

        if (educationMeta) {
          writeWrapped(educationMeta, { size: 9, spacing: 11 });
        }
      }

      continue;
    }

    if (section === "skills") {
      if (document.skills.length === 0) continue;
      writeSectionTitle("Skills");
      writeWrapped(document.skills.join(" | "), { size: 10, spacing: 12 });
    }
  }

  const filename = (document.header.fullName || "resume").toLowerCase().replace(/\s+/g, "-");
  pdf.save(`${filename}-cogniview.pdf`);
}
