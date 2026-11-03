import { initialState, step, validateState } from "./flappy-logic.js";
export const validate = validateState;
export function mount(host, hooks, saved) {
  let state = saved ? structuredClone(saved) : initialState();
  validate(state);
  let running = false,
    frame,
    last = 0;
  host.innerHTML = `<div class="playfield sky" tabindex="0" role="application" aria-label="纸翼：空格或点击振翅"><svg viewBox="0 0 420 580" aria-hidden="true"><defs><linearGradient id="flight-sky" x2="0" y2="1"><stop stop-color="#94c5d4"/><stop offset="1" stop-color="#e6edd8"/></linearGradient><linearGradient id="flight-gate"><stop stop-color="#497c68"/><stop offset=".3" stop-color="#7ea58a"/><stop offset="1" stop-color="#3a6656"/></linearGradient></defs><rect width="420" height="580" fill="url(#flight-sky)"/><circle cx="335" cy="105" r="42" fill="#fff1ba"/><circle cx="335" cy="105" r="56" fill="#fff1ba" opacity=".18"/><g fill="#f8fbef" opacity=".8"><path d="M-20 157q13-25 34-13q9-32 39-17q27-8 32 18q31-7 40 12Z"/><path d="M242 228q7-19 28-14q14-25 38-8q22-3 30 22Z"/></g><path d="M0 408Q90 325 180 405T420 380V540H0Z" fill="#a3c4aa"/><path d="M0 469Q100 386 190 453T420 433V540H0Z" fill="#7fa68f"/><path d="M0 511Q90 470 180 506T420 487V540H0Z" fill="#557e6c"/><path d="M0 540H420V580H0Z" fill="#ead9ae"/><path d="M0 540H420" stroke="#406752" stroke-width="6"/><g id="pipes"></g><g id="bird"><path d="M-16 0Q-14 -13 -2 -13Q10 -13 12 -3L20 1L11 5Q3 15 -9 10Z" fill="#e6a652" stroke="#825e38" stroke-width="1.5"/><path d="M-12 -2L3 1L-9 8Z" fill="#fff0cc"/><circle cx="6" cy="-7" r="2" fill="#29332e"/></g><text id="flight-score" x="210" y="64" text-anchor="middle" fill="#334b3c" font-size="38" font-family="monospace">0</text><text x="210" y="565" text-anchor="middle" fill="#516754" font-size="12" letter-spacing="1">纸翼 · 点击 / 空格振翅</text></svg><div class="game-overlay"><div class="flight-emblem" aria-hidden="true">01 / FLIGHT</div><p>纸翼</p><button class="primary start">${saved && !state.over ? "继续飞行" : "开始飞行"}</button><small>点击画面 / 空格振翅</small></div></div>`;
  const field = host.querySelector(".playfield"),
    overlay = host.querySelector(".game-overlay");
  const draw = () => {
    host
      .querySelector("#bird")
      .setAttribute(
        "transform",
        `translate(100 ${state.y}) rotate(${Math.min(70, Math.max(-25, state.velocity / 10))})`,
      );
    host.querySelector("#pipes").innerHTML = state.pipes
      .map(
        (p) =>
          `<path d="M${p.x} 0H${p.x + 56}V${p.gap - 82}H${p.x}ZM${p.x} ${p.gap + 82}H${p.x + 56}V540H${p.x}Z" fill="url(#flight-gate)" stroke="#365e4e" stroke-width="2"/><path d="M${p.x + 7} 0V${p.gap - 87}M${p.x + 7} ${p.gap + 88}V540" stroke="#b4d3ad" stroke-width="3" opacity=".55"/><rect x="${p.x}" y="${p.gap - 94}" width="56" height="12" rx="3" fill="#345d4d"/><rect x="${p.x}" y="${p.gap + 82}" width="56" height="12" rx="3" fill="#345d4d"/>`,
      )
      .join("");
    host.querySelector("#flight-score").textContent = state.score;
  };
  function stop() {
    running = false;
    cancelAnimationFrame(frame);
    overlay.hidden = false;
    host.querySelector(".start").textContent = state.over
      ? "再飞一次"
      : "继续飞行";
    overlay.querySelector("p").textContent = state.over
      ? `本次穿过 ${state.score} 道门`
      : "飞行已暂停";
  }
  function tick(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.025);
    last = now;
    step(state, dt);
    draw();
    hooks.onScore(state.score);
    if (state.over) {
      stop();
      hooks.onEnd(state.score);
      return;
    }
    frame = requestAnimationFrame(tick);
  }
  function start() {
    if (state.over) state = initialState();
    if (state.elapsed === 0) hooks.onStart();
    running = true;
    overlay.hidden = true;
    last = performance.now();
    state.velocity = -310;
    field.focus({ preventScroll: true });
    frame = requestAnimationFrame(tick);
  }
  function action(e) {
    if (e.type === "keydown" && e.code !== "Space") return;
    e.preventDefault();
    if (!running) {
      start();
      return;
    }
    state.velocity = -310;
  }
  const button = host.querySelector(".start");
  button.onclick = (e) => {
    e.stopPropagation();
    start();
  };
  field.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    if (running) action(e);
  });
  field.addEventListener("keydown", action);
  draw();
  hooks.onScore(state.score);
  return {
    getState: () => structuredClone(state),
    pause: () => {
      if (running) stop();
    },
    destroy: () => {
      running = false;
      cancelAnimationFrame(frame);
      field.removeEventListener("keydown", action);
    },
  };
}
