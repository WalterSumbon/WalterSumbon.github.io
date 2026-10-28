begin;
insert into auth.users(id,raw_user_meta_data) values('f4d4c068-10e6-4ca4-b73d-c93a983bf711','{"user_name":"comment_test"}');
insert into auth.identities(id,user_id,provider_id,provider,identity_data) values(gen_random_uuid(),'f4d4c068-10e6-4ca4-b73d-c93a983bf711','comment_test','github','{"user_name":"comment_test","sub":"comment_test"}');
select set_config('request.jwt.claim.sub','f4d4c068-10e6-4ca4-b73d-c93a983bf711',true);
set local role authenticated;
do $$
declare root uuid; child uuid; rejected boolean:=false;
begin
 root:=public.write_comment('post:transaction-test','根评论');
 child:=public.write_comment('post:transaction-test','回复',root);
 perform public.vote('post:transaction-test',1,root);
 perform public.vote('post:transaction-test',-1,root);
 if (select upvotes from public.read_comments('post:transaction-test') where id=root)<>0 or (select downvotes from public.read_comments('post:transaction-test') where id=root)<>1 then raise exception '投票切换失败'; end if;
 perform public.vote('post:transaction-test',0,root);
 if (select downvotes from public.read_comments('post:transaction-test') where id=root)<>0 then raise exception '取消投票失败'; end if;
 begin
  perform public.write_comment('post:other-thread','错误跨页回复',root);
 exception when others then rejected:=true;
 end;
 if not rejected then raise exception '跨页回复应被拒绝'; end if;
 perform public.write_comment('post:transaction-test','编辑',null,root);
 if (select body from public.read_comments('post:transaction-test') where id=root)<>'编辑' then raise exception '编辑失败'; end if;
 perform public.write_comment('post:transaction-test','',null,root,true);
 if not (select deleted from public.read_comments('post:transaction-test') where id=root) or (select count(*) from public.read_comments('post:transaction-test'))<>2 then raise exception '删除父评论破坏回复'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 rejected:=false;
 begin
  perform public.write_comment('post:transaction-test','匿名评论');
 exception when others then rejected:=true;
 end;
 if not rejected then raise exception '匿名写入应被拒绝'; end if;
 if has_table_privilege('authenticated','public.site_comments','UPDATE') then raise exception '直接写表权限错误'; end if;
end; $$;
rollback;
