import type { Metadata } from "next";
import { listProjects } from "@pam/database";
import { createClient, getUser } from "@/lib/supabase/server";
import { KnowledgeForm } from "@/components/KnowledgeForm";
import { createKnowledgeAction } from "@/actions/knowledge";

export const metadata: Metadata = {
  title: "New knowledge — Personal AI Memory",
};

export default async function NewKnowledgePage() {
  const client = await createClient();
  const user = await getUser();
  if (!user) {
    return null;
  }

  const projects = await listProjects(client, user.id);

  return (
    <div className="stack page-narrow">
      <h1 className="page-title">New knowledge</h1>
      <KnowledgeForm action={createKnowledgeAction} projects={projects} submitLabel="Save" />
    </div>
  );
}
