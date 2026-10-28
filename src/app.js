import { loadContent, renderMarkdown, escapeHTML as esc } from "./content.js";
import { config } from "./config.js";
import {
  initAnalytics,
  track,
  visitorCount,
  getRanking,
  cloud,
  session,
} from "./services.js";
import { mountComments } from "./comments.js";
import { initAccount } from "./account.js";
import { mountPlayer } from "./game-player.js";
let data,
  cleanup,
  routeQueue = Promise.resolve();
const main = document.querySelector("main"),
  url = (type, id) => `#/${type}/${encodeURIComponent(id)}`;
const date = (s) =>
  new Date(s).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
const tags = (p) =>
  p.tags
    .map(
      (t) =>
        `<a class="tag" href="#/blog?tag=${encodeURIComponent(t)}">${esc(t)}</a>`,
    )
    .join("");
const summary = (p) => {
  const element = document.createElement("div");
  element.innerHTML = renderMarkdown(p.body);
  return (element.querySelector("p")?.textContent || "").slice(0, 105);
};
const row = (p) =>
  `<article class="post-row"><time>${date(p.date)}</time><div><a class="post-link" href="${url("post", p.id)}">${esc(p.title)}</a><p>${esc(summary(p))}</p><div class="tags">${tags(p)}</div></div><a class="row-arrow" href="${url("post", p.id)}" aria-label="阅读 ${esc(p.title)}">↗</a></article>`;
function cover(g) {
  if (g.cover.type === "html")
    return `<iframe src="${esc(g.cover.src)}" title="${esc(g.title)}交互预览" loading="lazy" sandbox="allow-scripts allow-same-origin"></iframe>`;
  return `<a href="${url("game", g.id)}"><img src="${esc(g.cover.src)}" alt="${esc(g.title)}" loading="lazy"></a>`;
}
const card = (g) =>
  `<article class="game-card"><div class="game-cover">${cover(g)}</div><div class="game-card-info"><span class="eyebrow">${g.id} / ${esc(g.subtitle)}</span><h3><a href="${url("game", g.id)}">${esc(g.title)} <span>↗</span></a></h3><p>${esc(g.description)}</p><span class="muted small">${g.tags.map(esc).join(" · ")} · v${g.version}</span></div></article>`;
const collectionCard = (c) =>
  `<a class="collection-row" href="${url("collection", c.id)}"><span class="eyebrow">${c.type === "posts" ? "文章集" : "游戏集"} / ${String(c.items.length).padStart(2, "0")}</span><h3>${esc(c.title)} <span>↗</span></h3><p>${esc(c.description)}</p></a>`;
