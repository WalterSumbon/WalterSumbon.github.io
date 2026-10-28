import { initialState, step, validateState } from "./flappy-logic.js";
export const validate = validateState;
export function mount(host, hooks, saved) {
  let state = saved ? structuredClone(saved) : initialState();
  validate(state);
  let running = false,
    frame,
    last = 0;
  host.innerHTML = `<div class="playfield sky" tabindex="0" role="application" aria-label="纸翼：空格或点击振翅"><svg viewBox="0 0 420 580" aria-hidden="true"><defs><pattern id="paper-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#d8e2d7" stroke-width=".6"/></pattern></defs><rect width="420" height="580" fill="#eaf0e6"/><rect width="420" height="540" fill="url(#paper-grid)"/><path d="M0 540H420" stroke="#708373"/><g id="pipes"></g><g id="bird"><path d="M-19 -5L19 0L-10 14L-5 2Z" fill="#b65a37" stroke="#6b382a" stroke-width="1.5"/><path d="M-19 -5L-5 2L19 0" fill="none" stroke="#f5d5a7"/></g><text id="flight-score" x="210" y="64" text-anchor="middle" fill="#334b3c" font-size="38" font-family="monospace">0</text><text x="210" y="565" text-anchor="middle" fill="#516754" font-size="12" letter-spacing="3">PAPER FLIGHT</text></svg><div class="game-overlay"><p>让纸翼飞起来</p><button class="primary start">${saved && !state.over ? "继续飞行" : "开始飞行"}</button><small>点击画面 / 空格振翅</small></div></div>`;
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
          `<path d="M${p.x} 0H${p.x + 56}V${p.gap - 82}H${p.x}ZM${p.x} ${p.gap + 82}H${p.x + 56}V540H${p.x}Z" fill="#849982" stroke="#536f56" stroke-width="1.5"/>`,
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
