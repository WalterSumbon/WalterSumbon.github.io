import {
  loadSave,
  writeSave,
  replaceSave,
  acquireGameLock,
  exportSave,
} from "./storage.js";
import { submitScore, track } from "./services.js";
import { escapeHTML as esc } from "./content.js";
/** 负责写入存档及提交成绩，游戏模块只负责规则和画面。 */
export async function mountPlayer(host, game) {
  const release = await acquireGameLock(game.id);
  let player,
    timer,
    disposed = false,
    suspended = false,
    lastSnapshot = null,
    best = 0,
    queue = Promise.resolve();
  try {
    const module = await import(`./games/${game.module}.js`);
    let record = await loadSave(game.id);
    best = record?.best || 0;
    host.innerHTML = `<div class="player-layout"><div class="game-stage"></div><aside class="game-sidebar"><p class="eyebrow">${game.id} / v${game.version}</p><h2>这一局</h2><dl class="game-metrics"><div><dt>得分</dt><dd id="score">0</dd></div><div><dt>本机最高</dt><dd id="best">${best}</dd></div></dl><p>${esc(game.rules)}</p><button class="secondary pause">暂停并保存</button><div class="save-tools"><button class="quiet export">导出存档</button><label class="quiet import-label">导入存档<input class="import" type="file" accept="application/json,.json"></label><button class="quiet reset">新建存档</button></div><p class="save-status" role="status">存档保存在当前浏览器</p><p class="score-status" role="status"></p><button class="quiet upload">提交本机最高分</button><a href="#/rankings/${game.id}">查看本游戏排行榜 ↗</a></aside></div>`;
    const stage = host.querySelector(".game-stage"),
      status = host.querySelector(".save-status"),
      scoreStatus = host.querySelector(".score-status");
    const showError = (e) => {
      console.error(e);
      status.textContent = e.message;
      status.classList.add("error");
    };
    async function persist() {
      if (!player || disposed || suspended) return;
      const state = player.getState();
      const savedBest = best;
      const snapshot = JSON.stringify({ state, best: savedBest });
      if (snapshot === lastSnapshot) return;
      const pending = queue.then(() => writeSave(game, state, savedBest));
      queue = pending.catch(showError);
      await pending;
      lastSnapshot = snapshot;
      status.textContent = "已保存 · " + new Date().toLocaleTimeString("zh-CN");
      status.classList.remove("error");
    }
    async function upload() {
      const result = await submitScore(game, best);
      scoreStatus.textContent = {
        local: "全站榜尚未连接；成绩已保存在本机。",
        login: "请使用页面顶部的 GitHub 登录，再提交成绩。",
        sent: "成绩已提交，全站榜保留你的最高分。",
      }[result.status];
    }
    function launch(state) {
      lastSnapshot = null;
      player?.destroy();
      player = module.mount(
        stage,
        {
          onScore: (score) =>
            (host.querySelector("#score").textContent = score),
          onChange: () => {
            persist().catch(showError);
          },
          onError: showError,
          onStart: () => track("/play/" + game.id, game.title, true),
          onEnd: (score) => {
            best = Math.max(best, score);
            host.querySelector("#score").textContent = score;
            host.querySelector("#best").textContent = best;
            persist().then(upload).catch(showError);
          },
        },
        state,
      );
    }
    function inspect(r) {
      if (r && r.saveVersion !== game.saveVersion)
        throw new Error(
          `存档格式 ${r.saveVersion} 与当前 ${game.saveVersion} 不兼容。原存档已保留，请导出后再新建。`,
        );
      if (r && r.scoreVersion !== game.scoreVersion)
        throw new Error("计分规则已变化，请导出旧存档后新建。");
      if (r) module.validate(r.state);
    }
    try {
      inspect(record);
      launch(record?.state);
    } catch (e) {
      stage.innerHTML =
        '<div class="empty"><h2>存档需要处理</h2><p>' +
        esc(e.message) +
        "</p></div>";
      showError(e);
    }
    host.querySelector(".pause").onclick = () => {
      player?.pause();
      persist().catch(showError);
    };
    host.querySelector(".export").onclick = async () => {
      try {
        await persist();
        const r = await loadSave(game.id);
        if (!r) throw new Error("还没有存档");
        exportSave(r);
      } catch (e) {
        showError(e);
      }
    };
    host.querySelector(".reset").onclick = async () => {
      if (
        !confirm("清除本机存档和本机最高分？全站成绩不受影响。建议先导出备份。")
      )
        return;
      suspended = true;
      try {
        player?.pause();
        await queue;
        await replaceSave(game, null);
        best = 0;
        host.querySelector("#best").textContent = 0;
        host.querySelector("#score").textContent = 0;
        launch();
        suspended = false;
        await persist();
      } catch (e) {
        showError(e);
      } finally {
        suspended = false;
      }
    };
    host.querySelector(".import").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      suspended = true;
      player?.pause();
      try {
        const r = JSON.parse(await file.text());
        if (disposed) return;
        if (r.id !== game.id) throw new Error("这个存档属于另一个游戏");
        inspect(r);
        if (
          !Number.isFinite(r.best) ||
          r.best < 0 ||
          r.scoreVersion !== game.scoreVersion
        )
          throw new Error("存档成绩或计分版本不兼容");
        if (!confirm("用导入文件替换当前本机存档？")) return;
        await queue;
        await replaceSave(game, r);
        best = r.best;
        host.querySelector("#best").textContent = best;
        launch(r.state);
        status.textContent = "存档已导入";
      } catch (error) {
        showError(error);
      } finally {
        suspended = false;
        e.target.value = "";
      }
    };
    host.querySelector(".upload").onclick = () =>
      upload().catch((e) => {
        scoreStatus.textContent = "提交失败：" + e.message;
      });
    const visibility = () => {
      if (document.hidden) {
        player?.pause();
        persist().catch(showError);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    timer = setInterval(() => persist().catch(showError), 2000);
    return async () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      player?.pause();
      try {
        await persist();
        await queue;
      } finally {
        disposed = true;
        player?.destroy();
        release();
      }
    };
  } catch (e) {
    clearInterval(timer);
    player?.destroy();
    release();
    throw e;
  }
}
