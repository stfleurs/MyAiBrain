import { KNOWLEDGE_TYPE_LABELS, type KnowledgeType } from "@pam/shared";

const TYPE_CLASS: Record<KnowledgeType, string> = {
  architecture: "badge-blue",
  decision: "badge-purple",
  pattern: "badge-teal",
  bug_fix: "badge-red",
  template: "badge-gray",
  lesson: "badge-green",
  configuration: "badge-amber",
  deployment: "badge-indigo",
  feature: "badge-cyan",
};

export function TypeBadge({ type }: { type: KnowledgeType }) {
  return (
    <span className={`badge ${TYPE_CLASS[type]}`}>
      {KNOWLEDGE_TYPE_LABELS[type]}
    </span>
  );
}

export function ImportanceBadge({ importance }: { importance: number }) {
  return (
    <span className="badge badge-gray" title={`Importance ${importance}/5`}>
      {importance}/5
    </span>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return null;
  }
  return (
    <div className="tag-list">
      {tags.map((tag) => (
        <span key={tag} className="tag">
          #{tag}
        </span>
      ))}
    </div>
  );
}
