import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import * as yaml from "js-yaml";
import katex from "katex";
import { root, updateIndex } from "./index.mjs";
globalThis.jsyaml = yaml;
globalThis.katex = katex;
const { parsePost, compileMarkdown } = await import("../src/content.js");
const start = performance.now();
console.log("开始校验 Markdown、公式、图片、集合与游戏配置");
const files = await updateIndex(),
  ids = new Set();
for (const file of files) {
  const post = parsePost(
    await readFile(path.join(root, "content/posts", file), "utf8"),
    file,
  );
  if (ids.has(post.id)) throw new Error("重复文章编号：" + post.id);
  ids.add(post.id);
  const html = compileMarkdown(post.body);
  for (const [, src] of html.matchAll(/<img[^>]*src="([^"]+)"/g)) {
    if (!src.startsWith("/assets/"))
      throw new Error(file + " 的图片应放在 /assets/ 目录：" + src);
    await stat(path.join(root, decodeURIComponent(src)));
  }
  console.log("通过：" + post.title);
}
const games = JSON.parse(
    await readFile(path.join(root, "content/games.json"), "utf8"),
  ),
  gameIds = new Set();
for (const g of games) {
  if (!/^G\d{3}$/.test(g.id) || gameIds.has(g.id))
    throw new Error("游戏编号无效或重复");
  gameIds.add(g.id);
  for (const key of ["version", "saveVersion"])
    if (!/^\d+\.\d+\.\d+$/.test(g[key])) throw new Error(g.id + " 的版本无效");
  if (!Number.isFinite(g.coefficient) || g.coefficient < 0)
    throw new Error(g.id + " 的系数无效");
  if (!["image", "html"].includes(g.cover.type))
    throw new Error(g.id + " 的封面格式无效");
  await stat(path.join(root, g.cover.src.split("?")[0]));
  await stat(path.join(root, "src/games", g.module + ".js"));
}
const collections = JSON.parse(
    await readFile(path.join(root, "content/collections.json"), "utf8"),
  ),
  seen = new Set();
for (const c of collections) {
  if (seen.has(c.id)) throw new Error("集合编号重复");
  seen.add(c.id);
  if (!["posts", "games"].includes(c.type)) throw new Error("集合类型无效");
  if (new Set(c.items).size !== c.items.length)
    throw new Error("集合中有重复成员");
  for (const id of c.items)
    if (!(c.type === "posts" ? ids : gameIds).has(id))
      throw new Error(c.id + " 引用了不存在的成员 " + id);
}
console.log(
  `完成：${files.length} 篇文章、${games.length} 个游戏、${collections.length} 个集合，耗时 ${Math.round(performance.now() - start)} ms`,
);
