import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectBySlug, listKnowledge } from "@pam/database";
import { createClient, getUser } from "@/lib/supabase/server";
import { KnowledgeCard } from "@/components/Cards";
import { TagList } from "@/components/Badges";

interface ProjectPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const client = await createClient();
  const user = await getUser();
  if (!user) {
    return { title: "Project" };
  }
  const project = await getProjectBySlug(client, user.id, slug);
  if (!project) {
    return { title: "Project not found" };
  }
  return { title: `${project.name} — Personal AI Memory` };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const client = await createClient();
  const user = await getUser();
  if (!user) {
    return null;
  }

  const project = await getProjectBySlug(client, user.id, slug);
  if (!project) {
    notFound();
  }

  const knowledge = await listKnowledge(client, user.id, {
    projectId: project.id,
  });

  return (
    <div className="stack">
      <div className="stack">
        <div className="section-head">
          <h1 className="page-title">{project.name}</h1>
          <span className="badge badge-gray">{project.status}</span>
        </div>
        <p className="muted">/{project.slug}</p>
        {project.description ? <p>{project.description}</p> : null}
        {project.repositoryUrl ? (
          <p className="muted">
            <a className="link" href={project.repositoryUrl} target="_blank" rel="noopener noreferrer">
              {project.repositoryUrl}
            </a>
          </p>
        ) : null}
        {project.techStack.length > 0 ? <TagList tags={project.techStack} /> : null}
      </div>

      <div className="stack">
        <h2 className="section-title">
          Knowledge ({knowledge.length})
        </h2>
        {knowledge.length === 0 ? (
          <p className="muted">No knowledge for this project yet.</p>
        ) : (
          <div className="card-grid">
            {knowledge.map((item) => (
              <KnowledgeCard key={item.id} knowledge={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