function home() {
  main.innerHTML = `<section class="intro"><div><p class="eyebrow">夏寒的个人站点</p><h1>写下思考，<br>留一点时间玩。</h1><p class="intro-note">算法工程师。研究语言模型与 Agent，<br>也记录计算机、数学，以及游戏里的问题。</p></div><div class="intro-index"><span>这里有</span><a href="#/blog"><b>01</b> 文章 <small>${data.posts.length} 篇</small></a><a href="#/games"><b>02</b> 游戏室 <small>${data.games.length} 个</small></a></div></section><section><div class="section-heading"><h2>最近的文章</h2><a href="#/blog">全部文章 ↗</a></div><div class="post-list">${data.posts.slice(0, 3).map(row).join("")}</div></section><section class="home-games"><div class="section-heading"><h2>离开文字，玩一会儿</h2><a href="#/games">进入游戏室 ↗</a></div><div class="game-grid">${data.games.map(card).join("")}</div></section>`;
}
function blog(query) {
  const selected = new URLSearchParams(query).get("tag");
  const allTags = [...new Set(data.posts.flatMap((p) => p.tags))];
  const posts = selected
    ? data.posts.filter((p) => p.tags.includes(selected))
    : data.posts;
  main.innerHTML = `<section class="page-heading"><p class="eyebrow">文字档案 / ${data.posts.length}</p><h1>文章</h1><p>把想清楚的事记录下来，也给未解的问题留个位置。</p></section><div class="filter-tags"><a class="tag ${!selected ? "selected" : ""}" href="#/blog">全部</a>${allTags.map((t) => `<a class="tag ${t === selected ? "selected" : ""}" href="#/blog?tag=${encodeURIComponent(t)}">${esc(t)}</a>`).join("")}</div><div class="post-list">${posts.length ? posts.map(row).join("") : '<p class="empty">这个标签下还没有文章。</p>'}</div>`;
}
async function post(id) {
  const p = data.posts.find((p) => p.id === id);
  if (!p) throw new Error("没有找到这篇文章");
  document.title = p.title + " · Sumbon";
  const groups = data.collections.filter(
    (c) => c.type === "posts" && c.items.includes(id),
  );
  main.innerHTML = `<div class="article-layout"><article class="article"><a class="back" href="#/blog">← 所有文章</a><header class="article-header"><div class="tags">${tags(p)}</div><h1>${esc(p.title)}</h1><p class="article-meta">${esc(p.author)} <span>·</span> 发布于 ${date(p.date)} <span>·</span> 更新于 ${date(p.updated || p.date)}</p><span class="muted small" id="visits"></span></header><div class="prose">${renderMarkdown(p.body)}</div><div class="article-end"><span>— 本文完 —</span><a href="/content/posts/${encodeURIComponent(p.file)}" download>下载 Markdown ↗</a></div>${groups
    .map((c) => {
      const i = c.items.indexOf(id);
      return `<div class="series"><a href="${url("collection", c.id)}">${esc(c.title)} / ${i + 1} of ${c.items.length}</a><div>${i > 0 ? `<a href="${url("post", c.items[i - 1])}">← 上一篇</a>` : ""}${i < c.items.length - 1 ? `<a href="${url("post", c.items[i + 1])}">下一篇 →</a>` : ""}</div></div>`;
    })
    .join(
      "",
    )}<section class="comments-section"><h2>讨论</h2><div id="comments"></div></section></article><aside class="toc"><p class="eyebrow">本文目录</p><nav></nav></aside></div>`;
  main
    .querySelectorAll(".prose pre code")
    .forEach((el) => globalThis.hljs.highlightElement(el));
  let n = 0;
  const toc = main.querySelector(".toc nav");
  main.querySelectorAll(".prose h2,.prose h3").forEach((h) => {
    h.id = "section-" + n++;
    const a = document.createElement("a");
    a.href = "#" + h.id;
    a.textContent = h.textContent;
    a.onclick = (e) => {
      e.preventDefault();
      h.scrollIntoView({ behavior: "smooth" });
    };
    toc.append(a);
  });
  cleanup = await mountComments(
    main.querySelector("#comments"),
    "post:" + p.id,
  );
  const path = "/post/" + id;
  track(path, p.title);
  const visits = main.querySelector("#visits");
  try {
    const count = await visitorCount(path);
    if (count !== null) visits.textContent = count + " 次访问";
  } catch (e) {
    visits.textContent = "访问统计暂不可用";
    console.error(e);
  }
}
function collections() {
  main.innerHTML = `<section class="page-heading"><p class="eyebrow">按主题整理</p><h1>文章集</h1><p>同一篇文章，可以出现在不同的阅读路径里。</p></section><div class="collection-list">${data.collections
    .filter((c) => c.type === "posts")
    .map(collectionCard)
    .join("")}</div>`;
}
function collection(id) {
  const c = data.collections.find((c) => c.id === id);
  if (!c) throw new Error("没有找到这个集合");
  const items = c.items.map((id) =>
    (c.type === "posts" ? data.posts : data.games).find((x) => x.id === id),
  );
  main.innerHTML = `<section class="page-heading"><a class="back" href="${c.type === "posts" ? "#/collections" : "#/games"}">← ${c.type === "posts" ? "文章集" : "游戏室"}</a><p class="eyebrow">${c.type === "posts" ? "文章集" : "游戏集"} / ${c.items.length}</p><h1>${esc(c.title)}</h1><p>${esc(c.description)}</p></section><div class="${c.type === "posts" ? "ordered-posts" : "game-grid"}">${items.map((x, i) => (c.type === "posts" ? `<div class="ordered-item"><span>${String(i + 1).padStart(2, "0")}</span>${row(x)}</div>` : card(x))).join("")}</div>`;
}
function games() {
  main.innerHTML = `<section class="page-heading games-heading"><div><p class="eyebrow">小小游乐场 / PLAYROOM</p><h1>再玩一局。</h1><p>不用下载，打开就能玩。进度自动留在这个浏览器里。</p></div><a href="#/rankings">看看排行榜 ↗</a></section><div class="game-grid">${data.games.map(card).join("")}</div><section><div class="section-heading"><h2>游戏集</h2></div><div class="collection-list">${data.collections
    .filter((c) => c.type === "games")
    .map(collectionCard)
    .join("")}</div></section>`;
}
async function game(id) {
  const g = data.games.find((x) => x.id === id);
  if (!g) throw new Error("没有找到这个游戏");
  main.innerHTML = `<section class="game-page-heading"><a class="back" href="#/games">← 游戏室</a><h1>${esc(g.title)}</h1><p>${esc(g.description)}</p></section><div id="player"><p class="loading">正在读取本机存档…</p></div><section class="comments-section"><h2>这一局，怎么样？</h2><div id="comments"></div></section>`;
  const closeComments = await mountComments(
    main.querySelector("#comments"),
    "game:" + id,
  );
  try {
    const closeGame = await mountPlayer(main.querySelector("#player"), g);
    cleanup = async () => {
      closeComments();
      await closeGame();
    };
  } catch (e) {
    closeComments();
    throw e;
  }
}
async function rankings(id) {
  main.innerHTML = `<section class="page-heading"><p class="eyebrow">记下你的最好一局</p><h1>排行榜</h1><p>总分 = 各游戏最高分 × 对应系数，再相加。${data.games.map((g) => esc(g.title) + " × " + g.coefficient).join("；")}。</p></section><nav class="rank-tabs"><a class="tag ${!id ? "selected" : ""}" href="#/rankings">总榜</a>${data.games.map((g) => `<a class="tag ${id === g.id ? "selected" : ""}" href="${url("rankings", g.id)}">${esc(g.title)}</a>`).join("")}</nav><div class="auth-area"></div><div class="rank-content"><p class="loading">正在读取排行榜…</p></div>`;
  const area = main.querySelector(".rank-content"),
    auth = main.querySelector(".auth-area");
  if (!cloud()) {
    area.innerHTML =
      '<div class="empty"><span class="eyebrow">尚未连接</span><h2>全站排行榜还没有启用</h2><p>游戏可以正常游玩，本机最高分会自动保存。连接排行榜后，使用 GitHub 登录即可提交。</p></div>';
    return;
  }
  auth.textContent = "使用顶部账号登录后，可在游戏页面提交成绩。";
  const ranks = await getRanking(id);
  area.innerHTML = ranks.length
    ? `<table class="rank-table"><thead><tr><th>名次</th><th>玩家</th><th>${id ? "最高分" : "总分"}</th></tr></thead><tbody>${ranks.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.username)}</td><td>${Number(r.score).toLocaleString("zh-CN")}</td></tr>`).join("")}</tbody></table>`
    : '<div class="empty"><h2>第一名，留给第一位玩家。</h2><p>完成一局并登录提交成绩，就会出现在这里。</p></div>';
}
async function route() {
  if (search.open) search.close();
  if (cleanup) {
    const old = cleanup;
    cleanup = null;
    await old();
  }
  const hash = location.hash.slice(1) || "/",
    [path, query] = hash.split("?"),
    parts = path.split("/").filter(Boolean),
    id = parts[1] ? decodeURIComponent(parts[1]) : null;
  document.title = "Sumbon · 文章与游戏";
  document
    .querySelectorAll(".site-header nav a")
    .forEach((a) =>
      a.setAttribute(
        "aria-current",
        a.hash === `#/${parts[0]}` ? "page" : "false",
      ),
    );
  try {
    switch (parts[0]) {
      case undefined:
        home();
        break;
      case "blog":
        blog(query);
        break;
      case "post":
        await post(id);
        break;
      case "collections":
        collections();
        break;
      case "collection":
        collection(id);
        break;
      case "games":
        games();
        break;
      case "game":
        await game(id);
        break;
      case "rankings":
        await rankings(id);
        break;
      default:
        throw new Error("这个页面不存在");
    }
    if (parts[0] !== "post") track(path, document.title);
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="empty error"><h1>页面未能打开</h1><p>${esc(e.message)}</p><a href="#/">返回首页</a></div>`;
  }
}
const search = document.querySelector("#search-dialog"),
  input = document.querySelector("#search-input"),
  results = document.querySelector("#search-results");
function searchPosts() {
  const terms = input.value
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!data) return;
  const matches = terms.length
    ? data.posts.filter((p) =>
        terms.every((t) =>
          [p.title, p.body, ...p.tags]
            .join(" ")
            .toLocaleLowerCase()
            .includes(t),
        ),
      )
    : [];
  results.innerHTML = terms.length
    ? matches.length
      ? matches
          .map(
            (p) =>
              `<a class="search-result" href="${url("post", p.id)}"><b>${esc(p.title)}</b><span>${esc(summary(p))}</span></a>`,
          )
          .join("")
      : "<p>没有找到匹配文章，试试更短的关键词。</p>"
    : '<p class="muted">可以搜索正文，也可以输入多个关键词。</p>';
}
document.querySelector("#search-toggle").onclick = () => {
  search.showModal();
  input.focus();
  searchPosts();
};
input.oninput = searchPosts;
results.onclick = (e) => {
  if (e.target.closest("a")) search.close();
};
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    search.showModal();
    input.focus();
    searchPosts();
  }
});
window.addEventListener("message", (e) => {
  if (
    e.origin === location.origin &&
    e.data?.type === "open-game" &&
    data?.games.some((g) => g.id === e.data.id)
  )
    location.hash = url("game", e.data.id);
});
try {
  const authCallback = /access_token=|[?&]code=/.test(
    location.hash + location.search,
  );
  if (cloud()) await session();
  if (authCallback) {
    const target = sessionStorage.getItem("login-return") || "#/rankings";
    sessionStorage.removeItem("login-return");
    history.replaceState(
      null,
      "",
      "/" + (target.startsWith("#/") ? target : "#/"),
    );
  }
  await initAccount(document.querySelector("#account"));
  const loginError =
    new URLSearchParams(location.search).get("error_description") ||
    new URLSearchParams(location.hash.slice(1)).get("error_description");
  if (loginError) {
    const notice = document.createElement("span");
    notice.role = "alert";
    notice.textContent = "登录未完成：" + loginError + "。请重新点击登录。";
    document.querySelector("#account").append(notice);
    history.replaceState(
      null,
      "",
      "/" + (location.hash.startsWith("#/") ? location.hash : "#/"),
    );
  }
  data = await loadContent();
  const legacy = new URLSearchParams(location.search).get("legacy");
  if (legacy) {
    const p = data.posts.find(
      (p) => p.legacyPath === decodeURIComponent(legacy),
    );
    history.replaceState(null, "", "/" + (p ? url("post", p.id) : "#/missing"));
  }
  initAnalytics();
  await route();
  window.addEventListener("hashchange", () => {
    routeQueue = routeQueue.then(route).catch((e) => {
      console.error(e);
      main.textContent = "页面切换失败：" + e.message;
    });
  });
} catch (e) {
  console.error(e);
  main.innerHTML = `<div class="empty error"><h1>内容加载失败</h1><p>${esc(e.message)}</p><button class="secondary" onclick="location.reload()">重新加载</button></div>`;
}
