-- Generated tsvector column for keyword search.
alter table public.knowledge
  add column search_tsv tsvector generated always as (
    to_tsvector('english', title || ' ' || coalesce(summary, '') || ' ' || content)
  ) stored;

drop index public.knowledge_search_idx;
create index knowledge_search_tsv_idx on public.knowledge using gin (search_tsv);

-- HNSW works well with small datasets and requires no tuning (unlike ivfflat).
drop index public.knowledge_embeddings_embedding_idx;
create index knowledge_embeddings_embedding_idx
  on public.knowledge_embeddings
  using hnsw (embedding vector_cosine_ops);

-- Keyword search. All requested tags must be present (ALL semantics).
create or replace function public.search_knowledge_keyword(
  search_query text,
  owner uuid,
  max_count integer default 10,
  filter_type text default null,
  filter_project uuid default null,
  filter_tags text[] default null
)
returns table (knowledge_id uuid, keyword_score double precision)
language plpgsql
as $$
declare
  q tsquery;
begin
  begin
    q := websearch_to_tsquery('english', search_query);
  exception when others then
    q := plainto_tsquery('english', search_query);
  end;
  return query
  select k.id as knowledge_id,
         ts_rank(k.search_tsv, q) as keyword_score
  from public.knowledge k
  where k.user_id = owner
    and (q is null or q = '' or k.search_tsv @@ q)
    and (filter_type is null or k.type = filter_type)
    and (filter_project is null or k.project_id = filter_project)
    and (
      filter_tags is null
      or (
        select count(distinct t.name)
        from public.knowledge_tags kt
        join public.tags t on t.id = kt.tag_id
        where kt.knowledge_id = k.id and t.name = any(filter_tags)
      ) = cardinality(filter_tags)
    )
  order by keyword_score desc
  limit max_count;
end $$;

-- Vector similarity search. Owner defaults to the calling user for the
-- authenticated path; the service role must pass the owner explicitly.
create or replace function public.match_knowledge(
  query_embedding vector(1536),
  match_count integer default 10,
  owner uuid default auth.uid(),
  filter_type text default null,
  filter_project uuid default null
)
returns table (knowledge_id uuid, vector_score double precision)
language plpgsql
as $$
begin
  return query
  select ke.knowledge_id, 1 - (ke.embedding <=> query_embedding) as vector_score
  from public.knowledge_embeddings ke
  join public.knowledge k on k.id = ke.knowledge_id
  where k.user_id = owner
    and (filter_type is null or k.type = filter_type)
    and (filter_project is null or k.project_id = filter_project)
  order by ke.embedding <=> query_embedding
  limit match_count;
end $$;

grant execute on function public.search_knowledge_keyword(text, uuid, integer, text, uuid, text[]) to anon, authenticated, service_role;
grant execute on function public.match_knowledge(vector, integer, uuid, text, uuid) to anon, authenticated, service_role;
