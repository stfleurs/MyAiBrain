import type { SupabaseClient } from "@supabase/supabase-js";
import type { Project, ProjectStatus, ProjectSummary } from "@pam/shared";
import type { Database } from "./types";
import { mapProject } from "./mapping";
import { slugify } from "./util";

export interface ProjectInput {
  name: string;
  description?: string | null;
  repositoryUrl?: string | null;
  techStack?: string[];
  status?: ProjectStatus;
}

export interface ProjectUpdate extends Partial<ProjectInput> {
  slug?: string;
}

export async function listProjects(
  client: SupabaseClient<Database>,
  userId: string
): Promise<ProjectSummary[]> {
  const { data: projects, error } = await client
    .from("projects")
    .select("id, name, slug, description, tech_stack, status")
    .eq("user_id", userId)
    .order("name");

  if (error) {
    throw error;
  }

  const { data: knowledge, error: kError } = await client
    .from("knowledge")
    .select("project_id")
    .eq("user_id", userId);

  if (kError) {
    throw kError;
  }

  const counts = new Map<string, number>();
  for (const row of knowledge ?? []) {
    if (row.project_id) {
      counts.set(row.project_id, (counts.get(row.project_id) ?? 0) + 1);
    }
  }

  return (projects ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    techStack: row.tech_stack,
    status: row.status,
    knowledgeCount: counts.get(row.id) ?? 0,
  }));
}

export async function getProjectBySlug(
  client: SupabaseClient<Database>,
  userId: string,
  slug: string
): Promise<Project | null> {
  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? mapProject(data) : null;
}

export async function getProjectById(
  client: SupabaseClient<Database>,
  userId: string,
  id: string
): Promise<Project | null> {
  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? mapProject(data) : null;
}

export async function createProject(
  client: SupabaseClient<Database>,
  userId: string,
  input: ProjectInput
): Promise<Project> {
  const slug = slugify(input.name);
  const { data, error } = await client
    .from("projects")
    .insert({
      user_id: userId,
      name: input.name,
      slug,
      description: input.description ?? null,
      repository_url: input.repositoryUrl ?? null,
      tech_stack: input.techStack ?? [],
      status: input.status ?? "active",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return mapProject(data);
}

export async function updateProject(
  client: SupabaseClient<Database>,
  userId: string,
  id: string,
  update: ProjectUpdate
): Promise<Project | null> {
  const existing = await getProjectById(client, userId, id);
  if (!existing) {
    return null;
  }

  const { data, error } = await client
    .from("projects")
    .update({
      name: update.name,
      slug: update.slug,
      description: update.description === undefined ? existing.description : update.description,
      repository_url:
        update.repositoryUrl === undefined ? existing.repositoryUrl : update.repositoryUrl,
      tech_stack: update.techStack ?? existing.techStack,
      status: update.status ?? existing.status,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return mapProject(data);
}

export async function deleteProject(
  client: SupabaseClient<Database>,
  userId: string,
  id: string
): Promise<boolean> {
  const existing = await getProjectById(client, userId, id);
  if (!existing) {
    return false;
  }
  const { error } = await client.from("projects").delete().eq("id", id);
  if (error) {
    throw error;
  }
  return true;
}

export async function resolveProject(
  client: SupabaseClient<Database>,
  userId: string,
  slugOrName: string
): Promise<Project> {
  const existing = await getProjectBySlug(client, userId, slugify(slugOrName));
  if (existing) {
    return existing;
  }
  return createProject(client, userId, { name: slugOrName });
}
