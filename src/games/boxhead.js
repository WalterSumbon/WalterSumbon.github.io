import {
  initialState,
  step,
  validateState,
  MAPS,
  WEAPONS,
  UPGRADES,
  weaponStats,
} from "./boxhead-logic.js";
import { WIDTH, HEIGHT } from "./boxhead-data.js";
export const validate = validateState;
export function mount(host, hooks, saved) {
  let s = saved ? structuredClone(saved) : initialState(),
    running = false,
    frame = 0,
    last = 0,
    acc = 0,
    ended = false;
  validate(s);
  const keys = new Set(),
    touch = [{}, {}],
    mouse = { active: false, angle: 0 };
  host.innerHTML = `<div class="boxhead-shell"><div class="bh-toolbar"><b>方块危机</b><span class="bh-summary"></span><button class="quiet bh-pause">暂停</button><button class="quiet bh-full">全屏</button></div><div class="bh-arena" tabindex="0" role="application" aria-label="方块危机战场"><canvas width="960" height="640" aria-label="游戏画面"></canvas><div class="bh-menu"><h2>守住这一间。</h2><p>连杀解锁武器，红箱补充弹药。远离爆炸。</p><label>模式 <select class="bh-mode"><option value="single">单人</option><option value="coop">双人合作</option><option value="versus">双人对战 · 先到 10 击杀</option></select></label><label>地图 <select class="bh-map">${MAPS.map((m) => `<option value="${m.id}">${m.name}</option>`).join("")}</select></label><label>难度 <select class="bh-difficulty"><option value="easy">轻松</option><option value="normal" selected>标准</option><option value="hard">困难</option></select></label><label><input class="bh-devils" type="checkbox" checked> 恶魔</label><label><input class="bh-friendly" type="checkbox"> 合作模式子弹友伤（爆炸始终有伤害）</label><div><button class="primary bh-new">开始新局</button><button class="secondary bh-resume" ${saved && !s.over ? "" : "hidden"}>继续存档</button></div><p class="bh-menu-note"></p></div></div><div class="bh-players"></div><details class="bh-help"><summary>操作、武器与升级</summary><p>单人：方向键 / WASD 移动，空格射击；鼠标按住可瞄准射击。1–9 / 0 选武器，Q / E 切换，R 引爆遥控炸药，P 暂停。双人：P1 方向键、/ 射击、逗号句号换枪、Enter 引爆；P2 WASD、空格射击、Q/E 换枪、R 引爆。</p><p>触屏：左摇杆移动，右摇杆瞄准并射击。双人时每位玩家有各自控制区。合作阵亡玩家在下一波复活；全员阵亡结束。对战先达到 10 击杀获胜。对战分数不提交生存榜。</p><p>连杀倍率随时间下降，达到过的升级永久保留到本局结束。油桶可阻挡并连锁爆炸；路障可被拆毁；地雷自动触发；遥控炸药由“引爆”按钮触发；轨道炮贯穿敌人。</p><p>独立玩法重制，参考 <a href="https://armorgames.com/play/158/boxhead-2play" target="_blank" rel="noopener">Boxhead: 2Play</a>。18 张重绘地图及伤害、升级阈值为本版调校。</p><ol>${WEAPONS.map((w) => `<li>${w.name}：连杀达到 ${w.unlock} 解锁</li>`).join("")}</ol><details><summary>完整升级表</summary><ul>${UPGRADES.map(([at, , , , name]) => `<li>×${at} ${name}</li>`).join("")}</ul></details></details></div>`;
  const shell = host.querySelector(".boxhead-shell"),
    arena = host.querySelector(".bh-arena"),
    canvas = host.querySelector("canvas"),
    ctx = canvas.getContext("2d"),
    menu = host.querySelector(".bh-menu"),
    summary = host.querySelector(".bh-summary");
  host.querySelector(".bh-mode").value = s.mode;
  host.querySelector(".bh-map").value = s.map;
  host.querySelector(".bh-difficulty").value = s.difficulty;
  const listeners = [];
  function on(el, event, fn, options) {
    el.addEventListener(event, fn, options);
    listeners.push(() => el.removeEventListener(event, fn, options));
  }
  function controls() {
    host.querySelector(".bh-players").innerHTML = s.players
      .map(
        (p) =>
          `<section class="bh-player-panel"><div class="bh-player-status" data-player="${p.id}"></div><div class="bh-weapon-buttons"><button data-cycle="-1" data-player="${p.id}" aria-label="上一武器">‹</button><select data-weapon="${p.id}" aria-label="玩家 ${p.id + 1} 武器"></select><button data-cycle="1" data-player="${p.id}" aria-label="下一武器">›</button><button data-detonate="${p.id}">引爆</button></div><div class="bh-touch"><div class="bh-stick" data-player="${p.id}" data-kind="move" aria-label="玩家 ${p.id + 1} 移动摇杆"><span>移动</span><i></i></div><div class="bh-stick" data-player="${p.id}" data-kind="aim" aria-label="玩家 ${p.id + 1} 瞄准射击摇杆"><span>射击</span><i></i></div></div></section>`,
      )
      .join("");
    host.querySelectorAll("[data-cycle]").forEach(
      (b) =>
        (b.onclick = () => {
          touch[Number(b.dataset.player)].cycle = Number(b.dataset.cycle);
          arena.focus();
        }),
    );
    host.querySelectorAll("[data-weapon]").forEach(
      (b) =>
        (b.onchange = () => {
          touch[Number(b.dataset.weapon)].weapon = Number(b.value);
          arena.focus();
        }),
    );
    host.querySelectorAll("[data-detonate]").forEach(
      (b) =>
        (b.onclick = () => {
          touch[Number(b.dataset.detonate)].detonate = true;
          arena.focus();
        }),
    );
    host.querySelectorAll(".bh-stick").forEach((pad) => {
      let pointer = null;
      const id = Number(pad.dataset.player),
        kind = pad.dataset.kind;
      const update = (e) => {
        const r = pad.getBoundingClientRect(),
          dx = (e.clientX - r.left - r.width / 2) / (r.width * 0.35),
          dy = (e.clientY - r.top - r.height / 2) / (r.height * 0.35),
          len = Math.max(1, Math.hypot(dx, dy));
        pad.querySelector("i").style.transform =
          `translate(${(dx / len) * 24}px,${(dy / len) * 24}px)`;
        if (kind === "move") {
          touch[id].x = dx / len;
          touch[id].y = dy / len;
        } else {
          touch[id].angle = Math.atan2(dy, dx);
          touch[id].fire = Math.hypot(dx, dy) > 0.15;
        }
      };
      pad.onpointerdown = (e) => {
        if (pointer !== null) return;
        pointer = e.pointerId;
        pad.setPointerCapture(pointer);
        update(e);
        e.preventDefault();
      };
      pad.onpointermove = (e) => {
        if (e.pointerId === pointer) update(e);
      };
      const end = (e) => {
        if (e.pointerId !== pointer) return;
        pointer = null;
        pad.querySelector("i").style.transform = "";
        if (kind === "move") {
          touch[id].x = 0;
          touch[id].y = 0;
        } else {
          touch[id].fire = false;
          delete touch[id].angle;
        }
      };
      pad.onpointerup = end;
      pad.onpointercancel = end;
      pad.onlostpointercapture = end;
    });
  }
  function input(id) {
    const p1 = id === 0,
      single = s.mode === "single";
    const k = (key) => (keys.has(key) ? 1 : 0);
    const v = {
      ...touch[id],
      x:
        touch[id].x ||
        (p1 ? k("ArrowRight") - k("ArrowLeft") : k("KeyD") - k("KeyA")) +
          (single ? k("KeyD") - k("KeyA") : 0),
      y:
        touch[id].y ||
        (p1 ? k("ArrowDown") - k("ArrowUp") : k("KeyS") - k("KeyW")) +
          (single ? k("KeyS") - k("KeyW") : 0),
      fire: touch[id].fire || keys.has(p1 && !single ? "Slash" : "Space"),
      detonate:
        touch[id].detonate || keys.has(p1 && !single ? "Enter" : "KeyR"),
    };
    if (single && mouse.active) {
      v.angle = mouse.angle;
      v.fire = true;
    }
    delete touch[id].cycle;
    delete touch[id].weapon;
    delete touch[id].detonate;
    return v;
  }
  function block(x, y, w, h, color, height = 12) {
    ctx.fillStyle = "#0003";
    ctx.fillRect(x + 6, y + 6, w, h);
    ctx.fillStyle = "#424747";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y - height, w, h);
    ctx.fillStyle = "#ffffff20";
    ctx.fillRect(x, y - height, w, 3);
  }
  function figure(p, color, angle, devil = false) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = "#0004";
    ctx.beginPath();
    ctx.ellipse(4, 6, p.r + 2, p.r * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    const size = p.r * 1.5;
    block(-size / 2, -size / 2, size, size, color, devil ? 16 : 10);
    ctx.strokeStyle = devil ? "#ffe4a0" : "#202a29";
    ctx.lineWidth = devil ? 5 : 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 8, -8 + Math.sin(angle) * 8);
    ctx.lineTo(
      Math.cos(angle) * (devil ? 17 : 23),
      -8 + Math.sin(angle) * (devil ? 17 : 23),
    );
    ctx.stroke();
    if (devil) {
      ctx.fillStyle = "#e9cf9e";
      ctx.fillRect(-size / 2 - 3, -size / 2 - 19, 5, 8);
      ctx.fillRect(size / 2 - 2, -size / 2 - 19, 5, 8);
    }
    ctx.restore();
  }
  function draw() {
    ctx.fillStyle = "#d6d2bf";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = "#c7c2af";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < WIDTH; x += 32) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
    }
    for (let y = 0; y < HEIGHT; y += 32) {
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
    }
    ctx.stroke();
    for (const b of MAPS.find((m) => m.id === s.map).blocks)
      block(b.x, b.y, b.w, b.h, "#7f8880", 22);
    for (const b of s.boxes) {
      block(b.x - 9, b.y - 9, 18, 18, "#b64d3c", 9);
      ctx.fillStyle = "#f2d5a5";
      ctx.fillRect(b.x - 2, b.y - 16, 4, 13);
      ctx.fillRect(b.x - 7, b.y - 12, 14, 4);
    }
    for (const o of s.objects) {
      if (o.type === "wall") block(o.x - 14, o.y - 14, 28, 28, "#a49d83", 14);
      else if (o.type === "barrel") {
        block(o.x - 12, o.y - 12, 24, 24, "#a35b37", 15);
        ctx.fillStyle = "#342d25";
        ctx.fillRect(o.x - 12, o.y - 20, 24, 4);
      } else {
        ctx.fillStyle = o.type === "mine" ? "#64744c" : "#4c5a66";
        ctx.fillRect(o.x - 8, o.y - 7, 16, 14);
        ctx.fillStyle = o.type === "charge" ? "#64e6b4" : "#d95437";
        ctx.fillRect(o.x - 2, o.y - 3, 4, 4);
      }
    }
    for (const e of s.enemies)
      figure(
        e,
        e.type === "devil" ? "#a83d35" : "#65845b",
        Math.atan2(s.players[0].y - e.y, s.players[0].x - e.x),
        e.type === "devil",
      );
    for (const p of s.players)
      if (!p.dead) {
        figure(
          p,
          p.hurt > 0 ? "#f4d097" : p.id ? "#5c7899" : "#b18a48",
          p.angle,
        );
        ctx.fillStyle = "#343a34";
        ctx.fillRect(p.x - 16, p.y - 34, 32, 4);
        ctx.fillStyle = p.id ? "#92c5ff" : "#e3bd60";
        ctx.fillRect(p.x - 16, p.y - 34, (32 * p.hp) / 100, 4);
        ctx.font = "bold 11px monospace";
        ctx.fillStyle = "#26332d";
        ctx.fillText("P" + (p.id + 1), p.x - 8, p.y + 27);
      }
    for (const b of s.bullets) {
      ctx.fillStyle =
        b.type === "fireball"
          ? "#e9662c"
          : b.type === "grenade"
            ? "#4a674b"
            : b.type === "rail"
              ? "#a9f8ed"
              : "#f6df92";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r || 3, 0, Math.PI * 2);
      ctx.fill();
      if (b.type === "rail") {
        ctx.strokeStyle = "#368e92";
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
        ctx.stroke();
      }
    }
    for (const e of s.effects) {
      ctx.globalAlpha = Math.min(1, e.life * 2);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * (1 - e.life * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "#26332d";
    ctx.fillText(
      s.mode === "versus"
        ? "对战 · 先到 10 击杀"
        : `WAVE ${s.wave} · 剩余 ${s.pending + s.enemies.length}`,
      18,
      26,
    );
    s.notifications.forEach((n, i) => {
      ctx.fillStyle = "#f7f2dfed";
      ctx.fillRect(WIDTH / 2 - 190, 36 + i * 28, 380, 25);
      ctx.fillStyle = "#343d34";
      ctx.textAlign = "center";
      ctx.fillText(n.text, WIDTH / 2, 54 + i * 28);
    });
    ctx.textAlign = "left";
  }
  let hudAt = -1;
  function hud() {
    if (s.time - hudAt < 0.15 && hudAt >= 0) return;
    hudAt = s.time;
    summary.textContent = `${s.mode === "versus" ? "对战" : s.mode === "coop" ? "合作" : "单人"} · ${s.mode === "versus" ? s.players.map((p) => p.frags).join(" : ") : s.score + " 分"}`;
    for (const p of s.players) {
      const w = weaponStats(p.weapon, p.peak),
        panel = host.querySelector(`[data-player="${p.id}"].bh-player-status`);
      panel.textContent = `P${p.id + 1} · ${p.dead ? "已阵亡" : "生命 " + Math.ceil(p.hp)} · 连杀 ×${Math.floor(p.combo)} · ${w.name} ${p.weapon ? p.ammo[p.weapon] : "∞"}`;
      const select = host.querySelector(`[data-weapon="${p.id}"]`),
        options = WEAPONS.map(
          (w, i) =>
            `<option value="${i}" ${p.peak < w.unlock ? "disabled" : ""}>${w.name}${p.peak < w.unlock ? " ×" + w.unlock : ""}</option>`,
        ).join("");
      if (select.dataset.peak !== String(p.peak)) {
        select.innerHTML = options;
        select.dataset.peak = String(p.peak);
      }
      select.value = String(p.weapon);
    }
  }
  function stop() {
    running = false;
    cancelAnimationFrame(frame);
    keys.clear();
    mouse.active = false;
    for (let i = 0; i < 2; i++) touch[i] = {};
    menu.hidden = false;
    host.querySelector(".bh-resume").hidden = s.over;
    host.querySelector(".bh-menu-note").textContent = s.over
      ? s.mode === "versus"
        ? `P${s.winner + 1} 获胜`
        : `本局 ${s.score} 分 · 坚持到第 ${s.wave} 波`
      : "已暂停；进度自动保存。";
    hooks.onChange();
  }
  function tick(now) {
    if (!running) return;
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= 1 / 60) {
      step(
        s,
        1 / 60,
        s.players.map((p) => input(p.id)),
      );
      acc -= 1 / 60;
    }
    draw();
    hud();
    hooks.onScore(s.mode === "versus" ? 0 : s.score);
    if (s.over) {
      stop();
      if (!ended) {
        ended = true;
        hooks.onEnd(s.mode === "versus" ? 0 : s.score);
      }
      return;
    }
    frame = requestAnimationFrame(tick);
  }
  function start(fresh) {
    if (fresh) {
      s = initialState({
        mode: host.querySelector(".bh-mode").value,
        map: host.querySelector(".bh-map").value,
        difficulty: host.querySelector(".bh-difficulty").value,
        devils: host.querySelector(".bh-devils").checked,
        friendlyFire: host.querySelector(".bh-friendly").checked,
        seed: Date.now() >>> 0,
      });
      ended = false;
      controls();
      hudAt = -1;
    }
    if (s.over) return;
    if (s.time === 0) hooks.onStart();
    running = true;
    menu.hidden = true;
    last = performance.now();
    acc = 0;
    arena.focus();
    frame = requestAnimationFrame(tick);
    hooks.onChange();
  }
  host.querySelector(".bh-new").onclick = () => {
    if (s.time > 0 && !s.over && !confirm("开始新局会替换当前战场存档，继续？"))
      return;
    start(true);
  };
  host.querySelector(".bh-resume").onclick = () => start(false);
  host.querySelector(".bh-pause").onclick = () =>
    running ? stop() : start(false);
  host.querySelector(".bh-full").onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shell.requestFullscreen();
    } catch (e) {
      host.querySelector(".bh-menu-note").textContent =
        "当前浏览器不支持全屏，可横屏游玩。";
    }
  };
  const handled = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "KeyQ",
    "KeyE",
    "KeyR",
    "Slash",
    "Comma",
    "Period",
    "Enter",
    "KeyP",
    "Digit0",
    "Digit1",
    "Digit2",
    "Digit3",
    "Digit4",
    "Digit5",
    "Digit6",
    "Digit7",
    "Digit8",
    "Digit9",
  ];
  on(arena, "keydown", (e) => {
    if (!handled.includes(e.code) || e.target.closest("select,input,button"))
      return;
    e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === "KeyP") {
      running ? stop() : start(false);
      return;
    }
    if (e.code.startsWith("Digit") && s.mode === "single")
      touch[0].weapon = (Number(e.code.slice(-1)) + 9) % 10;
    const id = s.mode === "single" ? 0 : 1;
    if (e.code === "KeyQ") touch[id].cycle = -1;
    if (e.code === "KeyE") touch[id].cycle = 1;
    if (e.code === "Comma") touch[0].cycle = -1;
    if (e.code === "Period") touch[0].cycle = 1;
  });
  on(window, "keyup", (e) => keys.delete(e.code));
  on(window, "blur", () => {
    if (running) stop();
  });
  function aim(e) {
    const r = canvas.getBoundingClientRect(),
      x = ((e.clientX - r.left) / r.width) * WIDTH,
      y = ((e.clientY - r.top) / r.height) * HEIGHT;
    mouse.angle = Math.atan2(y - s.players[0].y, x - s.players[0].x);
  }
  on(canvas, "pointerdown", (e) => {
    if (e.pointerType !== "mouse" || s.mode !== "single") return;
    canvas.setPointerCapture(e.pointerId);
    mouse.active = true;
    aim(e);
    arena.focus();
  });
  on(canvas, "pointermove", (e) => {
    if (mouse.active) aim(e);
  });
  on(canvas, "pointerup", () => (mouse.active = false));
  on(canvas, "pointercancel", () => (mouse.active = false));
  controls();
  draw();
  hud();
  hooks.onScore(s.mode === "versus" ? 0 : s.score);
  return {
    getState: () => structuredClone(s),
    pause: stop,
    destroy() {
      running = false;
      cancelAnimationFrame(frame);
      for (const off of listeners) off();
      if (document.fullscreenElement === shell)
        document.exitFullscreen().catch(hooks.onError);
      host.replaceChildren();
    },
  };
}
