import Link from "next/link";
import type { KnowledgeWithMeta, ProjectSummary } from "@pam/shared";
import { ImportanceBadge, TagList, TypeBadge } from "./Badges";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function KnowledgeCard({ knowledge }: { knowledge: KnowledgeWithMeta }) {
  const summary = knowledge.summary ?? knowledge.content.slice(0, 160);
  return (
    <article className="card">
      <Link href={`/knowledge/${knowledge.id}`} className="card-link">
        <div className="card-meta">
          <TypeBadge type={knowledge.type} />
          <ImportanceBadge importance={knowledge.importance} />
          {knowledge.projectSlug ? (
            <Link href={`/projects/${knowledge.projectSlug}`} className="muted">
              {knowledge.projectSlug}
            </Link>
          ) : null}
        </div>
        <h3 className="card-title">{knowledge.title}</h3>
        <p className="card-body">{summary}</p>
        <div className="card-footer">
          <TagList tags={knowledge.tags} />
          <span className="muted">{formatDate(knowledge.createdAt)}</span>
        </div>
      </Link>
    </article>
  );
}

export function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <article className="card">
      <Link href={`/projects/${project.slug}`} className="card-link">
        <div className="card-meta">
          <span className="badge badge-gray">{project.status}</span>
          <span className="muted">
            {project.knowledgeCount} knowledge
          </span>
        </div>
        <h3 className="card-title">{project.name}</h3>
        {project.description ? (
          <p className="card-body">{project.description}</p>
        ) : null}
        {project.techStack.length > 0 ? (
          <div className="tag-list">
            {project.techStack.map((tech) => (
              <span key={tech} className="tag">
                {tech}
              </span>
            ))}
          </div>
        ) : null}
      </Link>
    </article>
  );
}
