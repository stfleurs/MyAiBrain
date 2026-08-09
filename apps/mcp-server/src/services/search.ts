import type { KnowledgeType, SearchResult } from "@pam/shared";
import { HYBRID_SEARCH_WEIGHTS } from "@pam/shared";
import {
  getKnowledgeByIds,
  getProjectBySlug,
  normalizeTagName,
  searchKeyword,
  semanticSearch,
  type SearchFilters,
} from "@pam/database";
import type { ToolContext } from "../context.js";

export interface HybridSearchOptions {
  query: string;
  limit: number;
  projectSlug?: string;
  type?: KnowledgeType;
  tags?: string[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export async function hybridSearch(
  ctx: ToolContext,
  options: HybridSearchOptions
): Promise<SearchResult[]> {
  const { client, userId } = ctx;

  const projectId = options.projectSlug
    ? (await getProjectBySlug(client, userId, options.projectSlug))?.id
    : undefined;
  const filters: SearchFilters = { type: options.type, projectId };
  const fetchLimit = Math.min(Math.max(options.limit * 3, options.limit), 50);

  const keywordHits = await searchKeyword(client, userId, options.query, {
    limit: fetchLimit,
    filters,
    tags: options.tags,
  });

  let vectorHits: Awaited<ReturnType<typeof semanticSearch>> = [];
  if (ctx.embeddingProvider) {
    const embedding = await ctx.embeddingProvider.embed(options.query);
    vectorHits = await semanticSearch(client, userId, embedding, { limit: fetchLimit, filters });
  }

  const ids = new Set<string>();
  for (const hit of keywordHits) {
    ids.add(hit.knowledge.id);
  }
  for (const hit of vectorHits) {
    ids.add(hit.knowledge.id);
  }
  if (ids.size === 0) {
    return [];
  }

  const rows = await getKnowledgeByIds(client, userId, [...ids]);
  const byId = new Map(rows.map((row) => [row.id, row]));

  const maxKeyword = Math.max(0, ...keywordHits.map((hit) => hit.keywordScore));
  const scores = new Map<string, { keywordScore: number; vectorScore: number }>();
  for (const hit of keywordHits) {
    scores.set(hit.knowledge.id, {
      keywordScore: maxKeyword > 0 ? hit.keywordScore / maxKeyword : 0,
      vectorScore: 0,
    });
  }
  for (const hit of vectorHits) {
    const entry = scores.get(hit.knowledge.id);
    const vectorScore = clamp01(hit.vectorScore);
    if (entry) {
      entry.vectorScore = vectorScore;
    } else {
      scores.set(hit.knowledge.id, { keywordScore: 0, vectorScore });
    }
  }

  const results: SearchResult[] = [];
  for (const [id, score] of scores) {
    const knowledge = byId.get(id);
    if (!knowledge) {
      continue;
    }
    if (options.tags && options.tags.length > 0) {
      const wanted = new Set(options.tags.map(normalizeTagName));
      const actual = new Set(knowledge.tags.map(normalizeTagName));
      if (![...wanted].every((tag) => actual.has(tag))) {
        continue;
      }
    }
    results.push({
      knowledge,
      keywordScore: score.keywordScore,
      vectorScore: score.vectorScore,
      score:
        HYBRID_SEARCH_WEIGHTS.keyword * score.keywordScore +
        HYBRID_SEARCH_WEIGHTS.vector * score.vectorScore,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, options.limit);
}
