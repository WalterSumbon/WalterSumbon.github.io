-- 事务内验证远程成绩规则，结束时回滚，不留下测试用户或成绩。
begin;
insert into auth.users(id, raw_user_meta_data)
values ('f4d4c068-10e6-4ca4-b73d-c93a983bf711', '{"user_name":"transaction_test"}');
select set_config('request.jwt.claim.sub','f4d4c068-10e6-4ca4-b73d-c93a983bf711',true);
set local role authenticated;
select public.submit_score('G001','1.0.0','1',2);
select public.submit_score('G001','1.0.0','1',1);
select public.submit_score('G003','1.0.0','1',3);
do $$
begin
  if (select score from public.get_ranking('G001') where user_id=auth.uid()) is distinct from 2::numeric then
    raise exception '个人最高分验证失败';
  end if;
  if (select score from public.get_ranking(null) where user_id=auth.uid()) is distinct from 5::numeric then
    raise exception '总榜折算验证失败';
  end if;
  if has_table_privilege('authenticated','public.game_scores','INSERT') then
    raise exception '前端不应拥有直接插入权限';
  end if;
end;
$$;
rollback;
