import { readFile } from "node:fs/promises";
/** 从公开 GitHub 快照生成可重复执行的迁移 SQL，原始 URL 用于去重。 */
const rows = JSON.parse(
  await readFile(
    new URL("../services/migrations/github-comments.json", import.meta.url),
    "utf8",
  ),
);
const posts = {
  1: "戴森球计划中生产供应的计算",
  2: "《戴森球计划》串联分馏塔的氘生产速率",
  3: "Hadoop安装指南",
};
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
console.log("begin;");
for (const r of rows) {
  if (
    !posts[r.issue] ||
    !r.author ||
    !r.body ||
    !r.url.startsWith(
      "https://github.com/WalterSumbon/WalterSumbon.github.io/issues/",
    ) ||
    !Number.isFinite(Date.parse(r.created_at))
  )
    throw new Error("旧评论格式无效");
  const thread = "post:" + posts[r.issue];
  console.log(
    `insert into public.comment_threads(id) values(${quote(thread)}) on conflict do nothing;`,
  );
  console.log(
    `insert into public.site_comments(thread_id,author,body,created_at,updated_at,source_url) values(${[thread, r.author, r.body, r.created_at, r.updated_at, r.url].map(quote).join(",")}) on conflict(source_url) do nothing;`,
  );
}
console.log("commit;");
