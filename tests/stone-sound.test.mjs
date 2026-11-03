import test from "node:test";
import assert from "node:assert/strict";
import { createStoneSound } from "../src/games/stone-sound.js";

test("落子音效由交互初始化，每次发声限时并释放音频节点", () => {
  const oscillators = [];
  let created = 0,
    closed = 0,
    disconnected = 0;
  const parameter = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  class AudioContext {
    state = "running";
    currentTime = 3;
    constructor() {
      created++;
    }
    createOscillator() {
      const node = {
        frequency: parameter,
        connect(gain) {
          return gain;
        },
        start(at) {
          this.started = at;
        },
        stop(at) {
          this.stopped = at;
        },
        disconnect() {
          disconnected++;
        },
      };
      oscillators.push(node);
      return node;
    }
    createGain() {
      return {
        gain: parameter,
        connect() {},
        disconnect() {
          disconnected++;
        },
      };
    }
    close() {
      closed++;
      return Promise.resolve();
    }
  }
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = AudioContext;
  try {
    const sound = createStoneSound();
    sound.play();
    assert.equal(created, 0);
    sound.unlock();
    sound.unlock();
    sound.play();
    assert.equal(created, 1);
    assert.equal(oscillators.length, 3);
    for (const node of oscillators) {
      assert.equal(node.started, 3);
      assert.equal(node.stopped, 3.1);
      node.onended();
    }
    assert.equal(disconnected, 6);
    sound.destroy();
    assert.equal(closed, 1);
  } finally {
    if (previous === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = previous;
  }
});
