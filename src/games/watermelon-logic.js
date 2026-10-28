export const RADII = [12, 17, 23, 29, 36, 44, 53, 64, 76, 90, 105];
export const COLORS = [
  "#b64d58",
  "#d66c77",
  "#986996",
  "#d69a52",
  "#dc7d3b",
  "#d8b650",
  "#b3bb64",
  "#8da16a",
  "#6e9861",
  "#5c8560",
  "#416d50",
];
export function mergeScore(newLevel) {
  return (newLevel + 1) ** 2;
}
export function validateState(s) {
  if (
    !s ||
    !Number.isFinite(s.score) ||
    s.score < 0 ||
    !Number.isInteger(s.next) ||
    s.next < 0 ||
    s.next > 3 ||
    !Array.isArray(s.fruits) ||
    typeof s.over !== "boolean"
  )
    throw new Error("西瓜存档格式不正确");
  for (const f of s.fruits)
    if (
      !Number.isInteger(f.level) ||
      f.level < 0 ||
      f.level >= RADII.length ||
      !["x", "y", "vx", "vy", "angle", "angularVelocity", "age"].every((k) =>
        Number.isFinite(f[k]),
      )
    )
      throw new Error("西瓜存档包含无效水果");
}
