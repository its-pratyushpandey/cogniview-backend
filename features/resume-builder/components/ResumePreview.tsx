"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import type { ResumeBuilderDocument, ResumeSectionKey, ResumeTemplateId } from "@/features/resume-builder/types";

interface ResumePreviewProps {
  document: ResumeBuilderDocument;
  onChange: (updater: (current: ResumeBuilderDocument) => ResumeBuilderDocument) => void;
}

interface TemplateStyle {
  wrapper: string;
  headerCard: string;
  sectionTitle: string;
  sectionBlock: string;
  subtleText: string;
  chip: string;
  divider: string;
}

const TEMPLATE_STYLES: Record<ResumeTemplateId, TemplateStyle> = {
  executive: {
    wrapper:
      "bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-900 border border-slate-700/70 rounded-3xl p-6 sm:p-8 shadow-[0_18px_60px_rgba(0,0,0,0.45)]",
    headerCard: "rounded-2xl border border-cyan-400/30 bg-slate-900/80 p-4 sm:p-5",
    sectionTitle: "text-xs tracking-[0.16em] uppercase text-cyan-200/90 font-semibold",
    sectionBlock: "rounded-2xl border border-slate-700/70 bg-slate-900/75 p-4",
    subtleText: "text-slate-300/80",
    chip: "rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-100",
    divider: "border-slate-700/80",
  },
  zenith: {
    wrapper:
      "bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(244,114,182,0.12),transparent_40%),linear-gradient(150deg,#090b12,#0f1524)] border border-sky-400/30 rounded-3xl p-6 sm:p-8 shadow-[0_20px_55px_rgba(10,18,36,0.55)]",
    headerCard: "rounded-2xl border border-sky-300/35 bg-sky-950/30 p-4 sm:p-5",
    sectionTitle: "text-xs tracking-[0.18em] uppercase text-sky-100/90 font-semibold",
    sectionBlock: "rounded-2xl border border-sky-300/25 bg-sky-950/25 p-4",
    subtleText: "text-sky-100/70",
    chip: "rounded-full border border-sky-300/35 bg-sky-400/10 px-2.5 py-1 text-xs text-sky-50",
    divider: "border-sky-200/20",
  },
  matrix: {
    wrapper:
      "bg-[linear-gradient(180deg,#070a09,#0b1110)] border border-emerald-400/25 rounded-3xl p-6 sm:p-8 shadow-[0_18px_56px_rgba(0,0,0,0.45)]",
    headerCard: "rounded-2xl border border-emerald-400/30 bg-emerald-950/20 p-4 sm:p-5",
    sectionTitle: "text-xs tracking-[0.2em] uppercase text-emerald-100/85 font-semibold",
    sectionBlock: "rounded-2xl border border-emerald-400/20 bg-emerald-950/15 p-4",
    subtleText: "text-emerald-100/70",
    chip: "rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-50",
    divider: "border-emerald-400/20",
  },
};

function sectionHeading(section: ResumeSectionKey): string {
  if (section === "summary") return "Professional Summary";
  if (section === "experience") return "Experience";
  if (section === "projects") return "Projects";
  if (section === "education") return "Education";
  return "Skills";
}

function InlineEditableText(props: {
  value: string;
  placeholder: string;
  onCommit: (nextValue: string) => void;
  className?: string;
  multiline?: boolean;
}) {
  const { value, placeholder, onCommit, className, multiline } = props;
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);

  React.useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [editing, value]);

  if (editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            onCommit(draft.trim());
            setEditing(false);
          }}
          className={cn(
            "w-full resize-y rounded-lg border border-primary/35 bg-black/35 px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            className
          )}
          rows={3}
        />
      );
    }

    return (
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          onCommit(draft.trim());
          setEditing(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit(draft.trim());
            setEditing(false);
          }
        }}
        className={cn(
          "w-full rounded-lg border border-primary/35 bg-black/35 px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          className
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        "w-full rounded-lg border border-transparent px-1.5 py-1 text-left transition hover:border-primary/30 hover:bg-white/5",
        className
      )}
    >
      {value ? value : <span className="text-muted-foreground/80">{placeholder}</span>}
    </button>
  );
}

