import { confirmAction } from "../dialog.js";
import { winner, validateBoard, gameScore } from "./gomoku-logic.js";
import { createStoneSound } from "./stone-sound.js";
export const validate = validateBoard;
export function mount(host, hooks, saved) {
  let state = saved
      ? structuredClone(saved)
      : { board: Array(225).fill(0), turn: 1, over: false },
    worker = null,
    paused = true,
    lastMove = null;
  validate(state);
  state.player ??= 1;
  const sound = createStoneSound();
  host.innerHTML = `<div class="board-status" aria-live="polite"></div><div class="gomoku-board" role="grid" aria-label="十五路五子棋棋盘">${state.board.map((_, i) => `<button role="gridcell" class="intersection ${[48, 56, 112, 168, 176].includes(i) ? "star" : ""}" tabindex="${i === 112 ? 0 : -1}" data-i="${i}" aria-label="第 ${Math.floor(i / 15) + 1} 行，第 ${(i % 15) + 1} 列"></button>`).join("")}</div><div class="game-actions"><button class="primary resume">继续对弈</button><button class="quiet restart">重新开始</button><label>新局执子 <select class="player-color"><option value="1">执黑 · 先手</option><option value="2">执白 · 后手</option></select></label><button class="quiet sound-toggle" aria-pressed="true">音效：开</button></div>`;
  const cells = [...host.querySelectorAll(".intersection")],
    status = host.querySelector(".board-status"),
    resume = host.querySelector(".resume");
  const color = host.querySelector(".player-color");
  color.value = String(state.player);
  let audible = true;
  const soundButton = host.querySelector(".sound-toggle");
  soundButton.onclick = () => {
    audible = !audible;
    soundButton.setAttribute("aria-pressed", String(audible));
    soundButton.textContent = `音效：${audible ? "开" : "关"}`;
    if (audible) sound.unlock();
  };
  function draw() {
    cells.forEach((c, i) => {
      c.dataset.stone = state.board[i];
      c.classList.toggle("last-move", i === lastMove);
      c.disabled =
        paused || state.over || state.turn !== state.player || !!state.board[i];
      c.setAttribute(
        "aria-label",
        `第 ${Math.floor(i / 15) + 1} 行，第 ${(i % 15) + 1} 列，${["空位", "黑子", "白子"][state.board[i]]}`,
      );
    });
    if (!cells.some((c) => !c.disabled && c.tabIndex === 0)) {
      const available = !cells[112].disabled
        ? cells[112]
        : cells.find((c) => !c.disabled);
      if (available) {
        cells.forEach((c) => (c.tabIndex = -1));
        available.tabIndex = 0;
      }
    }
    status.textContent = state.over
      ? resultText()
      : paused
        ? "棋局已保存，点击继续"
        : state.turn === state.player
          ? `你执${state.player === 1 ? "黑" : "白"} · 轮到你落子`
          : "AI 正在思考…";
    resume.hidden = !paused || state.over;
  }
  function resultText() {
    const win = state.board.map((_, i) => winner(state.board, i)).find(Boolean);
    return win === state.player
      ? "你赢了。再来一局？"
      : win !== 0
        ? "AI 获胜。下一局再试试。"
        : "和棋。";
  }
  function play(i) {
    if (!Number.isInteger(i) || i < 0 || i >= 225 || state.board[i]) return;
    state.board[i] = state.turn;
    lastMove = i;
    if (audible) sound.play();
    const win = winner(state.board, i);
    if (win || state.board.every(Boolean)) {
      state.over = true;
      hooks.onEnd(gameScore(state.board, win, state.player));
    } else state.turn = state.turn === 1 ? 2 : 1;
    hooks.onChange();
    draw();
    if (!state.over && state.turn !== state.player && !paused) think();
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
    worker.postMessage({ board: state.board, ai: state.player === 1 ? 2 : 1 });
  }
  cells.forEach(
    (c, i) =>
      (c.onclick = () => {
        if (!paused && !state.over && state.turn === state.player) {
          sound.unlock();
          play(i);
        }
      }),
  );
  const board = host.querySelector(".gomoku-board");
  const navigate = (event) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -15, ArrowDown: 15 };
    if (!(event.code in moves)) return;
    event.preventDefault();
    const index = Number(event.target.dataset.i);
    let next = index + moves[event.code];
    while (next >= 0 && next < 225 && cells[next].disabled)
      next += moves[event.code];
    if (
      next < 0 ||
      next >= 225 ||
      (Math.abs(moves[event.code]) === 1 &&
        Math.floor(next / 15) !== Math.floor(index / 15))
    )
      return;
    cells.forEach((c) => (c.tabIndex = -1));
    cells[next].tabIndex = 0;
    cells[next].focus();
  };
  board.addEventListener("keydown", navigate);
  resume.onclick = () => {
    sound.unlock();
    if (state.board.every((x) => x === 0)) hooks.onStart();
    paused = false;
    draw();
    if (state.turn !== state.player) think();
  };
  async function restart() {
    sound.unlock();
    if (
      !state.over &&
      state.board.some(Boolean) &&
      !(await confirmAction("放弃当前棋局并重新开始？"))
    )
      return;
    worker?.terminate();
    worker = null;
    state = {
      board: Array(225).fill(0),
      turn: 1,
      over: false,
      player: Number(color.value),
    };
    paused = false;
    lastMove = null;
    hooks.onStart();
    hooks.onScore(0);
    hooks.onChange();
    draw();
    if (state.turn !== state.player) think();
  }
  host.querySelector(".restart").onclick = restart;
  color.onchange = async () => {
    await restart();
    color.value = String(state.player);
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
      sound.destroy();
      board.removeEventListener("keydown", navigate);
      worker?.terminate();
    },
  };
}
