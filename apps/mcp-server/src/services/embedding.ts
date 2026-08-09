import { createEmbeddingProvider, type EmbeddingProvider } from "@pam/database";
import type { Config } from "../config.js";

export function getEmbeddingProvider(config: Config): EmbeddingProvider | null {
  if (!config.OPENAI_API_KEY) {
    return null;
  }
  return createEmbeddingProvider({
    OPENAI_API_KEY: config.OPENAI_API_KEY,
    EMBEDDING_MODEL: config.EMBEDDING_MODEL,
  });
}
