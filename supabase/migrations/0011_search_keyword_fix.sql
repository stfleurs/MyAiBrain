-- Fix: ts_rank() returns `real` but the function declares `double precision`;
-- Postgres only rejects the mismatch at call time.
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
         ts_rank(k.search_tsv, q)::double precision as keyword_score
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
