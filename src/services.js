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
  sessionStorage.setItem(
    "login-return",
    location.hash.startsWith("#/") ? location.hash : "#/",
  );
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
