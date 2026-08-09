import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { normalizeTagName } from "./util";

export interface TagRef {
  id: string;
  name: string;
}

export async function ensureTags(
  client: SupabaseClient<Database>,
  userId: string,
  names: string[]
): Promise<TagRef[]> {
  const unique = [...new Set(names.map(normalizeTagName).filter(Boolean))];
  if (unique.length === 0) {
    return [];
  }

  const { data: existing, error } = await client
    .from("tags")
    .select("id, name")
    .eq("user_id", userId)
    .in("name", unique);

  if (error) {
    throw error;
  }

  const existingByName = new Map((existing ?? []).map((t) => [t.name, t]));
  const missing = unique.filter((name) => !existingByName.has(name));

  let created: { id: string; name: string }[] = [];
  if (missing.length > 0) {
    const { data, error: insertError } = await client
      .from("tags")
      .insert(missing.map((name) => ({ user_id: userId, name })))
      .select("id, name");
    if (insertError) {
      throw insertError;
    }
    created = data ?? [];
  }

  return [...created, ...(existing ?? [])];
}

export async function getTagsForKnowledge(
  client: SupabaseClient<Database>,
  _userId: string,
  knowledgeId: string
): Promise<string[]> {
  const { data, error } = await client
    .from("knowledge_tags")
    .select("tags(name)")
    .eq("knowledge_id", knowledgeId);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => row.tags)
    .filter((tags): tags is { name: string } => tags !== null)
    .map((tags) => tags.name)
    .sort();
}

export async function getTagsForKnowledgeBatch(
  client: SupabaseClient<Database>,
  _userId: string,
  knowledgeIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (knowledgeIds.length === 0) {
    return result;
  }

  const { data, error } = await client
    .from("knowledge_tags")
    .select("knowledge_id, tags(name)")
    .in("knowledge_id", knowledgeIds);

  if (error) {
    throw error;
  }

  for (const row of data ?? []) {
    const list = result.get(row.knowledge_id) ?? [];
    if (row.tags) {
      list.push(row.tags.name);
    }
    result.set(row.knowledge_id, list);
  }
  return result;
}

export async function setKnowledgeTags(
  client: SupabaseClient<Database>,
  userId: string,
  knowledgeId: string,
  names: string[]
): Promise<string[]> {
  const tags = await ensureTags(client, userId, names);

  const { error: deleteError } = await client
    .from("knowledge_tags")
    .delete()
    .eq("knowledge_id", knowledgeId);

  if (deleteError) {
    throw deleteError;
  }

  if (tags.length > 0) {
    const { error: insertError } = await client.from("knowledge_tags").insert(
      tags.map((tag) => ({ knowledge_id: knowledgeId, tag_id: tag.id }))
    );
    if (insertError) {
      throw insertError;
    }
  }

  return tags.map((tag) => tag.name).sort();
}
