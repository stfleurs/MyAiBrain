import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_EMBEDDING_MODEL } from "@pam/shared";
import type { Database } from "./types";
import { getKnowledge } from "./knowledge";
import { parseVector, vectorToString } from "./util";

export interface EmbeddingProvider {
  readonly model: string;
  embed(text: string): Promise<number[]>;
}

export async function getEmbedding(
  client: SupabaseClient<Database>,
  userId: string,
  knowledgeId: string
): Promise<{ vector: number[]; model: string } | null> {
  const knowledge = await getKnowledge(client, userId, knowledgeId);
  if (!knowledge) {
    return null;
  }

  const { data, error } = await client
    .from("knowledge_embeddings")
    .select("embedding, model")
    .eq("knowledge_id", knowledgeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  const vector = parseVector(data?.embedding ?? null);
  if (!data || !vector) {
    return null;
  }
  return { vector, model: data.model };
}

export async function upsertEmbedding(
  client: SupabaseClient<Database>,
  userId: string,
  knowledgeId: string,
  vector: number[],
  model: string
): Promise<void> {
  const knowledge = await getKnowledge(client, userId, knowledgeId);
  if (!knowledge) {
    throw new Error("knowledge not found");
  }

  const { error } = await client.from("knowledge_embeddings").upsert(
    {
      knowledge_id: knowledgeId,
      embedding: vectorToString(vector),
      model,
    },
    { onConflict: "knowledge_id,model" }
  );

  if (error) {
    throw error;
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly openai: OpenAI,
    readonly model: string = DEFAULT_EMBEDDING_MODEL
  ) {}

  async embed(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: text,
      dimensions: 1536,
    });
    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error("embedding API returned no data");
    }
    return embedding;
  }
}

export function createEmbeddingProvider(
  env: NodeJS.ProcessEnv = process.env
): EmbeddingProvider {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY must be set to generate embeddings");
  }
  return new OpenAIEmbeddingProvider(
    new OpenAI({ apiKey }),
    env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL
  );
}