export function ResumePreview({ document, onChange }: ResumePreviewProps) {
  const style = TEMPLATE_STYLES[document.templateId];

  const updateDocumentField = React.useCallback(
    (field: keyof ResumeBuilderDocument, value: unknown) => {
      onChange((current) => ({
        ...current,
        [field]: value,
      }));
    },
    [onChange]
  );

  const updateExperienceField = React.useCallback(
    (id: string, key: "company" | "role" | "summary" | "location", value: string) => {
      onChange((current) => ({
        ...current,
        experience: current.experience.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                [key]: value,
              }
            : entry
        ),
      }));
    },
    [onChange]
  );

  const updateExperienceBullet = React.useCallback(
    (id: string, bulletIndex: number, value: string) => {
      onChange((current) => ({
        ...current,
        experience: current.experience.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                bullets: entry.bullets.map((bullet, index) => (index === bulletIndex ? value : bullet)),
              }
            : entry
        ),
      }));
    },
    [onChange]
  );

  const updateProjectField = React.useCallback(
    (id: string, key: "name" | "role" | "summary" | "link", value: string) => {
      onChange((current) => ({
        ...current,
        projects: current.projects.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                [key]: value,
              }
            : entry
        ),
      }));
    },
    [onChange]
  );

  const updateProjectBullet = React.useCallback(
    (id: string, bulletIndex: number, value: string) => {
      onChange((current) => ({
        ...current,
        projects: current.projects.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                bullets: entry.bullets.map((bullet, index) => (index === bulletIndex ? value : bullet)),
              }
            : entry
        ),
      }));
    },
    [onChange]
  );

  const updateEducationField = React.useCallback(
    (id: string, key: "institution" | "degree" | "score", value: string) => {
      onChange((current) => ({
        ...current,
        education: current.education.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                [key]: value,
              }
            : entry
        ),
      }));
    },
    [onChange]
  );

  const updateSkill = React.useCallback(
    (index: number, value: string) => {
      onChange((current) => ({
        ...current,
        skills: current.skills.map((skill, skillIndex) => (skillIndex === index ? value : skill)),
      }));
    },
    [onChange]
  );

  const isDenseTemplate = document.templateId === "matrix";

  return (
    <motion.div
      key={document.templateId}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={style.wrapper}
    >
      <header className={style.headerCard}>
        <InlineEditableText
          value={document.header.fullName}
          placeholder="Your Name"
          onCommit={(value) => updateDocumentField("header", { ...document.header, fullName: value })}
          className={cn("text-2xl font-semibold tracking-tight text-white", isDenseTemplate ? "font-mono" : "")}
        />

        <InlineEditableText
          value={document.header.headline}
          placeholder="Role Headline"
          onCommit={(value) => updateDocumentField("header", { ...document.header, headline: value })}
          className={cn("mt-1 text-sm font-medium", style.subtleText, isDenseTemplate ? "font-mono" : "")}
        />

        <div className={cn("mt-3 grid gap-1 text-xs sm:grid-cols-2", style.subtleText)}>
          <InlineEditableText
            value={document.header.email}
            placeholder="email@domain.com"
            onCommit={(value) => updateDocumentField("header", { ...document.header, email: value })}
          />
          <InlineEditableText
            value={document.header.phone}
            placeholder="+91 XXXXX XXXXX"
            onCommit={(value) => updateDocumentField("header", { ...document.header, phone: value })}
          />
          <InlineEditableText
            value={document.header.location}
            placeholder="City, Country"
            onCommit={(value) => updateDocumentField("header", { ...document.header, location: value })}
          />
          <InlineEditableText
            value={document.header.linkedin}
            placeholder="linkedin.com/in/your-handle"
            onCommit={(value) => updateDocumentField("header", { ...document.header, linkedin: value })}
          />
        </div>
      </header>

      <div className="mt-4 space-y-3">
        {document.sectionOrder.map((section) => (
          <section key={section} className={style.sectionBlock}>
            <h3 className={style.sectionTitle}>{sectionHeading(section)}</h3>
            <div className={cn("mt-2 border-t pt-3", style.divider)}>
              {section === "summary" ? (
                <InlineEditableText
                  value={document.summary}
                  placeholder="Add a high-impact summary"
                  onCommit={(value) => updateDocumentField("summary", value)}
                  multiline
                  className={cn("leading-6", style.subtleText)}
                />
              ) : null}

              {section === "experience" ? (
                <div className="space-y-3">
                  {document.experience.length === 0 ? (
                    <p className={cn("text-sm", style.subtleText)}>No experience items yet.</p>
                  ) : null}

                  {document.experience.map((experience) => (
                    <article key={experience.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="grid gap-1 sm:grid-cols-2">
                        <InlineEditableText
                          value={experience.role}
                          placeholder="Role"
                          onCommit={(value) => updateExperienceField(experience.id, "role", value)}
                          className="text-sm font-semibold text-white"
                        />
                        <InlineEditableText
                          value={experience.company}
                          placeholder="Company"
                          onCommit={(value) => updateExperienceField(experience.id, "company", value)}
                          className="text-sm font-semibold text-white"
                        />
                      </div>

                      <InlineEditableText
                        value={experience.location}
                        placeholder="Location"
                        onCommit={(value) => updateExperienceField(experience.id, "location", value)}
                        className={cn("mt-1 text-xs", style.subtleText)}
                      />

                      <InlineEditableText
                        value={experience.summary}
                        placeholder="Experience summary"
                        onCommit={(value) => updateExperienceField(experience.id, "summary", value)}
                        multiline
                        className={cn("mt-2 text-sm", style.subtleText)}
                      />

                      {experience.bullets.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {experience.bullets.map((bullet, index) => (
                            <li key={`${experience.id}-bullet-${index}`} className="list-inside list-disc">
                              <InlineEditableText
                                value={bullet}
                                placeholder="Result-oriented bullet"
                                onCommit={(value) => updateExperienceBullet(experience.id, index, value)}
                                className={cn("text-xs", style.subtleText)}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}

              {section === "projects" ? (
                <div className="space-y-3">
                  {document.projects.length === 0 ? (
                    <p className={cn("text-sm", style.subtleText)}>No projects added yet.</p>
                  ) : null}

                  {document.projects.map((project) => (
                    <article key={project.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <InlineEditableText
                        value={project.name}
                        placeholder="Project Name"
                        onCommit={(value) => updateProjectField(project.id, "name", value)}
                        className="text-sm font-semibold text-white"
                      />

                      <InlineEditableText
                        value={project.role}
                        placeholder="Your Role"
                        onCommit={(value) => updateProjectField(project.id, "role", value)}
                        className={cn("mt-1 text-xs", style.subtleText)}
                      />

                      <InlineEditableText
                        value={project.summary}
                        placeholder="Project summary"
                        onCommit={(value) => updateProjectField(project.id, "summary", value)}
                        multiline
                        className={cn("mt-2 text-sm", style.subtleText)}
                      />

                      {project.bullets.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {project.bullets.map((bullet, index) => (
                            <li key={`${project.id}-bullet-${index}`} className="list-inside list-disc">
                              <InlineEditableText
                                value={bullet}
                                placeholder="Project impact bullet"
                                onCommit={(value) => updateProjectBullet(project.id, index, value)}
                                className={cn("text-xs", style.subtleText)}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      <InlineEditableText
                        value={project.link}
                        placeholder="Project URL"
                        onCommit={(value) => updateProjectField(project.id, "link", value)}
                        className={cn("mt-2 text-xs", style.subtleText)}
                      />
                    </article>
                  ))}
                </div>
              ) : null}

              {section === "education" ? (
                <div className="space-y-3">
                  {document.education.length === 0 ? (
                    <p className={cn("text-sm", style.subtleText)}>No education records yet.</p>
                  ) : null}

                  {document.education.map((education) => (
                    <article key={education.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <InlineEditableText
                        value={education.degree}
                        placeholder="Degree"
                        onCommit={(value) => updateEducationField(education.id, "degree", value)}
                        className="text-sm font-semibold text-white"
                      />

                      <InlineEditableText
                        value={education.institution}
                        placeholder="Institution"
                        onCommit={(value) => updateEducationField(education.id, "institution", value)}
                        className={cn("mt-1 text-xs", style.subtleText)}
                      />

                      <InlineEditableText
                        value={education.score}
                        placeholder="CGPA / Score"
                        onCommit={(value) => updateEducationField(education.id, "score", value)}
                        className={cn("mt-1 text-xs", style.subtleText)}
                      />
                    </article>
                  ))}
                </div>
              ) : null}

              {section === "skills" ? (
                <div className="flex flex-wrap gap-2">
                  {document.skills.length === 0 ? (
                    <p className={cn("text-sm", style.subtleText)}>Add skills from the form panel.</p>
                  ) : null}

                  {document.skills.map((skill, index) => (
                    <div key={`${skill}-${index}`} className={style.chip}>
                      <InlineEditableText
                        value={skill}
                        placeholder="Skill"
                        onCommit={(value) => updateSkill(index, value)}
                        className="min-w-[70px] px-1 py-0 text-xs"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </motion.div>
  );
}
