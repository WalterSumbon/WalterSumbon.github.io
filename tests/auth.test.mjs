import test from "node:test";
import assert from "node:assert/strict";
import { signIn } from "../src/services.js";

test("登录使用无片段回调，单独保存原页面以便恢复", async () => {
  const original = Object.fromEntries(
    ["location", "sessionStorage", "supabase"].map((k) => [k, globalThis[k]]),
  );
  let request;
  const saved = new Map();
  globalThis.location = {
    origin: "https://waltersumbon.github.io",
    hash: "#/game/G004",
  };
  globalThis.sessionStorage = { setItem: (k, v) => saved.set(k, v) };
  globalThis.supabase = {
    createClient: () => ({
      auth: {
        signInWithOAuth: async (value) => {
          request = value;
          return { error: null };
        },
      },
    }),
  };
  try {
    await signIn();
    assert.equal(request.provider, "github");
    assert.equal(request.options.redirectTo, "https://waltersumbon.github.io/");
    assert.equal(saved.get("login-return"), "#/game/G004");
  } finally {
    for (const [k, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[k];
      else globalThis[k] = value;
    }
  }
});
