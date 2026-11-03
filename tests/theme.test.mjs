import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../src/theme.js", import.meta.url),
  "utf8",
);
function setup(saved, dark) {
  const events = {},
    attrs = {},
    dataset = {},
    storage = new Map(saved ? [["site-theme", saved]] : []);
  const button = {
    setAttribute: (k, v) => (attrs[k] = v),
    addEventListener: (k, v) => (events[k] = v),
  };
  const media = {
    matches: dark,
    addEventListener: (_, fn) => (events.system = fn),
  };
  vm.runInNewContext(source, {
    window: {
      matchMedia: () => media,
      addEventListener: (k, v) => (events[k] = v),
    },
    document: {
      documentElement: { dataset },
      getElementById: () => button,
      addEventListener: (k, v) => (events[k] = v),
    },
    localStorage: {
      getItem: (k) => storage.get(k),
      setItem: (k, v) => storage.set(k, v),
    },
    console,
  });
  return { events, attrs, dataset, storage, media };
}
test("主题在首屏应用系统设置，手动切换持久化且不被系统覆盖", () => {
  const s = setup(null, true);
  assert.equal(s.dataset.theme, "dark");
  s.events.DOMContentLoaded();
  assert.equal(s.attrs["aria-checked"], "true");
  s.events.click();
  assert.equal(s.dataset.theme, "light");
  assert.equal(s.storage.get("site-theme"), "light");
  s.events.system();
  assert.equal(s.dataset.theme, "light");
});
test("保存偏好优先，并响应其他标签页切换", () => {
  const s = setup("dark", false);
  assert.equal(s.dataset.theme, "dark");
  s.events.storage({ key: "site-theme", newValue: "light" });
  assert.equal(s.dataset.theme, "light");
  s.events.storage({ key: "site-theme", newValue: null });
  s.media.matches = true;
  s.events.system();
  assert.equal(s.dataset.theme, "dark");
});
