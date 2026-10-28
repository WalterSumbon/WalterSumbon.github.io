import { readFile } from "node:fs/promises";
/** 直接输出可粘贴到 Supabase 的 SQL，游戏系数只从游戏目录读取。 */
const games = JSON.parse(
  await readFile(new URL("../content/games.json", import.meta.url), "utf8"),
);
const quote = (s) => "'" + String(s).replaceAll("'", "''") + "'";
if (!process.argv.includes("--rules-only"))
  console.log(
    await readFile(new URL("../services/schema.sql", import.meta.url), "utf8"),
  );
for (const g of games) {
  if (!Number.isFinite(g.coefficient) || g.coefficient < 0)
    throw new Error("游戏系数无效");
  console.log(
    `insert into public.game_rules (id,score_version,coefficient) values (${quote(g.id)},${quote(g.scoreVersion)},${g.coefficient}) on conflict (id) do update set score_version=excluded.score_version, coefficient=excluded.coefficient;`,
  );
}
