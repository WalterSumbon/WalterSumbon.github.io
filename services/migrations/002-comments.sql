begin;
create table public.comment_threads (id text primary key);
create table public.site_comments (
 id uuid primary key default gen_random_uuid(), thread_id text not null references public.comment_threads(id),
 parent_id uuid, user_id uuid references auth.users(id) on delete set null,
 author text not null, body text not null check(length(body)<=20000), deleted boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 source_url text unique, unique(id,thread_id),
 foreign key(parent_id,thread_id) references public.site_comments(id,thread_id)
);
create index site_comments_thread_time on public.site_comments(thread_id,created_at);
create table public.site_votes (
 user_id uuid not null references auth.users(id) on delete cascade,
 thread_id text not null references public.comment_threads(id),
 comment_id uuid, target text generated always as (coalesce(comment_id::text,thread_id)) stored,
 value smallint not null check(value in (-1,1)), primary key(user_id,target),
 foreign key(comment_id,thread_id) references public.site_comments(id,thread_id)
);
alter table public.comment_threads enable row level security;
alter table public.site_comments enable row level security;
alter table public.site_votes enable row level security;
revoke all on public.comment_threads,public.site_comments,public.site_votes from anon,authenticated;
-- 所有用户写入由会话决定身份；迁入评论保留原作者，不冒充新登录用户。
create function public.write_comment(p_thread text,p_body text,p_parent uuid default null,p_id uuid default null,p_delete boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result uuid; login text;
begin
 if uid is null then raise exception '请先登录'; end if;
 if p_thread is null or p_thread !~ '^(post:.{1,200}|game:G[0-9]{3})$' then raise exception '无效页面'; end if;
 insert into public.comment_threads(id) values(p_thread) on conflict do nothing;
 if not p_delete and (p_body is null or length(trim(p_body))=0 or length(p_body)>20000) then raise exception '评论须为 1–20000 字'; end if;
 if p_id is null then
  if p_delete then raise exception '缺少评论编号'; end if;
  select i.identity_data->>'user_name' into login from auth.identities i where i.user_id=uid and i.provider='github';
  if login is null then raise exception '请使用 GitHub 登录'; end if;
  if p_parent is not null and not exists(select 1 from public.site_comments c where c.id=p_parent and c.thread_id=p_thread) then raise exception '回复目标不存在'; end if;
  insert into public.site_comments(thread_id,parent_id,user_id,author,body) values(p_thread,p_parent,uid,login,p_body) returning id into result;
 else
  update public.site_comments c set body=case when p_delete then '' else p_body end,deleted=p_delete,updated_at=now()
   where c.id=p_id and c.thread_id=p_thread and c.user_id=uid and not c.deleted returning c.id into result;
  if result is null then raise exception '只能修改自己的有效评论'; end if;
 end if;
 return result;
end; $$;
create function public.vote(p_thread text,p_value integer,p_comment uuid default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception '请先登录'; end if;
 if p_thread is null or p_thread !~ '^(post:.{1,200}|game:G[0-9]{3})$' then raise exception '无效页面'; end if;
 insert into public.comment_threads(id) values(p_thread) on conflict do nothing;
 if p_value is null or p_value not in (-1,0,1) then raise exception '无效投票'; end if;
 if not exists(select 1 from public.comment_threads where id=p_thread) then raise exception '页面不存在'; end if;
 if p_comment is not null and not exists(select 1 from public.site_comments where id=p_comment and thread_id=p_thread and not deleted) then raise exception '评论不存在'; end if;
 if p_value=0 then
  delete from public.site_votes where user_id=auth.uid() and target=coalesce(p_comment::text,p_thread);
 else
  insert into public.site_votes(user_id,thread_id,comment_id,value) values(auth.uid(),p_thread,p_comment,p_value)
  on conflict(user_id,target) do update set value=excluded.value;
 end if;
end; $$;
create function public.read_comments(p_thread text)
returns table(id uuid,parent_id uuid,author text,body text,deleted boolean,created_at timestamptz,updated_at timestamptz,source_url text,mine boolean,upvotes bigint,downvotes bigint,my_vote integer)
language sql stable security definer set search_path='' as $$
 select c.id,c.parent_id,c.author,c.body,c.deleted,c.created_at,c.updated_at,c.source_url,
 coalesce(c.user_id=auth.uid(),false),count(v.user_id) filter(where v.value=1),count(v.user_id) filter(where v.value=-1),
 coalesce(max(v.value) filter(where v.user_id=auth.uid()),0)::integer
 from public.site_comments c left join public.site_votes v on v.comment_id=c.id
 where c.thread_id=p_thread group by c.id order by c.created_at,c.id;
$$;
create function public.read_page_votes(p_thread text)
returns table(upvotes bigint,downvotes bigint,my_vote integer)
language sql stable security definer set search_path='' as $$
 select count(*) filter(where value=1),count(*) filter(where value=-1),coalesce(max(value) filter(where user_id=auth.uid()),0)::integer
 from public.site_votes where thread_id=p_thread and comment_id is null;
$$;
revoke all on function public.write_comment(text,text,uuid,uuid,boolean),public.vote(text,integer,uuid),public.read_comments(text),public.read_page_votes(text) from public;
grant execute on function public.write_comment(text,text,uuid,uuid,boolean),public.vote(text,integer,uuid) to authenticated;
grant execute on function public.read_comments(text),public.read_page_votes(text) to anon,authenticated;
commit;
