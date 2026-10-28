export const SIZE = 15;
const dirs = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];
const inside = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
export function winner(board, index) {
  const who = board[index];
  if (!who) return 0;
  const x = index % SIZE,
    y = Math.floor(index / SIZE);
  for (const [dx, dy] of dirs) {
    let count = 1;
    for (const sign of [-1, 1]) {
      let a = x + dx * sign,
        b = y + dy * sign;
      while (inside(a, b) && board[b * SIZE + a] === who) {
        count++;
        a += dx * sign;
        b += dy * sign;
      }
    }
    if (count >= 5) return who;
  }
  return 0;
}
function evaluate(board, index, who) {
  const x = index % SIZE,
    y = Math.floor(index / SIZE);
  let value = 0;
  for (const [dx, dy] of dirs) {
    let n = 1,
      open = 0;
    for (const sign of [-1, 1]) {
      let a = x + dx * sign,
        b = y + dy * sign;
      while (inside(a, b) && board[b * SIZE + a] === who) {
        n++;
        a += dx * sign;
        b += dy * sign;
      }
      if (inside(a, b) && board[b * SIZE + a] === 0) open++;
    }
    value +=
      n >= 5
        ? 1e8
        : n === 4
          ? open === 2
            ? 1e6
            : open
              ? 70000
              : 0
          : n === 3
            ? open === 2
              ? 12000
              : open
                ? 1000
                : 0
            : n === 2
              ? open === 2
                ? 500
                : open
                  ? 50
                  : 0
              : open * 3;
  }
  return value;
}
function candidates(board) {
  if (board.every((x) => !x)) return [112];
  const result = new Set();
  board.forEach((v, i) => {
    if (!v) return;
    const x = i % SIZE,
      y = Math.floor(i / SIZE);
    for (let a = -2; a <= 2; a++)
      for (let b = -2; b <= 2; b++)
        if (inside(x + a, y + b) && !board[(y + b) * SIZE + x + a])
          result.add((y + b) * SIZE + x + a);
  });
  return [...result];
}
/** 优先取胜、封堵，再对候选位置进行两层攻防搜索。 */
export function chooseMove(board) {
  const moves = candidates(board);
  if (!moves.length) return -1;
  for (const who of [2, 1]) {
    for (const i of moves) {
      board[i] = who;
      const won = winner(board, i);
      board[i] = 0;
      if (won) return i;
    }
  }
  const ranked = moves
    .map((i) => ({
      i,
      score: evaluate(board, i, 2) + evaluate(board, i, 1) * 1.1,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  let best = -Infinity,
    choice = ranked[0].i;
  for (const { i, score } of ranked) {
    board[i] = 2;
    let danger = 0;
    for (const j of candidates(board))
      danger = Math.max(danger, evaluate(board, j, 1));
    board[i] = 0;
    const value = score - danger * 0.8;
    if (value > best) {
      best = value;
      choice = i;
    }
  }
  return choice;
}
export function validateBoard(state) {
  if (
    !state ||
    !Array.isArray(state.board) ||
    state.board.length !== 225 ||
    state.board.some((x) => ![0, 1, 2].includes(x)) ||
    ![1, 2].includes(state.turn) ||
    typeof state.over !== "boolean"
  )
    throw new Error("五子棋存档格式不正确");
  const black = state.board.filter((x) => x === 1).length,
    white = state.board.filter((x) => x === 2).length;
  if (black < white || black > white + 1)
    throw new Error("五子棋存档棋子数量不合法");
}
export function gameScore(board, who) {
  return who === 1
    ? 1000 - board.filter((x) => x === 1).length
    : who === 0
      ? 100
      : 0;
}
