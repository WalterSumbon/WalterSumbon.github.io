-- 在 Supabase SQL Editor 中执行。唯一写入口 submit_score 从当前登录会话取得用户 ID。
create table public.game_rules (
  id text primary key,
  score_version text not null,
  coefficient numeric not null check (coefficient >= 0)
);
-- 游戏规则由 scripts/service-sql.mjs 从 content/games.json 生成。
create table public.game_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null references public.game_rules(id),
  score_version text not null,
  game_version text not null,
  score bigint not null check (score >= 0 and score <= 9007199254740991),
  username text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id, score_version)
);
alter table public.game_rules enable row level security;
alter table public.game_scores enable row level security;
-- 表不直接对前端开放；读取和写入均使用受限函数。
revoke all on public.game_rules, public.game_scores from anon, authenticated;
create function public.submit_score(game_id text, game_version text, score_version text, new_score bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  username text;
  active_version text;
begin
  if uid is null then raise exception '请先登录'; end if;
  select u.raw_user_meta_data->>'user_name' into username from auth.users u where u.id = uid;
  if username is null then raise exception '需要 GitHub 登录'; end if;
  select r.score_version into active_version from public.game_rules r where r.id = submit_score.game_id;
  if active_version is null or active_version <> submit_score.score_version then raise exception '游戏不存在或计分版本不兼容'; end if;
  if new_score is null or new_score < 0 or new_score > 9007199254740991 then raise exception '成绩无效'; end if;
  if game_id = 'G002' and not (new_score in (0,100) or new_score between 887 and 995) then raise exception '五子棋成绩无效'; end if;
  if game_version is null or game_version !~ '^\d+\.\d+\.\d+$' then raise exception '游戏版本无效'; end if;
  insert into public.game_scores as old (user_id,game_id,score_version,game_version,score,username)
  values(uid,submit_score.game_id,submit_score.score_version,submit_score.game_version,new_score,username)
  on conflict on constraint game_scores_pkey do update
  set score = greatest(old.score,excluded.score),
      game_version = case when excluded.score > old.score then excluded.game_version else old.game_version end,
      username = excluded.username,
      updated_at = case when excluded.score > old.score then now() else old.updated_at end;
end;
$$;
create function public.get_ranking(requested_game text default null)
returns table(user_id uuid, username text, score numeric)
language sql stable security definer set search_path = '' as $$
  select s.user_id, max(s.username),
    sum(s.score * case when requested_game is null then r.coefficient else 1 end) as total
  from public.game_scores s join public.game_rules r on r.id=s.game_id and r.score_version=s.score_version
  where requested_game is null or s.game_id=requested_game
  group by s.user_id
  order by total desc, max(s.updated_at) asc, s.user_id
  limit 100;
$$;
revoke all on function public.submit_score(text,text,text,bigint) from public, anon;
grant execute on function public.submit_score(text,text,text,bigint) to authenticated;
revoke all on function public.get_ranking(text) from public;
grant execute on function public.get_ranking(text) to anon, authenticated;
