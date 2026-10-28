import { marked } from "../vendor/marked.js";
/** 使用词法扩展解析公式，代码围栏与行内代码由 Markdown 解析器隔离。 */
marked.use({
  gfm: true,
  extensions: [
    {
      name: "blockMath",
      level: "block",
      start: (s) => s.search(/\\\[|\$\$/),
      tokenizer(s) {
        const m = /^(?:\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$)(?:\n|$)/.exec(s);
        if (m) return { type: "blockMath", raw: m[0], text: m[1] ?? m[2] };
      },
      renderer: (t) =>
        globalThis.katex.renderToString(t.text, {
          displayMode: true,
          throwOnError: true,
          strict: "ignore",
        }),
    },
    {
      name: "inlineMath",
      level: "inline",
      start: (s) => s.search(/\\\(|\$/),
      tokenizer(s) {
        const m = /^(?:\\\(([^\n]*?)\\\)|\$([^$\n]+?)\$(?!\$))/.exec(s);
        if (m) return { type: "inlineMath", raw: m[0], text: m[1] ?? m[2] };
      },
      renderer: (t) =>
        globalThis.katex.renderToString(t.text, {
          displayMode: false,
          throwOnError: true,
          strict: "ignore",
        }),
    },
  ],
});
export function parsePost(text, file) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`${file} 缺少 YAML 文件头`);
  const meta = globalThis.jsyaml.load(match[1], {
    schema: globalThis.jsyaml.JSON_SCHEMA,
  });
  for (const k of ["id", "title", "date", "author"])
    if (typeof meta[k] !== "string" || !meta[k].trim())
      throw new Error(`${file} 缺少 ${k}`);
  if (!Array.isArray(meta.tags) || meta.tags.some((x) => typeof x !== "string"))
    throw new Error(`${file} 的 tags 必须是字符串列表`);
  if (!Number.isFinite(Date.parse(meta.date)))
    throw new Error(`${file} 日期无效`);
  return { ...meta, body: match[2], file };
}
export function compileMarkdown(body) {
  return marked.parse(body);
}
export function renderMarkdown(body) {
  return globalThis.DOMPurify.sanitize(compileMarkdown(body), {
    ADD_TAGS: ["annotation"],
    ADD_ATTR: ["encoding"],
  });
}
export async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}：HTTP ${r.status}`);
  return r.json();
}
export async function loadContent() {
  const [files, games, collections] = await Promise.all(
    [
      "/content/index.json",
      "/content/games.json",
      "/content/collections.json",
    ].map(fetchJSON),
  );
  const posts = await Promise.all(
    files.map(async (file) => {
      const r = await fetch("/content/posts/" + encodeURIComponent(file));
      if (!r.ok) throw new Error(`${file}：HTTP ${r.status}`);
      return parsePost(await r.text(), file);
    }),
  );
  posts.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return { posts, games, collections };
}
export const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
