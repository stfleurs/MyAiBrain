import type { SupabaseClient } from "@supabase/supabase-js";
import type { Knowledge, KnowledgeImportance, KnowledgeType, KnowledgeWithMeta } from "@pam/shared";
import type { Database } from "./types";
import { mapKnowledge } from "./mapping";
import { getProjectById } from "./projects";
import { getTagsForKnowledge, getTagsForKnowledgeBatch, setKnowledgeTags } from "./tags";
import { vectorToString } from "./util";

export interface SaveKnowledgeInput {
  type: KnowledgeType;
  title: string;
  content: string;
  summary?: string | null;
  source?: string | null;
  importance: KnowledgeImportance;
  projectId: string | null;
  tags?: string[];
}

export interface UpdateKnowledgePatch {
  type?: KnowledgeType;
  title?: string;
  content?: string;
  summary?: string | null;
  importance?: KnowledgeImportance;
  projectId?: string | null;
  tags?: string[];
}

export interface ListKnowledgeOptions {
  projectId?: string;
  type?: KnowledgeType;
  limit?: number;
  offset?: number;
}

export interface KeywordHit {
  knowledge: Knowledge;
  keywordScore: number;
}

export interface VectorHit {
  knowledge: Knowledge;
  vectorScore: number;
}

export interface SearchFilters {
  type?: KnowledgeType;
  projectId?: string;
}

async function loadMeta(
  client: SupabaseClient<Database>,
  userId: string,
  knowledge: Knowledge
): Promise<KnowledgeWithMeta> {
  const tags = await getTagsForKnowledge(client, userId, knowledge.id);
  let projectSlug: string | null = null;
  if (knowledge.projectId) {
    const project = await getProjectById(client, userId, knowledge.projectId);
    projectSlug = project?.slug ?? null;
  }
  return { ...knowledge, tags, projectSlug };
}

async function loadMetaBatch(
  client: SupabaseClient<Database>,
  userId: string,
  rows: Knowledge[]
): Promise<KnowledgeWithMeta[]> {
  const tagMap = await getTagsForKnowledgeBatch(
    client,
    userId,
    rows.map((row) => row.id)
  );
  const projectIds = [...new Set(rows.map((row) => row.projectId).filter((id): id is string => !!id))];
  const projects = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data, error } = await client
      .from("projects")
      .select("id, slug")
      .eq("user_id", userId)
      .in("id", projectIds);
    if (error) {
      throw error;
    }
    for (const project of data ?? []) {
      projects.set(project.id, project.slug);
    }
  }
  return rows.map((row) => ({
    ...row,
    tags: tagMap.get(row.id) ?? [],
    projectSlug: row.projectId ? projects.get(row.projectId) ?? null : null,
  }));
}

export async function getKnowledge(
  client: SupabaseClient<Database>,
  userId: string,
  id: string
): Promise<KnowledgeWithMeta | null> {
  const { data, error } = await client
    .from("knowledge")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  return loadMeta(client, userId, mapKnowledge(data));
}

export async function listKnowledge(
  client: SupabaseClient<Database>,
  userId: string,
  options: ListKnowledgeOptions = {}
): Promise<KnowledgeWithMeta[]> {
  let query = client
    .from("knowledge")
    .select("*")
    .eq("user_id", userId)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false });

  if (options.projectId) {
    query = query.eq("project_id", options.projectId);
  }
  if (options.type) {
    query = query.eq("type", options.type);
  }
  if (options.limit !== undefined) {
    query = query.limit(options.limit);
  }
  if (options.offset !== undefined) {
    query = query.range(options.offset, options.offset + (options.limit ?? 20) - 1);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return loadMetaBatch(client, userId, (data ?? []).map(mapKnowledge));
}

