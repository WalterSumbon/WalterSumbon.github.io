import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  step,
  awardKill,
  weaponStats,
  chooseWeapon,
  blocked,
  MAPS,
  validateState,
  explode,
} from "../src/games/boxhead-logic.js";
test("全部地图的出生点可用，三种模式的存档均可恢复", () => {
  for (const m of MAPS)
    for (const mode of ["single", "coop", "versus"]) {
      const s = initialState({ map: m.id, mode });
      validateState(JSON.parse(JSON.stringify(s)));
      for (const p of s.players) assert.equal(blocked(s, p.x, p.y, p.r), false);
    }
});
test("连杀解锁与升级保留，倍率随时间下降", () => {
  const s = initialState({ map: "big" }),
    p = s.players[0];
  for (let i = 0; i < 18; i++) awardKill(s, p);
  chooseWeapon(s, p, 1);
  assert.equal(p.weapon, 1);
  assert.equal(p.ammo[1], 240);
  const peak = p.peak;
  step(s, 1 / 60);
  assert.ok(p.combo < 18);
  assert.equal(p.peak, peak);
  assert.ok(weaponStats(0, p.peak).damage > 24);
});
test("射击消耗弹药，空弹药退回无限手枪", () => {
  const s = initialState({ map: "big" }),
    p = s.players[0];
  p.peak = 5;
  p.weapon = 1;
  p.ammo[1] = 1;
  step(s, 1 / 60, [{ fire: true }]);
  assert.equal(p.ammo[1], 0);
  assert.equal(s.bullets.length, 1);
  p.cooldown = 0;
  step(s, 1 / 60, [{ fire: true }]);
  assert.equal(p.weapon, 0);
});
test("红箱恢复生命和已解锁武器弹药", () => {
  const s = initialState({ map: "big" }),
    p = s.players[0];
  p.peak = 10;
  p.ammo[1] = 0;
  p.hp = 50;
  s.boxes = [{ x: p.x, y: p.y, id: 99 }];
  step(s, 1 / 60);
  assert.equal(p.hp, 68);
  assert.ok(p.ammo[1] > 0);
  assert.equal(s.boxes.length, 0);
});
test("油桶连锁爆炸只结算一次，并造成自伤", () => {
  const s = initialState({ map: "big" }),
    p = s.players[0];
  s.objects = [
    {
      type: "barrel",
      x: p.x + 30,
      y: p.y,
      hp: 20,
      radius: 100,
      damage: 60,
      owner: 0,
    },
    {
      type: "barrel",
      x: p.x + 70,
      y: p.y,
      hp: 20,
      radius: 100,
      damage: 60,
      owner: 0,
    },
  ];
  explode(s, p.x + 20, p.y, 80, 40, 0);
  assert.ok(s.objects.every((o) => o.hp <= 0));
  assert.ok(p.hp < 100);
  assert.equal(s.effects.length, 3);
});
test("恶魔受击硬直期间不能发射火球", () => {
  const s = initialState({ map: "big" });
  s.enemies = [
    {
      id: 1,
      type: "devil",
      x: 600,
      y: 200,
      r: 18,
      hp: 200,
      speed: 35,
      stun: 0.3,
      cooldown: -1,
      dead: false,
    },
  ];
  step(s, 1 / 60);
  assert.equal(s.bullets.length, 0);
  s.enemies[0].stun = 0;
  step(s, 1 / 60);
  assert.equal(s.bullets[0].type, "fireball");
});
test("合作全灭结束，对战按十次击杀结束", () => {
  const coop = initialState({ mode: "coop" });
  coop.players.forEach((p) => (p.dead = true));
  step(coop, 1 / 60);
  assert.equal(coop.over, true);
  const versus = initialState({ mode: "versus" });
  versus.players[1].frags = 10;
  step(versus, 1 / 60);
  assert.equal(versus.winner, 1);
  assert.equal(versus.over, true);
});
test("固定步长和相同输入产生相同状态", () => {
  const a = initialState({ map: "big", seed: 42 }),
    b = structuredClone(a);
  for (let i = 0; i < 1200; i++) {
    const input = [{ x: Math.sin(i / 60), y: Math.cos(i / 60), fire: true }];
    step(a, 1 / 60, input);
    step(b, 1 / 60, input);
  }
  assert.deepEqual(a, b);
  validateState(a);
  assert.ok(a.wave >= 1);
});

test("连续击杀间经过正常帧时间仍能累积升级", () => {
  const s = initialState({ map: "big" }),
    p = s.players[0];
  for (let i = 0; i < 8; i++) {
    awardKill(s, p);
    for (let j = 0; j < 12; j++) step(s, 1 / 60);
  }
  assert.ok(p.peak >= 5);
  chooseWeapon(s, p, 1);
  assert.equal(p.weapon, 1);
});
