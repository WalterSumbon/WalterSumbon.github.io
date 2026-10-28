export const BIRD = { x: 100, r: 13 };
export function collides(state) {
  if (state.y - BIRD.r < 0 || state.y + BIRD.r > 540) return true;
  return state.pipes.some(
    (p) =>
      BIRD.x + BIRD.r > p.x &&
      BIRD.x - BIRD.r < p.x + 56 &&
      (state.y - BIRD.r < p.gap - 82 || state.y + BIRD.r > p.gap + 82),
  );
}
export function step(state, dt, random = Math.random) {
  state.velocity += 920 * dt;
  state.y += state.velocity * dt;
  state.elapsed += dt;
  state.spawn -= dt;
  if (state.spawn <= 0) {
    state.pipes.push({ x: 440, gap: 130 + random() * 260, passed: false });
    state.spawn += 1.9;
  }
  for (const p of state.pipes) {
    p.x -= 145 * dt;
    if (!p.passed && p.x + 56 < BIRD.x - BIRD.r) {
      p.passed = true;
      state.score++;
    }
  }
  state.pipes = state.pipes.filter((p) => p.x > -60);
  if (collides(state)) state.over = true;
  return state;
}
export function initialState() {
  return {
    y: 270,
    velocity: 0,
    pipes: [],
    spawn: 1,
    elapsed: 0,
    score: 0,
    over: false,
  };
}
export function validateState(s) {
  if (
    !s ||
    !["y", "velocity", "spawn", "elapsed", "score"].every((k) =>
      Number.isFinite(s[k]),
    ) ||
    s.score < 0 ||
    !Array.isArray(s.pipes) ||
    s.pipes.some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.gap) ||
        typeof p.passed !== "boolean",
    ) ||
    typeof s.over !== "boolean"
  )
    throw new Error("纸翼存档格式不正确");
}
