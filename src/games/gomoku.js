import { winner, validateBoard, gameScore } from "./gomoku-logic.js";
export const validate = validateBoard;
export function mount(host, hooks, saved) {
  let state = saved
      ? structuredClone(saved)
      : { board: Array(225).fill(0), turn: 1, over: false },
    worker = null,
    paused = true;
  validate(state);
  host.innerHTML = `<div class="board-status" aria-live="polite"></div><div class="gomoku-board" role="grid" aria-label="十五路五子棋棋盘">${state.board.map((_, i) => `<button role="gridcell" class="intersection" data-i="${i}" aria-label="第 ${Math.floor(i / 15) + 1} 行，第 ${(i % 15) + 1} 列"></button>`).join("")}</div><div class="game-actions"><button class="primary resume">继续对弈</button><button class="quiet restart">重新开始</button><span>你执黑 · AI 执白</span></div>`;
  const cells = [...host.querySelectorAll(".intersection")],
    status = host.querySelector(".board-status"),
    resume = host.querySelector(".resume");
  function draw() {
    cells.forEach((c, i) => {
      c.dataset.stone = state.board[i];
      c.disabled = paused || state.over || state.turn !== 1 || !!state.board[i];
      c.setAttribute(
        "aria-label",
        `第 ${Math.floor(i / 15) + 1} 行，第 ${(i % 15) + 1} 列，${["空位", "黑子", "白子"][state.board[i]]}`,
      );
    });
    status.textContent = state.over
      ? resultText()
      : paused
        ? "棋局已保存，点击继续"
        : state.turn === 1
          ? "轮到你落子"
          : "AI 正在思考…";
    resume.hidden = !paused || state.over;
  }
  function resultText() {
    const win = state.board.map((_, i) => winner(state.board, i)).find(Boolean);
    return win === 1
      ? "你赢了。再来一局？"
      : win === 2
        ? "白棋获胜。下一局再试试。"
        : "和棋。";
  }
  function play(i) {
    if (!Number.isInteger(i) || i < 0 || i >= 225 || state.board[i]) return;
    state.board[i] = state.turn;
    const win = winner(state.board, i);
    if (win || state.board.every(Boolean)) {
      state.over = true;
      hooks.onEnd(gameScore(state.board, win));
    } else state.turn = state.turn === 1 ? 2 : 1;
    hooks.onChange();
    draw();
    if (!state.over && state.turn === 2 && !paused) think();
  }
  function think() {
    worker?.terminate();
    worker = new Worker(new URL("./gomoku-worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      worker.terminate();
      worker = null;
      if (!paused) play(data);
    };
    worker.onerror = (e) => {
      status.textContent = "AI 计算失败：" + e.message;
      paused = true;
      draw();
      hooks.onError(new Error(e.message));
    };
    worker.postMessage(state.board);
  }
  cells.forEach(
    (c, i) =>
      (c.onclick = () => {
        if (!paused && !state.over && state.turn === 1) play(i);
      }),
  );
  resume.onclick = () => {
    if (state.board.every((x) => x === 0)) hooks.onStart();
    paused = false;
    draw();
    if (state.turn === 2) think();
  };
  host.querySelector(".restart").onclick = () => {
    if (
      !state.over &&
      state.board.some(Boolean) &&
      !confirm("放弃当前棋局并重新开始？")
    )
      return;
    worker?.terminate();
    worker = null;
    state = { board: Array(225).fill(0), turn: 1, over: false };
    paused = false;
    hooks.onStart();
    hooks.onChange();
    draw();
  };
  draw();
  return {
    getState: () => structuredClone(state),
    pause: () => {
      paused = true;
      worker?.terminate();
      worker = null;
      draw();
    },
    destroy: () => {
      worker?.terminate();
    },
  };
}
