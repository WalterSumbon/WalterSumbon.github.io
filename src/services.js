import { config } from "./config.js";
let client;
let analyticsReady = Promise.resolve();
const pendingEvents = [];
export function cloud() {
  if (!config.supabase.url || !config.supabase.publishableKey) return null;
  client ??= globalThis.supabase.createClient(
    config.supabase.url,
    config.supabase.publishableKey,
  );
  return client;
}
export async function signIn() {
  const c = cloud();
  if (!c) throw new Error("全站排行榜尚未连接");
  const { error } = await c.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: location.origin + "/#/rankings" },
  });
  if (error) throw error;
}
export async function session() {
  const c = cloud();
  if (!c) return null;
  const { data, error } = await c.auth.getSession();
  if (error) throw error;
  return data.session;
}
export async function submitScore(game, score) {
  const c = cloud();
  if (!c) return { status: "local" };
  if (!(await session())) return { status: "login" };
  const { error } = await c.rpc("submit_score", {
    game_id: game.id,
    game_version: game.version,
    score_version: game.scoreVersion,
    new_score: score,
  });
  if (error) throw error;
  return { status: "sent" };
}
export async function getRanking(id) {
  const c = cloud();
  if (!c) return null;
  const { data, error } = await c.rpc("get_ranking", {
    requested_game: id || null,
  });
  if (error) throw error;
  return data;
}
export function comments(container, key, legacy) {
  container.replaceChildren();
  if (!config.giscus.repoId || !config.giscus.categoryId) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent =
      "评论尚未连接。配置 Giscus 后，可使用 GitHub 登录、回复和添加反应。";
    container.append(p);
    if (legacy) {
      const a = document.createElement("a");
      a.href = `https://github.com/${config.repo}/issues/${legacy}`;
      a.textContent = "查看旧文章评论 ↗";
      a.target = "_blank";
      a.rel = "noopener";
      container.append(a);
    }
    return;
  }
  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  for (const [k, v] of Object.entries({
    repo: config.repo,
    "repo-id": config.giscus.repoId,
    category: config.giscus.category,
    "category-id": config.giscus.categoryId,
    mapping: "specific",
    term: key,
    strict: "1",
    "reactions-enabled": "1",
    "emit-metadata": "0",
    "input-position": "top",
    theme: "light",
    lang: "zh-CN",
    loading: "lazy",
  }))
    script.setAttribute("data-" + k, v);
  script.crossOrigin = "anonymous";
  script.async = true;
  container.append(script);
}
export function track(path, title, event = false) {
  if (
    !config.goatcounter ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"
  )
    return;
  if (globalThis.goatcounter?.count)
    globalThis.goatcounter.count({ path, title, event });
  else pendingEvents.push({ path, title, event });
}
export function initAnalytics() {
  if (!config.goatcounter) return;
  globalThis.goatcounter = { no_onload: true };
  const script = document.createElement("script");
  script.src = "https://gc.zgo.at/count.js";
  script.dataset.goatcounter = `https://${config.goatcounter}.goatcounter.com/count`;
  script.async = true;
  analyticsReady = new Promise((resolve, reject) => {
    script.onload = () => {
      for (const item of pendingEvents.splice(0))
        globalThis.goatcounter.count(item);
      resolve();
    };
    script.onerror = () => reject(new Error("访问统计脚本加载失败"));
  });
  analyticsReady.catch(console.error);
  document.head.append(script);
}
export async function visitorCount(path) {
  if (!config.goatcounter) return null;
  await analyticsReady;
  const r = await fetch(
    `https://${config.goatcounter}.goatcounter.com/counter/${encodeURIComponent(path)}.json`,
  );
  if (!r.ok) throw new Error(`统计服务返回 HTTP ${r.status}`);
  return (await r.json()).count;
}
