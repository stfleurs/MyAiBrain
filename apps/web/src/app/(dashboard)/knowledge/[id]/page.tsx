import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getKnowledge } from "@pam/database";
import { createClient, getUser } from "@/lib/supabase/server";
import { ImportanceBadge, TagList, TypeBadge } from "@/components/Badges";
import { Markdown } from "@/components/Markdown";
import { DeleteButton } from "@/components/DeleteButton";

interface KnowledgePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: KnowledgePageProps): Promise<Metadata> {
  const { id } = await params;
  const client = await createClient();
  const user = await getUser();
  if (!user) {
    return { title: "Knowledge" };
  }
  const knowledge = await getKnowledge(client, user.id, id);
  if (!knowledge) {
    return { title: "Knowledge not found" };
  }
  return { title: `${knowledge.title} — Personal AI Memory` };
}

export default async function KnowledgePage({ params }: KnowledgePageProps) {
  const { id } = await params;
  const client = await createClient();
  const user = await getUser();
  if (!user) {
    return null;
  }

  const knowledge = await getKnowledge(client, user.id, id);
  if (!knowledge) {
    notFound();
  }

  return (
    <div className="stack">
      <div className="stack">
        <div className="card-meta">
          <TypeBadge type={knowledge.type} />
          <ImportanceBadge importance={knowledge.importance} />
          {knowledge.projectSlug ? (
            <Link href={`/projects/${knowledge.projectSlug}`} className="muted">
              /{knowledge.projectSlug}
            </Link>
          ) : null}
        </div>
        <h1 className="page-title">{knowledge.title}</h1>
        {knowledge.summary ? (
          <p className="muted">{knowledge.summary}</p>
        ) : null}
        <TagList tags={knowledge.tags} />
        <div className="card-meta muted">
          <span>Created {new Date(knowledge.createdAt).toLocaleDateString()}</span>
          <span>Updated {new Date(knowledge.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>

      <Markdown source={knowledge.content} />

      <div className="card-meta actions">
        <Link href={`/knowledge/${knowledge.id}/edit`} className="btn">
          Edit
        </Link>
        <DeleteButton knowledgeId={knowledge.id} title={knowledge.title} />
      </div>
    </div>
  );
}
