import test from "node:test";
import assert from "node:assert/strict";
import { visitorCount } from "../src/services.js";

test("访问计数区分正常计数、尚无记录与服务故障", async () => {
  const original = globalThis.fetch;
  let response;
  globalThis.fetch = async (url) => {
    assert.equal(
      url,
      "https://waltersumbon.goatcounter.com/counter/%2Fpost%2F%E6%96%87%E7%AB%A0.json",
    );
    return response;
  };
  try {
    response = new Response(JSON.stringify({ count: "1,234" }));
    assert.equal(await visitorCount("/post/文章"), "1,234");
    response = new Response(JSON.stringify({ count_unique: "0", count: "0" }), {
      status: 404,
    });
    assert.equal(await visitorCount("/post/文章"), "0");
    response = new Response(JSON.stringify({ error: "disabled" }), {
      status: 403,
    });
    await assert.rejects(visitorCount("/post/文章"), /HTTP 403/);
    response = new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
    });
    await assert.rejects(visitorCount("/post/文章"), /HTTP 404/);
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    await assert.rejects(visitorCount("/post/文章"), /Failed to fetch/);
  } finally {
    globalThis.fetch = original;
  }
});
