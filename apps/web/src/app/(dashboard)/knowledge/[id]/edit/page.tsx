import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getKnowledge, listProjects } from "@pam/database";
import { createClient, getUser } from "@/lib/supabase/server";
import { KnowledgeForm } from "@/components/KnowledgeForm";
import { updateKnowledgeAction } from "@/actions/knowledge";

interface EditKnowledgePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: EditKnowledgePageProps): Promise<Metadata> {
  const { id } = await params;
  const client = await createClient();
  const user = await getUser();
  if (!user) {
    return { title: "Edit knowledge" };
  }
  const knowledge = await getKnowledge(client, user.id, id);
  if (!knowledge) {
    return { title: "Knowledge not found" };
  }
  return { title: `Edit ${knowledge.title} — Personal AI Memory` };
}

export default async function EditKnowledgePage({ params }: EditKnowledgePageProps) {
  const { id } = await params;
  const client = await createClient();
  const user = await getUser();
  if (!user) {
    return null;
  }

  const [knowledge, projects] = await Promise.all([
    getKnowledge(client, user.id, id),
    listProjects(client, user.id),
  ]);
  if (!knowledge) {
    notFound();
  }

  return (
    <div className="stack page-narrow">
      <h1 className="page-title">Edit knowledge</h1>
      <KnowledgeForm
        action={updateKnowledgeAction}
        projects={projects}
        knowledgeId={knowledge.id}
        initial={{
          title: knowledge.title,
          type: knowledge.type,
          content: knowledge.content,
          summary: knowledge.summary ?? "",
          tags: knowledge.tags,
          importance: knowledge.importance,
          projectSlug: knowledge.projectSlug,
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
