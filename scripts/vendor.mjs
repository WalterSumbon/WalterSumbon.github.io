import { mkdir, cp, copyFile } from "node:fs/promises";
const copies = [
  ["marked/lib/marked.esm.js", "marked.js"],
  ["js-yaml/dist/browser/js-yaml.umd.min.js", "yaml.min.js"],
  ["dompurify/dist/purify.min.js", "purify.min.js"],
  ["matter-js/build/matter.min.js", "matter.min.js"],
  ["@supabase/supabase-js/dist/umd/supabase.js", "supabase.js"],
  ["@highlightjs/cdn-assets/highlight.min.js", "highlight/highlight.min.js"],
  ["@highlightjs/cdn-assets/styles/github.min.css", "highlight/github.min.css"],
];
for (const [from, to] of copies) {
  await mkdir("vendor/" + to.split("/").slice(0, -1).join("/"), {
    recursive: true,
  });
  await copyFile("node_modules/" + from, "vendor/" + to);
}
await cp("node_modules/katex/dist", "vendor/katex", { recursive: true });
for (const pkg of [
  "marked",
  "js-yaml",
  "dompurify",
  "katex",
  "matter-js",
  "@supabase/supabase-js",
  "@highlightjs/cdn-assets",
]) {
  const folder = "vendor/licenses/" + pkg.replaceAll("/", "-");
  await mkdir(folder, { recursive: true });
  const name = "LICENSE";
  await copyFile("node_modules/" + pkg + "/" + name, folder + "/LICENSE");
}
console.log("浏览器依赖已复制到 vendor/，站点无运行时 CDN 依赖。");
