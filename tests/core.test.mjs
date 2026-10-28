import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as yaml from "js-yaml";
import katex from "katex";
import { parsePost, compileMarkdown } from "../src/content.js";
import {
  winner,
  chooseMove,
  validateBoard,
  gameScore,
} from "../src/games/gomoku-logic.js";
import { initialState, step, collides } from "../src/games/flappy-logic.js";
import { validateState, mergeScore } from "../src/games/watermelon-logic.js";
globalThis.jsyaml = yaml;
globalThis.katex = katex;
test("恢复的文章保留 39 个代码块和 LC-3 上标", async () => {
  const files = JSON.parse(
    await readFile(new URL("../content/index.json", import.meta.url)),
  );
  let blocks = 0;
  for (const f of files) {
    const p = parsePost(
      await readFile(new URL("../content/posts/" + f, import.meta.url), "utf8"),
      f,
    );
    blocks += (compileMarkdown(p.body).match(/<pre>/g) || []).length;
    if (f.startsWith("使用FPGA")) {
      const html = compileMarkdown(p.body);
      assert.match(html, /<sup>10<\/sup>/);
      assert.match(html, /x0302\(before\)\.jpg/);
      assert.match(html, /x0302\(after\)\.jpg/);
    }
  }
  assert.equal(blocks, 39);
});
test("公式正确解析，下划线不会变成斜体，代码示例不执行公式", () => {
  const html = compileMarkdown(
    '公式 \\(v_{i+1}\\)\n\n\\[\nx^2\n\\]\n\n```sh\necho "$HOME"\n```\n\n`\\(raw\\)`',
  );
  assert.match(html, /class="katex"/);
  assert.match(html, /katex-display/);
  assert.match(html, /echo &quot;\$HOME&quot;/);
  assert.match(html, /<code>\\\(raw\\\)<\/code>/);
  assert.throws(() => compileMarkdown("\\(\\notacommand{x}\\)"));
});
test("缺失文章元数据明确报错", () => {
  assert.throws(() => parsePost("正文", "missing.md"), /文件头/);
  assert.throws(() => parsePost("---\nid: test\n---\n正文", "bad.md"), /title/);
});
test("五子棋判定横向和斜向五连，AI 优先取胜并封堵", () => {
  const b = Array(225).fill(0);
  [108, 109, 110, 111].forEach((i) => (b[i] = 2));
  const i = chooseMove(b);
  b[i] = 2;
  assert.equal(winner(b, i), 2);
  const c = Array(225).fill(0);
  c[105] = 2;
  [106, 107, 108, 109].forEach((i) => (c[i] = 1));
  assert.equal(chooseMove(c), 110);
  const d = Array(225).fill(0);
  [0, 16, 32, 48, 64].forEach((i) => (d[i] = 1));
  assert.equal(winner(d, 64), 1);
  assert.equal(gameScore(d, 1), 995);
});
test("AI 不修改输入棋盘，存档校验拒绝非法棋局", () => {
  const b = Array(225).fill(0);
  b[112] = 1;
  const before = [...b];
  const m = chooseMove(b);
  assert.equal(b[m], 0);
  assert.deepEqual(b, before);
  assert.throws(() => validateBoard({ board: [1], turn: 1, over: false }));
  const c = Array(225).fill(0);
  c[0] = 2;
  assert.throws(() => validateBoard({ board: c, turn: 1, over: false }));
});
test("纸翼计分只发生一次，边界与障碍碰撞结束游戏", () => {
  const s = initialState();
  s.pipes = [{ x: 31, gap: 270, passed: false }];
  step(s, 0.01, () => 0.5);
  assert.equal(s.score, 1);
  step(s, 0.01, () => 0.5);
  assert.equal(s.score, 1);
  s.y = 550;
  assert.equal(collides(s), true);
  const t = initialState();
  t.pipes = [{ x: 95, gap: 100, passed: false }];
  step(t, 0.01);
  assert.equal(t.over, true);
});
test("西瓜合并计分与存档字段校验", () => {
  assert.equal(mergeScore(1), 4);
  validateState({
    score: 4,
    next: 1,
    over: false,
    fruits: [
      {
        level: 1,
        x: 100,
        y: 200,
        vx: 0,
        vy: 0,
        angle: 0,
        angularVelocity: 0,
        age: 500,
      },
    ],
  });
  assert.throws(() =>
    validateState({ score: 0, next: 0, over: false, fruits: [{ level: 20 }] }),
  );
});