export async function createKnowledge(
  client: SupabaseClient<Database>,
  userId: string,
  input: SaveKnowledgeInput
): Promise<KnowledgeWithMeta> {
  if (input.projectId) {
    const project = await getProjectById(client, userId, input.projectId);
    if (!project) {
      throw new Error("project not found");
    }
  }

  const { data, error } = await client
    .from("knowledge")
    .insert({
      user_id: userId,
      project_id: input.projectId,
      type: input.type,
      title: input.title,
      content: input.content,
      summary: input.summary ?? null,
      source: input.source ?? null,
      importance: input.importance,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (input.tags && input.tags.length > 0) {
    await setKnowledgeTags(client, userId, data.id, input.tags);
  }

  return loadMeta(client, userId, mapKnowledge(data));
}

export async function updateKnowledge(
  client: SupabaseClient<Database>,
  userId: string,
  id: string,
  patch: UpdateKnowledgePatch
): Promise<KnowledgeWithMeta | null> {
  const existing = await getKnowledge(client, userId, id);
  if (!existing) {
    return null;
  }

  if (patch.projectId !== undefined && patch.projectId !== null) {
    const project = await getProjectById(client, userId, patch.projectId);
    if (!project) {
      throw new Error("project not found");
    }
  }

  const update: Database["public"]["Tables"]["knowledge"]["Update"] = {
    type: patch.type,
    title: patch.title,
    content: patch.content,
    summary: patch.summary,
    importance: patch.importance,
    project_id: patch.projectId,
  };

  const { data, error } = await client
    .from("knowledge")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (patch.tags !== undefined) {
    await setKnowledgeTags(client, userId, id, patch.tags);
  }

  return loadMeta(client, userId, mapKnowledge(data));
}

export async function deleteKnowledge(
  client: SupabaseClient<Database>,
  userId: string,
  id: string
): Promise<boolean> {
  const existing = await getKnowledge(client, userId, id);
  if (!existing) {
    return false;
  }
  const { error } = await client.from("knowledge").delete().eq("id", id);
  if (error) {
    throw error;
  }
  return true;
}

export async function getKnowledgeByIds(
  client: SupabaseClient<Database>,
  userId: string,
  ids: string[]
): Promise<KnowledgeWithMeta[]> {
  if (ids.length === 0) {
    return [];
  }
  const { data, error } = await client
    .from("knowledge")
    .select("*")
    .eq("user_id", userId)
    .in("id", ids);

  if (error) {
    throw error;
  }
  return loadMetaBatch(client, userId, (data ?? []).map(mapKnowledge));
}

export async function searchKeyword(
  client: SupabaseClient<Database>,
  userId: string,
  query: string,
  options: { limit: number; filters?: SearchFilters; tags?: string[] }
): Promise<KeywordHit[]> {
  const { data, error } = await client.rpc("search_knowledge_keyword", {
    search_query: query,
    owner: userId,
    max_count: options.limit,
    filter_type: options.filters?.type ?? null,
    filter_project: options.filters?.projectId ?? null,
    filter_tags: options.tags ?? null,
  });

  if (error) {
    throw error;
  }

  const hits = data ?? [];
  if (hits.length === 0) {
    return [];
  }

  const rows = await fetchByIds(client, userId, hits.map((hit) => hit.knowledge_id));
  return hits
    .map((hit) => {
      const knowledge = rows.get(hit.knowledge_id);
      return knowledge ? { knowledge, keywordScore: hit.keyword_score } : null;
    })
    .filter((hit): hit is KeywordHit => hit !== null);
}

export async function semanticSearch(
  client: SupabaseClient<Database>,
  userId: string,
  queryEmbedding: number[],
  options: { limit: number; filters?: SearchFilters }
): Promise<VectorHit[]> {
  const { data, error } = await client.rpc("match_knowledge", {
    query_embedding: vectorToString(queryEmbedding),
    match_count: options.limit,
    owner: userId,
    filter_type: options.filters?.type ?? null,
    filter_project: options.filters?.projectId ?? null,
  });

  if (error) {
    throw error;
  }

  const hits = data ?? [];
  if (hits.length === 0) {
    return [];
  }

  const rows = await fetchByIds(client, userId, hits.map((hit) => hit.knowledge_id));
  return hits
    .map((hit) => {
      const knowledge = rows.get(hit.knowledge_id);
      return knowledge ? { knowledge, vectorScore: hit.vector_score } : null;
    })
    .filter((hit): hit is VectorHit => hit !== null);
}

async function fetchByIds(
  client: SupabaseClient<Database>,
  userId: string,
  ids: string[]
): Promise<Map<string, Knowledge>> {
  if (ids.length === 0) {
    return new Map();
  }
  const { data, error } = await client
    .from("knowledge")
    .select("*")
    .eq("user_id", userId)
    .in("id", ids);

  if (error) {
    throw error;
  }
  return new Map((data ?? []).map((row) => [row.id, mapKnowledge(row)]));
}
