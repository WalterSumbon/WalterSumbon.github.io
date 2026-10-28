import {
  WIDTH,
  HEIGHT,
  CELL,
  MAPS,
  WEAPONS,
  UPGRADES,
  weaponStats,
} from "./boxhead-data.js";
export { MAPS, WEAPONS, UPGRADES, weaponStats };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** 状态只由主模拟器写入；渲染及输入不直接修改实体。固定步长便于存档和联机。 */
export function initialState(options = {}) {
  const mode = options.mode || "single",
    map = options.map || "boxy";
  const s = {
    mode,
    map,
    difficulty: options.difficulty || "normal",
    devils: options.devils !== false,
    friendlyFire: !!options.friendlyFire,
    seed: options.seed ?? 12345,
    time: 0,
    wave: 0,
    pending: 0,
    spawnTimer: 0,
    breakTimer: 2,
    boxTimer: 7,
    score: 0,
    over: false,
    winner: null,
    nextId: 1,
    players: [],
    enemies: [],
    bullets: [],
    objects: [],
    boxes: [],
    effects: [],
    notifications: [],
  };
  for (let i = 0; i < (mode === "single" ? 1 : 2); i++) {
    const p = {
      id: i,
      x: WIDTH / 2 + (i ? 80 : -80),
      y: HEIGHT / 2 + 100,
      r: 12,
      hp: 100,
      angle: -Math.PI / 2,
      weapon: 0,
      ammo: WEAPONS.map((w) => w.ammo),
      combo: 0,
      peak: mode === "versus" ? 245 : 0,
      kills: 0,
      frags: 0,
      cooldown: 0,
      hurt: 0,
      dead: false,
      respawn: 0,
    };
    s.players.push(p);
    safePosition(s, p);
  }
  return s;
}
function random(s) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
function blocks(s) {
  return MAPS.find((m) => m.id === s.map).blocks;
}
function overlaps(a, b) {
  return (
    a.x + a.r > b.x &&
    a.x - a.r < b.x + b.w &&
    a.y + a.r > b.y &&
    a.y - a.r < b.y + b.h
  );
}
export function blocked(s, x, y, r = 10, ignore = null) {
  const a = { x, y, r };
  return (
    x < r + 8 ||
    y < r + 8 ||
    x > WIDTH - r - 8 ||
    y > HEIGHT - r - 8 ||
    blocks(s).some((b) => overlaps(a, b)) ||
    s.objects.some(
      (o) =>
        o !== ignore &&
        o.hp > 0 &&
        ["wall", "barrel"].includes(o.type) &&
        overlaps(a, { x: o.x - 14, y: o.y - 14, w: 28, h: 28 }),
    )
  );
}
function safePosition(s, p) {
  if (!blocked(s, p.x, p.y, p.r)) return;
  for (let y = 64; y < HEIGHT - 32; y += 32)
    for (let x = 64; x < WIDTH - 32; x += 32)
      if (!blocked(s, x, y, p.r)) {
        p.x = x;
        p.y = y;
        return;
      }
}
function move(s, p, dx, dy) {
  if (!blocked(s, p.x + dx, p.y, p.r)) p.x += dx;
  if (!blocked(s, p.x, p.y + dy, p.r)) p.y += dy;
}
export function chooseWeapon(s, p, index) {
  if (index >= 0 && index < WEAPONS.length && p.peak >= WEAPONS[index].unlock)
    p.weapon = index;
}
export function cycleWeapon(s, p, direction) {
  for (let n = 1; n <= 10; n++) {
    const i = (p.weapon + direction * n + 100) % 10;
    if (p.peak >= WEAPONS[i].unlock) {
      p.weapon = i;
      return;
    }
  }
}
function notify(s, text) {
  s.notifications.push({ text, life: 4 });
  if (s.notifications.length > 4) s.notifications.shift();
}
export function awardKill(s, p, devil = false) {
  if (!p) return;
  const previous = p.peak;
  p.combo += 1;
  p.peak = Math.max(p.peak, Math.floor(p.combo));
  p.kills++;
  s.score += Math.round((devil ? 100 : 10) * Math.max(1, p.combo));
  for (let i = 0; i < WEAPONS.length; i++)
    if (previous < WEAPONS[i].unlock && p.peak >= WEAPONS[i].unlock) {
      p.ammo[i] = weaponStats(i, p.peak).ammo;
      notify(s, `P${p.id + 1} 解锁 ${WEAPONS[i].name}`);
    }
  for (const [at, i, key, , name] of UPGRADES)
    if (previous < at && p.peak >= at) {
      if (key === "ammo") p.ammo[i] = weaponStats(i, p.peak).ammo;
      notify(s, `P${p.id + 1} ${name}`);
    }
}
function killEnemy(s, e, owner) {
  if (e.dead) return;
  e.dead = true;
  awardKill(s, s.players[owner], e.type === "devil");
  if (random(s) < 0.18) s.boxes.push({ x: e.x, y: e.y, id: s.nextId++ });
  s.effects.push({ x: e.x, y: e.y, r: e.r + 8, life: 0.4, color: "#947252" });
}
function enemyDamage(s, e, damage, owner) {
  e.hp -= damage;
  e.stun = 0.28;
  if (e.hp <= 0) killEnemy(s, e, owner);
}
function playerDamage(s, p, damage, owner = null) {
  if (p.dead || p.hurt > 0) return;
  p.hp = Math.max(0, p.hp - damage);
  p.hurt = 0.25;
  if (p.hp === 0) {
    p.dead = true;
    p.respawn = 3;
    if (s.mode === "versus" && owner !== null && owner !== p.id) {
      s.players[owner].frags++;
      s.score = Math.max(...s.players.map((x) => x.frags)) * 100;
    }
  }
}
export function explode(s, x, y, radius, damage, owner, cluster = 0) {
  s.effects.push({ x, y, r: radius, life: 0.32, color: "#edaa48" });
  for (const e of s.enemies)
    if (!e.dead && distance(e, { x, y }) < radius + e.r)
      enemyDamage(
        s,
        e,
        damage * (1 - (0.5 * distance(e, { x, y })) / radius),
        owner,
      );
  for (const p of s.players)
    if (distance(p, { x, y }) < radius + p.r)
      playerDamage(s, p, damage * 0.65, owner);
  // 先标记油桶死亡再连锁，避免递归重复爆炸。
  for (const o of s.objects)
    if (o.hp > 0 && distance(o, { x, y }) < radius + 14) {
      o.hp -= damage;
      if (o.hp <= 0 && o.type === "barrel")
        explode(s, o.x, o.y, o.radius, o.damage, o.owner);
    }
  for (let i = 0; i < cluster; i++) {
    const a = (i * Math.PI * 2) / cluster;
    s.bullets.push({
      id: s.nextId++,
      type: "grenade",
      x,
      y,
      vx: Math.cos(a) * 130,
      vy: Math.sin(a) * 130,
      life: 0.55,
      r: 4,
      damage: damage * 0.4,
      radius: radius * 0.5,
      owner,
      cluster: 0,
    });
  }
}
function shot(s, p, input) {
  const w = weaponStats(p.weapon, p.peak),
    owned = s.objects.filter(
      (o) => o.type === "charge" && o.owner === p.id && o.hp > 0,
    );
  if (w.id === "charge" && owned.length && input.detonate) {
    for (const o of owned) {
      o.hp = 0;
      explode(s, o.x, o.y, o.radius, o.damage, p.id, o.cluster);
    }
    p.cooldown = 0.5;
    return;
  }
  if (p.cooldown > 0 || !input.fire) return;
  if (w.id !== "pistol" && p.ammo[p.weapon] <= 0) {
    p.weapon = 0;
    return;
  }
  const x = p.x + Math.cos(p.angle) * 30,
    y = p.y + Math.sin(p.angle) * 30;
  if (["wall", "barrel", "mine", "charge"].includes(w.id)) {
    if (
      blocked(s, x, y, 16) ||
      s.objects.some((o) => o.hp > 0 && distance(o, { x, y }) < 30)
    )
      return;
    if (s.objects.length >= 150) {
      notify(s, "场上设施已达上限");
      return;
    }
    s.objects.push({
      id: s.nextId++,
      type: w.id,
      x,
      y,
      hp: w.id === "wall" ? 250 : 45,
      owner: p.id,
      damage: w.damage,
      radius: w.radius || 0,
      cluster: w.cluster || 0,
      age: 0,
    });
  } else {
    const count = Math.round(w.pellets || 1);
    for (let i = 0; i < count; i++) {
      const a = p.angle + (count > 1 ? (i - (count - 1) / 2) * 0.12 : 0);
      s.bullets.push({
        id: s.nextId++,
        type: w.id,
        x: p.x + Math.cos(a) * 16,
        y: p.y + Math.sin(a) * 16,
        vx: Math.cos(a) * (w.speed || 220),
        vy: Math.sin(a) * (w.speed || 220),
        life: w.id === "grenade" ? 1 : w.range / w.speed,
        r: w.id === "rocket" ? 5 : 3,
        damage: w.damage,
        radius: w.radius || 0,
        cluster: w.cluster || 0,
        owner: p.id,
        pierce: !!w.pierce,
        hit: [],
      });
    }
  }
  if (w.id !== "pistol") p.ammo[p.weapon]--;
  p.cooldown = w.interval;
}
function spawnEnemy(s) {
  const side = Math.floor(random(s) * 4),
    e = {
      id: s.nextId++,
      x:
        side < 2
          ? side === 0
            ? 28
            : WIDTH - 28
          : 28 + random(s) * (WIDTH - 56),
      y:
        side >= 2
          ? side === 2
            ? 28
            : HEIGHT - 28
          : 28 + random(s) * (HEIGHT - 56),
      type:
        s.devils &&
        s.wave >= 3 &&
        random(s) < Math.min(0.3, 0.05 + s.wave * 0.008)
          ? "devil"
          : "zombie",
      stun: 0,
      cooldown: 1 + random(s),
      dead: false,
    };
  e.r = e.type === "devil" ? 18 : 11;
  e.hp =
    (e.type === "devil" ? 260 : 45) *
    (1 + s.wave * 0.07) *
    (s.difficulty === "hard" ? 1.4 : s.difficulty === "easy" ? 0.7 : 1);
  e.maxHp = e.hp;
  e.speed = e.type === "devil" ? 38 : 38 + Math.min(35, s.wave * 1.2);
  s.enemies.push(e);
}
const navigation = new WeakMap();
function flow(s, p) {
  const cols = WIDTH / CELL,
    rows = HEIGHT / CELL,
    dist = new Int16Array(cols * rows).fill(-1),
    q = [];
  let root =
    clamp(Math.floor(p.y / CELL), 0, rows - 1) * cols +
    clamp(Math.floor(p.x / CELL), 0, cols - 1);
  dist[root] = 0;
  q.push(root);
  for (let k = 0; k < q.length; k++) {
    const n = q[k],
      x = n % cols,
      y = Math.floor(n / cols);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        j = ny * cols + nx;
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= cols ||
        ny >= rows ||
        dist[j] >= 0 ||
        blocked(s, nx * CELL + 16, ny * CELL + 16, 10)
      )
        continue;
      dist[j] = dist[n] + 1;
      q.push(j);
    }
  }
  return dist;
}
function enemyStep(s, e, dt, flows) {
  const alive = s.players.filter((p) => !p.dead);
  if (!alive.length) return;
  const p = alive.reduce((a, b) => (distance(e, a) < distance(e, b) ? a : b));
  e.stun = Math.max(0, e.stun - dt);
  e.cooldown -= dt;
  let tx = p.x,
    ty = p.y;
  const cols = WIDTH / CELL,
    ix = clamp(Math.floor(e.x / CELL), 0, cols - 1),
    iy = clamp(Math.floor(e.y / CELL), 0, HEIGHT / CELL - 1),
    f = flows[p.id];
  let best = f[iy * cols + ix];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const x = ix + dx,
      y = iy + dy,
      d = f[y * cols + x];
    if (
      x >= 0 &&
      x < cols &&
      y >= 0 &&
      y < HEIGHT / CELL &&
      d >= 0 &&
      (best < 0 || d < best)
    ) {
      best = d;
      tx = x * CELL + 16;
      ty = y * CELL + 16;
    }
  }
  if (distance(e, p) < 60) {
    tx = p.x;
    ty = p.y;
  }
  const a = Math.atan2(ty - e.y, tx - e.x);
  move(
    s,
    e,
    Math.cos(a) * e.speed * dt * (e.stun ? 0.3 : 1),
    Math.sin(a) * e.speed * dt * (e.stun ? 0.3 : 1),
  );
  if (distance(e, p) < e.r + p.r + 4)
    playerDamage(
      s,
      p,
      (e.type === "devil" ? 20 : 9) * (s.difficulty === "easy" ? 0.6 : 1),
    );
  for (const o of s.objects)
    if (
      o.hp > 0 &&
      ["wall", "barrel"].includes(o.type) &&
      distance(e, o) < e.r + 24
    ) {
      o.hp -= 35 * dt;
      if (o.hp <= 0 && o.type === "barrel")
        explode(s, o.x, o.y, o.radius, o.damage, o.owner);
    }
  if (e.type === "devil" && !e.stun && e.cooldown <= 0) {
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    s.bullets.push({
      id: s.nextId++,
      type: "fireball",
      x: e.x,
      y: e.y,
      vx: Math.cos(a) * 190,
      vy: Math.sin(a) * 190,
      life: 5,
      r: 7,
      damage: 25,
      owner: -1,
    });
    e.cooldown = 2.2;
  }
}
function bulletStep(s, b, dt) {
  const parts = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 7));
  for (let k = 0; k < parts && b.life > 0; k++) {
    b.life -= dt / parts;
    const nx = b.x + (b.vx * dt) / parts,
      ny = b.y + (b.vy * dt) / parts;
    if (b.type === "grenade") {
      if (blocked(s, nx, b.y, 4)) b.vx *= -0.6;
      else b.x = nx;
      if (blocked(s, b.x, ny, 4)) b.vy *= -0.6;
      else b.y = ny;
      continue;
    }
    b.x = nx;
    b.y = ny;
    if (blocked(s, b.x, b.y, 2)) {
      const o = s.objects.find((o) => o.hp > 0 && distance(o, b) < 20);
      if (o) {
        o.hp -= b.damage;
        if (o.hp <= 0 && o.type === "barrel")
          explode(s, o.x, o.y, o.radius, o.damage, b.owner);
      }
      b.life = 0;
      break;
    }
    if (b.owner >= 0) {
      for (const e of s.enemies)
        if (!e.dead && !b.hit.includes(e.id) && distance(b, e) < e.r + b.r) {
          enemyDamage(s, e, b.damage, b.owner);
          b.hit.push(e.id);
          if (!b.pierce) {
            b.life = 0;
            break;
          }
        }
    }
    for (const p of s.players)
      if (
        !p.dead &&
        (b.owner === -1 ||
          ((s.mode === "versus" || s.friendlyFire) && b.owner !== p.id)) &&
        distance(b, p) < p.r + b.r
      ) {
        playerDamage(s, p, b.damage, b.owner < 0 ? null : b.owner);
        b.life = 0;
        break;
      }
  }
  if (b.life <= 0 && b.radius)
    explode(s, b.x, b.y, b.radius, b.damage, b.owner, b.cluster);
}
export function step(s, dt, inputs = []) {
  if (s.over) return;
  dt = clamp(dt, 0, 1 / 30);
  s.time += dt;
  for (const p of s.players) {
    const input = inputs[p.id] || {};
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.hurt = Math.max(0, p.hurt - dt);
    p.combo = Math.max(0, p.combo - dt * (0.3 + p.combo * 0.035));
    if (p.dead) {
      if (s.mode === "versus") {
        p.respawn -= dt;
        if (p.respawn <= 0) {
          p.dead = false;
          p.hp = 100;
          p.x = p.id ? 800 : 160;
          p.y = 320;
          p.hurt = 2;
          safePosition(s, p);
        }
      }
      continue;
    }
    if (input.weapon !== undefined) chooseWeapon(s, p, input.weapon);
    if (input.cycle) cycleWeapon(s, p, input.cycle);
    let dx = clamp(input.x || 0, -1, 1),
      dy = clamp(input.y || 0, -1, 1),
      len = Math.max(1, Math.hypot(dx, dy));
    if (Number.isFinite(input.angle)) p.angle = input.angle;
    else if (dx || dy) p.angle = Math.atan2(dy, dx);
    move(s, p, (dx / len) * 150 * dt, (dy / len) * 150 * dt);
    shot(s, p, input);
    for (const box of s.boxes)
      if (!box.used && distance(p, box) < 25) {
        box.used = true;
        p.hp = Math.min(100, p.hp + 18);
        for (let i = 1; i < 10; i++)
          if (p.peak >= WEAPONS[i].unlock) {
            const cap = weaponStats(i, p.peak).ammo;
            p.ammo[i] = Math.min(cap, p.ammo[i] + Math.ceil(cap * 0.3));
          }
        notify(s, `P${p.id + 1} 补给 +`);
      }
  }
  if (s.mode !== "versus") {
    if (s.pending === 0 && !s.enemies.some((e) => !e.dead)) {
      s.breakTimer -= dt;
      if (s.breakTimer <= 0) {
        s.wave++;
        s.pending = 6 + s.wave * 4;
        s.spawnTimer = 0;
        s.breakTimer = 4;
        for (const p of s.players)
          if (p.dead) {
            p.dead = false;
            p.hp = 60;
            p.hurt = 2;
            safePosition(s, p);
          }
        notify(s, `第 ${s.wave} 波`);
      }
    }
    s.spawnTimer = Math.max(0, s.spawnTimer - dt);
    if (s.pending > 0 && s.spawnTimer <= 0 && s.enemies.length < 180) {
      spawnEnemy(s);
      s.pending--;
      s.spawnTimer = Math.max(0.12, 0.6 - s.wave * 0.015);
    }
    let nav = navigation.get(s);
    if (!nav || s.time - nav.time > 0.4) {
      nav = { time: s.time, flows: s.players.map((p) => flow(s, p)) };
      navigation.set(s, nav);
    }
    for (const e of s.enemies) if (!e.dead) enemyStep(s, e, dt, nav.flows);
    // 分离重叠实体，减少入口堆叠；不改变地图碰撞约束。
    for (let i = 0; i < s.enemies.length; i++)
      for (let j = i + 1; j < s.enemies.length; j++) {
        const a = s.enemies[i],
          b = s.enemies[j],
          d = distance(a, b),
          min = a.r + b.r;
        if (d > 0 && d < min) {
          const push = Math.min(2, (min - d) * 0.25);
          move(s, a, ((a.x - b.x) / d) * push, ((a.y - b.y) / d) * push);
          move(s, b, ((b.x - a.x) / d) * push, ((b.y - a.y) / d) * push);
        }
      }
  }
  const bullets = s.bullets.slice();
  for (const b of bullets) bulletStep(s, b, dt);
  for (const o of s.objects) {
    o.age += dt;
    if (
      o.type === "mine" &&
      o.hp > 0 &&
      o.age > 0.6 &&
      (s.enemies.some((e) => !e.dead && distance(e, o) < 30) ||
        (s.mode === "versus" &&
          s.players.some(
            (p) => !p.dead && p.id !== o.owner && distance(p, o) < 30,
          )))
    ) {
      o.hp = 0;
      explode(s, o.x, o.y, o.radius, o.damage, o.owner, o.cluster);
    }
  }
  s.boxTimer -= dt;
  if (s.boxTimer <= 0) {
    if (s.boxes.length < 15) {
      const b = {
        x: 40 + random(s) * (WIDTH - 80),
        y: 40 + random(s) * (HEIGHT - 80),
        id: s.nextId++,
      };
      if (!blocked(s, b.x, b.y, 12)) s.boxes.push(b);
    }
    s.boxTimer = 8;
  }
  s.bullets = s.bullets.filter((b) => b.life > 0);
  s.enemies = s.enemies.filter((e) => !e.dead);
  s.objects = s.objects.filter((o) => o.hp > 0);
  s.boxes = s.boxes.filter((b) => !b.used);
  s.effects = s.effects.filter((e) => (e.life -= dt) > 0);
  s.notifications = s.notifications.filter((n) => (n.life -= dt) > 0);
  if (s.mode === "versus") {
    const win = s.players.find((p) => p.frags >= 10);
    if (win) {
      s.over = true;
      s.winner = win.id;
    }
  } else if (s.players.every((p) => p.dead)) s.over = true;
}
export function validateState(s) {
  if (
    !s ||
    !MAPS.some((m) => m.id === s.map) ||
    !["single", "coop", "versus"].includes(s.mode) ||
    !["easy", "normal", "hard"].includes(s.difficulty)
  )
    throw new Error("战场存档参数无效");
  for (const k of [
    "time",
    "wave",
    "pending",
    "spawnTimer",
    "breakTimer",
    "boxTimer",
    "score",
    "nextId",
    "seed",
  ])
    if (!Number.isFinite(s[k]) || s[k] < -10)
      throw new Error("战场存档数值无效");
  if (
    !Array.isArray(s.players) ||
    s.players.length !== (s.mode === "single" ? 1 : 2)
  )
    throw new Error("玩家存档无效");
  for (const key of [
    "enemies",
    "bullets",
    "objects",
    "boxes",
    "effects",
    "notifications",
  ])
    if (!Array.isArray(s[key]) || s[key].length > 10000)
      throw new Error("战场实体存档无效");
  for (const p of s.players)
    if (
      ![
        p.x,
        p.y,
        p.hp,
        p.angle,
        p.weapon,
        p.combo,
        p.peak,
        p.cooldown,
        p.hurt,
        p.frags,
      ].every(Number.isFinite) ||
      p.weapon < 0 ||
      p.weapon > 9 ||
      !Array.isArray(p.ammo) ||
      p.ammo.length !== 10 ||
      !p.ammo.every((v) => Number.isFinite(v) && v >= 0)
    )
      throw new Error("玩家数据无效");
  for (const key of ["enemies", "bullets", "objects", "boxes", "effects"])
    for (const e of s[key])
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y))
        throw new Error("实体坐标无效");
  return true;
}
