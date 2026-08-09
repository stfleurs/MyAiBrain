"use client";

import { useActionState } from "react";
import { KNOWLEDGE_TYPE_LABELS, KNOWLEDGE_TYPES, type KnowledgeType } from "@pam/shared";
import type { ProjectSummary } from "@pam/shared";
import type { KnowledgeFormState } from "@/actions/knowledge";

interface KnowledgeFormProps {
  action: (
    prevState: KnowledgeFormState,
    formData: FormData
  ) => Promise<KnowledgeFormState>;
  projects: ProjectSummary[];
  initial?: {
    title: string;
    type: KnowledgeType;
    content: string;
    summary: string;
    tags: string[];
    importance: number;
    projectSlug: string | null;
  };
  knowledgeId?: string;
  submitLabel: string;
}

export function KnowledgeForm({
  action,
  projects,
  initial,
  knowledgeId,
  submitLabel,
}: KnowledgeFormProps) {
  const [state, formAction, pending] = useActionState<KnowledgeFormState, FormData>(
    action,
    {}
  );

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="knowledgeId" value={knowledgeId ?? ""} />

      <label>
        Title
        <input
          type="text"
          name="title"
          required
          maxLength={300}
          defaultValue={initial?.title}
          placeholder="Concise, specific title"
        />
      </label>

      <label>
        Type
        <select name="type" required defaultValue={initial?.type ?? "lesson"}>
          {KNOWLEDGE_TYPES.map((type) => (
            <option key={type} value={type}>
              {KNOWLEDGE_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      <label>
        Project
        <select name="projectSlug" defaultValue={initial?.projectSlug ?? "none"}>
          <option value="none">No project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.slug}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        New project name (optional, used instead of the selection above)
        <input
          type="text"
          name="newProject"
          maxLength={100}
          placeholder="my-app"
        />
      </label>

      <label>
        Content (markdown)
        <textarea name="content" required rows={12} defaultValue={initial?.content} />
      </label>

      <label>
        Summary (optional)
        <textarea name="summary" rows={3} maxLength={2000} defaultValue={initial?.summary} />
      </label>

      <label>
        Tags (comma separated)
        <input
          type="text"
          name="tags"
          defaultValue={initial?.tags.join(", ")}
          placeholder="flutter, firebase, revenuecat"
        />
      </label>

      <label>
        Importance
        <select name="importance" defaultValue={initial?.importance ?? 3}>
          {[1, 2, 3, 4, 5].map((level) => (
            <option key={level} value={level}>
              {level} {level === 3 ? "(default)" : ""}
            </option>
          ))}
        </select>
      </label>

      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
