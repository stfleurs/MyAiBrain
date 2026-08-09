import type { Metadata } from "next";
import Link from "next/link";
import type { KnowledgeWithMeta } from "@pam/shared";
import { getKnowledgeByIds, listKnowledge, listProjects, searchKeyword } from "@pam/database";
import { createClient, getUser } from "@/lib/supabase/server";
import { SearchBox } from "@/components/SearchBox";
import { KnowledgeCard, ProjectCard } from "@/components/Cards";

export const metadata: Metadata = {
  title: "Dashboard — Personal AI Memory",
};

interface DashboardSearchParams {
  q?: string;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const { q } = await searchParams;
  const client = await createClient();
  const user = await getUser();
  if (!user) {
    return null;
  }

  const query = q?.trim() ?? "";

  if (query) {
    const hits = await searchKeyword(client, user.id, query, { limit: 20 });
    const meta = await getKnowledgeByIds(
      client,
      user.id,
      hits.map((hit) => hit.knowledge.id)
    );
    const byId = new Map(meta.map((item) => [item.id, item]));
    const results = hits
      .map((hit) => {
        const item = byId.get(hit.knowledge.id);
        return item ?? { ...hit.knowledge, tags: [], projectSlug: null };
      })
      .filter((item): item is KnowledgeWithMeta => item !== undefined);

    return (
      <div className="stack">
        <SearchBox defaultValue={query} />
        <h2 className="section-title">
          {results.length} result{results.length === 1 ? "" : "s"} for “
          {query}”
        </h2>
        {results.length === 0 ? (
          <p className="muted">
            No memory matches. Try different keywords or create a new entry.
          </p>
        ) : (
          <div className="card-grid">
            {results.map((item) => (
              <KnowledgeCard key={item.id} knowledge={item} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const [projects, recent] = await Promise.all([
    listProjects(client, user.id),
    listKnowledge(client, user.id, { limit: 10 }),
  ]);

  return (
    <div className="stack">
      <SearchBox />
      <div className="stack">
        <div className="section-head">
          <h2 className="section-title">Projects</h2>
          <span className="muted">{projects.length} total</span>
        </div>
        {projects.length === 0 ? (
          <p className="muted">No projects yet.</p>
        ) : (
          <div className="card-grid">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
      <div className="stack">
        <div className="section-head">
          <h2 className="section-title">Recent knowledge</h2>
          <span className="muted">{recent.length} shown</span>
        </div>
        {recent.length === 0 ? (
          <p className="muted">
            Nothing here yet.{" "}
            <Link className="link" href="/knowledge/new">
              Save your first memory
            </Link>
            .
          </p>
        ) : (
          <div className="card-grid">
            {recent.map((item) => (
              <KnowledgeCard key={item.id} knowledge={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
