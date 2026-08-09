"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { KNOWLEDGE_TYPES, type KnowledgeImportance, type KnowledgeType } from "@pam/shared";
import {
  buildEmbeddingText,
  createEmbeddingProvider,
  createKnowledge,
  createProject,
  deleteKnowledge,
  getProjectBySlug,
  updateKnowledge,
  upsertEmbedding,
} from "@pam/database";
import { createClient, getUser } from "@/lib/supabase/server";
import { parseImportance, parseOptionalString, parseTags } from "@/lib/forms";

export interface KnowledgeFormState {
  error?: string;
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const formSchema = z.object({
  type: z.enum(KNOWLEDGE_TYPES),
  title: z.string().trim().min(1, "title is required").max(300),
  content: z.string().trim().min(1, "content is required").max(100_000),
  summary: z.string().trim().max(2000).or(z.literal("")),
});

interface ParsedForm {
  type: KnowledgeType;
  title: string;
  content: string;
  summary: string | null;
  project: string | null;
  tags: string[];
  importance: KnowledgeImportance;
}

function parseForm(formData: FormData): ParsedForm {
  const parsed = formSchema.parse({
    type: formData.get("type"),
    title: formData.get("title"),
    content: formData.get("content"),
    summary: parseOptionalString(formData.get("summary")) ?? "",
  });

  const project =
    parseOptionalString(formData.get("newProject")) ??
    parseOptionalString(formData.get("projectSlug"));
  if (project && project !== "none" && !/^[a-z0-9-]+$/.test(project)) {
    throw new Error("project must be a slug or a plain name");
  }

  return {
    type: parsed.type,
    title: parsed.title,
    content: parsed.content,
    summary: parsed.summary === "" ? null : parsed.summary,
    project: project === "none" ? null : project,
    tags: parseTags(String(formData.get("tags") ?? "")),
    importance: parseImportance(formData.get("importance")),
  };
}

async function requireSession() {
  const client = await createClient();
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }
  return { client, userId: user.id };
}

async function resolveProjectId(
  client: ServerClient,
  userId: string,
  project: string | null
): Promise<string | null> {
  if (!project) {
    return null;
  }
  const existing = await getProjectBySlug(client, userId, project);
  if (existing) {
    return existing.id;
  }
  const created = await createProject(client, userId, { name: project });
  return created.id;
}

async function embedBestEffort(
  client: ServerClient,
  userId: string,
  knowledgeId: string,
  input: { title: string; summary: string | null; content: string }
) {
  if (!process.env.OPENAI_API_KEY) {
    return;
  }
  try {
    const provider = createEmbeddingProvider(process.env);
    const vector = await provider.embed(buildEmbeddingText(input));
    await upsertEmbedding(client, userId, knowledgeId, vector, provider.model);
  } catch (error) {
    console.error("failed to embed knowledge", knowledgeId, error);
  }
}

function toFormError(error: unknown): KnowledgeFormState {
  if (error instanceof z.ZodError) {
    return { error: error.issues[0]?.message ?? "invalid input" };
  }
  if (error instanceof Error) {
    return { error: error.message };
  }
  return { error: "unexpected error" };
}

export async function createKnowledgeAction(
  _prevState: KnowledgeFormState,
  formData: FormData
): Promise<KnowledgeFormState> {
  const { client, userId } = await requireSession();
  let knowledgeId: string | null = null;
  let projectSlug: string | null = null;

  try {
    const input = parseForm(formData);
    const projectId = await resolveProjectId(client, userId, input.project);
    const knowledge = await createKnowledge(client, userId, {
      type: input.type,
      title: input.title,
      content: input.content,
      summary: input.summary,
      importance: input.importance,
      projectId,
      tags: input.tags,
      source: "web",
    });
    knowledgeId = knowledge.id;
    projectSlug = input.project;
    await embedBestEffort(client, userId, knowledge.id, {
      title: input.title,
      summary: input.summary,
      content: input.content,
    });
  } catch (error) {
    return toFormError(error);
  }

  revalidatePath("/");
  if (projectSlug) {
    revalidatePath(`/projects/${projectSlug}`);
  }
  redirect(`/knowledge/${knowledgeId}`);
}

export async function updateKnowledgeAction(
  _prevState: KnowledgeFormState,
  formData: FormData
): Promise<KnowledgeFormState> {
  const knowledgeId = String(formData.get("knowledgeId") ?? "");
  const { client, userId } = await requireSession();
  let projectSlug: string | null = null;

  try {
    const input = parseForm(formData);
    const projectId = await resolveProjectId(client, userId, input.project);
    const updated = await updateKnowledge(client, userId, knowledgeId, {
      type: input.type,
      title: input.title,
      content: input.content,
      summary: input.summary,
      importance: input.importance,
      projectId,
      tags: input.tags,
    });
    if (!updated) {
      return { error: "knowledge not found" };
    }
    projectSlug = input.project;
    await embedBestEffort(client, userId, knowledgeId, {
      title: input.title,
      summary: input.summary,
      content: input.content,
    });
  } catch (error) {
    return toFormError(error);
  }

  revalidatePath("/");
  if (projectSlug) {
    revalidatePath(`/projects/${projectSlug}`);
  }
  redirect(`/knowledge/${knowledgeId}`);
}

export async function deleteKnowledgeAction(formData: FormData): Promise<void> {
  const knowledgeId = String(formData.get("knowledgeId") ?? "");
  const { client, userId } = await requireSession();
  await deleteKnowledge(client, userId, knowledgeId);
  revalidatePath("/");
  redirect("/");
}
