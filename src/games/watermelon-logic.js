export const RADII = [12, 17, 23, 29, 36, 44, 53, 64, 76, 90, 105];
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
