import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {
  writeSave,
  loadSave,
  replaceSave,
  acquireGameLock,
} from "../src/storage.js";
const game = {
  id: "G001",
  version: "1.0.0",
  saveVersion: "1.0.0",
  scoreVersion: "1",
};
test("并发保存以事务保留最高分，旧版本不被覆盖", async () => {
  await Promise.all([
    writeSave(game, { step: 1 }, 10),
    writeSave(game, { step: 2 }, 3),
    writeSave(game, { step: 3 }, 7),
  ]);
  assert.equal((await loadSave(game.id)).best, 10);
  await assert.rejects(
    writeSave({ ...game, saveVersion: "2.0.0" }, { step: 4 }, 50),
    /版本不兼容/,
  );
  const r = await loadSave(game.id);
  assert.equal(r.saveVersion, "1.0.0");
  assert.equal(r.best, 10);
  await replaceSave(game, null);
  assert.equal(await loadSave(game.id), undefined);
});
test("同一游戏只允许一个页面持有存档写入权", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const held = new Set();
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        async request(name, options, callback) {
          if (held.has(name)) return callback(null);
          held.add(name);
          try {
            return await callback({ name });
          } finally {
            held.delete(name);
          }
        },
      },
    },
  });
  try {
    const release = await acquireGameLock("G002");
    await assert.rejects(acquireGameLock("G002"), /另一个标签页/);
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const release2 = await acquireGameLock("G002");
    release2();
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete globalThis.navigator;
  }
});
