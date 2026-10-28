const dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open("sumbon-games", 1);
  req.onupgradeneeded = () =>
    req.result.createObjectStore("saves", { keyPath: "id" });
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
export async function loadSave(id) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("saves", "readonly");
    const r = tx.objectStore("saves").get(id);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
/** 单页面持有游戏写入权，事务将进度和历史最高分一起提交。 */
export async function writeSave(game, state, score = 0) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("saves", "readwrite"),
      store = tx.objectStore("saves");
    const r = store.get(game.id);
    r.onsuccess = () => {
      if (r.result && r.result.saveVersion !== game.saveVersion) {
        tx.abort();
        return;
      }
      store.put({
        id: game.id,
        gameVersion: game.version,
        saveVersion: game.saveVersion,
        scoreVersion: game.scoreVersion,
        savedAt: new Date().toISOString(),
        state,
        best: Math.max(score, r.result?.best || 0),
      });
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error || new Error("存档版本不兼容，未覆盖原存档"));
    tx.onerror = () => reject(tx.error);
  });
}
export async function replaceSave(game, record) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("saves", "readwrite");
    const s = tx.objectStore("saves");
    if (record) s.put({ ...record, id: game.id });
    else s.delete(game.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function acquireGameLock(id) {
  if (!navigator.locks)
    throw new Error(
      "当前浏览器不支持存档互斥锁，请使用新版浏览器并通过 HTTPS 或 localhost 访问",
    );
  return new Promise((resolve, reject) => {
    navigator.locks
      .request("sumbon-game-" + id, { ifAvailable: true }, async (lock) => {
        if (!lock) {
          reject(new Error("该游戏已在另一个标签页打开，请先关闭那个页面"));
          return;
        }
        await new Promise((release) => resolve(release));
      })
      .catch(reject);
  });
}
export function exportSave(record) {
  const blob = new Blob([JSON.stringify(record, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${record.id}-${record.saveVersion}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
