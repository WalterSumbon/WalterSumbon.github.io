import { fruitDefs, fruitUse, FRUIT_NAMES, gingham } from "./watermelon-art.js";
import { RADII, mergeScore, validateState } from "./watermelon-logic.js";
export const validate = validateState;
export function mount(host, hooks, saved) {
  if (saved) validate(saved);
  const { Engine, Bodies, Body, Composite, Events } = globalThis.Matter;
  const engine = Engine.create({ gravity: { y: 1.3 }, enableSleeping: true });
  let fruits = [],
    score = saved?.score || 0,
    next = saved?.next ?? Math.floor(Math.random() * 4),
    over = saved?.over || false,
    running = false,
    frame,
    last = 0,
    acc = 0,
    clock = 0,
    lastDrop = -1000,
    aim = 210,
    danger = 0,
    merges = [];
  host.innerHTML = `<div class="playfield orchard" tabindex="0" role="application" aria-label="合成大西瓜：左右移动，空格投放"><svg viewBox="0 -80 420 720" aria-hidden="true"><defs>${fruitDefs()}${gingham}</defs><rect x="0" y="-80" width="420" height="720" rx="20" fill="#c5dec0"/><rect x="20" y="-59" width="148" height="70" rx="18" fill="#4f6651"/><text x="94" y="-36" text-anchor="middle" fill="#e0edcc" font-size="12" font-weight="600">这一篮的得分</text><text id="fruit-score" x="94" y="-6" text-anchor="middle" font-size="28" font-weight="750" fill="#fff8e5" font-family="ui-rounded,system-ui,sans-serif">0</text><rect x="242" y="-58" width="158" height="68" rx="34" fill="#e1ecd0" stroke="#b0cda6" stroke-width="3"/><text x="265" y="-19" fill="#526e50" font-size="12">待投放</text><g id="next-fruit" transform="translate(363 -24)"></g><rect x="12" y="95" width="396" height="471" fill="url(#orchard-gingham)"/><path d="M12 91V566H408V91" fill="none" stroke="#c87c58" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 95H393" stroke="#de916d" stroke-width="4" stroke-linecap="round" stroke-dasharray="12 12"/><g id="aim-fruit"></g><g id="fruits"></g><rect x="13" y="584" width="394" height="42" rx="21" fill="#e1ecd0" stroke="#b0cda6" stroke-width="2"/>${FRUIT_NAMES.map((_, i) => fruitUse(i, 12 + i * 0.35, 32 + i * 35.5, 605)).join("")}</svg><div class="game-overlay"><div class="orchard-welcome"><svg viewBox="-54 -54 108 108" aria-hidden="true">${fruitUse(10, 50)}</svg><p>装满一篮小快乐</p><button class="primary start">${saved && !over ? "继续合成" : "开始合成"}</button><small>移动选位置，点击投放<br>让一样的小果子碰个面</small></div></div></div>`;
  const field = host.querySelector(".playfield"),
    overlay = host.querySelector(".game-overlay"),
    layer = host.querySelector("#fruits");
  Composite.add(engine.world, [
    Bodies.rectangle(210, 590, 440, 48, { isStatic: true }),
    Bodies.rectangle(-12, 290, 48, 620, { isStatic: true }),
    Bodies.rectangle(432, 290, 48, 620, { isStatic: true }),
  ]);
  function add(level, x, y, v = {}) {
    const body = Bodies.circle(x, y, RADII[level], {
      restitution: 0.12,
      friction: 0.3,
      frictionStatic: 0.6,
      density: 0.002,
      slop: 0.02,
    });
    const fruit = {
      body,
      level,
      born: clock - (v.age || 0),
      node: document.createElementNS("http://www.w3.org/2000/svg", "g"),
    };
    fruit.node.innerHTML = fruitUse(level, RADII[level]);
    layer.append(fruit.node);
    fruits.push(fruit);
    Composite.add(engine.world, body);
    Body.setVelocity(body, { x: v.vx || 0, y: v.vy || 0 });
    Body.setAngle(body, v.angle || 0);
    Body.setAngularVelocity(body, v.angularVelocity || 0);
    return fruit;
  }
  if (saved) for (const f of saved.fruits) add(f.level, f.x, f.y, f);
  Events.on(engine, "collisionStart", (e) => {
    for (const pair of e.pairs) {
      const a = fruits.find((f) => f.body === pair.bodyA),
        b = fruits.find((f) => f.body === pair.bodyB);
      if (a && b && a.level === b.level && a.level < RADII.length - 1)
        merges.push([a, b]);
    }
  });
  function physics() {
    Engine.update(engine, 1000 / 60);
    clock += 1000 / 60;
    for (const [a, b] of merges) {
      if (!fruits.includes(a) || !fruits.includes(b)) continue;
      const level = a.level + 1,
        x = (a.body.position.x + b.body.position.x) / 2,
        y = (a.body.position.y + b.body.position.y) / 2;
      for (const f of [a, b]) {
        Composite.remove(engine.world, f.body);
        f.node.remove();
        fruits.splice(fruits.indexOf(f), 1);
      }
      add(level, x, y);
      score += mergeScore(level);
      hooks.onScore(score);
    }
    merges = [];
    const overflow = fruits.some(
      (f) =>
        clock - f.born > 1500 &&
        f.body.position.y - RADII[f.level] < 95 &&
        f.body.speed < 0.5,
    );
    danger = overflow ? danger + 1000 / 60 : 0;
    if (danger > 2000) {
      over = true;
      pause();
      hooks.onEnd(score);
    }
  }
  function draw() {
    for (const f of fruits)
      f.node.setAttribute(
        "transform",
        `translate(${f.body.position.x} ${f.body.position.y}) rotate(${(f.body.angle * 180) / Math.PI})`,
      );
    host.querySelector("#fruit-score").textContent = score;
    host.querySelector("#next-fruit").innerHTML = fruitUse(next, 22);
    host.querySelector("#aim-fruit").innerHTML =
      `<path d="M${aim} 100V546" stroke="#df926f" opacity=".65" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 12"/>${fruitUse(next, RADII[next], aim, 68)}`;
  }
  function tick(now) {
    if (!running) return;
    acc += Math.min(now - last, 50);
    last = now;
    while (acc >= 1000 / 60 && running) {
      physics();
      acc -= 1000 / 60;
    }
    draw();
    if (running) frame = requestAnimationFrame(tick);
  }
  function pause() {
    running = false;
    cancelAnimationFrame(frame);
    overlay.hidden = false;
    overlay.querySelector("p").textContent = over
      ? `本次合成得 ${score} 分`
      : "已暂停，水果在等你";
    host.querySelector(".start").textContent = over ? "再来一局" : "继续合成";
  }
  function start() {
    if (over) {
      for (const f of fruits) {
        Composite.remove(engine.world, f.body);
        f.node.remove();
      }
      fruits = [];
      score = 0;
      danger = 0;
      over = false;
      next = Math.floor(Math.random() * 4);
      hooks.onScore(0);
    }
    if (fruits.length === 0) hooks.onStart();
    running = true;
    overlay.hidden = true;
    last = performance.now();
    acc = 0;
    field.focus({ preventScroll: true });
    frame = requestAnimationFrame(tick);
  }
  function drop() {
    if (!running || clock - lastDrop < 500) return;
    add(next, aim, 68);
    lastDrop = clock;
    next = Math.floor(Math.random() * 4);
    aim = Math.max(14 + RADII[next], Math.min(406 - RADII[next], aim));
    draw();
  }
  const pointer = (e) => {
    const r = field.getBoundingClientRect();
    aim = Math.max(
      14 + RADII[next],
      Math.min(406 - RADII[next], ((e.clientX - r.left) / r.width) * 420),
    );
    draw();
  };
  field.addEventListener("pointermove", pointer);
  field.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    pointer(e);
    drop();
  });
  const keyboard = (e) => {
    if (!["ArrowLeft", "ArrowRight", "Space"].includes(e.code)) return;
    e.preventDefault();
    if (e.code === "Space") {
      if (!running) start();
      else drop();
    } else
      aim = Math.max(
        14 + RADII[next],
        Math.min(406 - RADII[next], aim + (e.code === "ArrowLeft" ? -14 : 14)),
      );
    draw();
  };
  field.addEventListener("keydown", keyboard);
  host.querySelector(".start").onclick = (e) => {
    e.stopPropagation();
    start();
  };
  draw();
  hooks.onScore(score);
  return {
    getState: () => ({
      score,
      next,
      over,
      fruits: fruits.map((f) => ({
        level: f.level,
        x: f.body.position.x,
        y: f.body.position.y,
        vx: f.body.velocity.x,
        vy: f.body.velocity.y,
        angle: f.body.angle,
        angularVelocity: f.body.angularVelocity,
        age: clock - f.born,
      })),
    }),
    pause,
    destroy: () => {
      running = false;
      cancelAnimationFrame(frame);
      Events.off(engine);
      Engine.clear(engine);
      field.removeEventListener("keydown", keyboard);
    },
  };
}
