import { cloud, session, signIn } from "./services.js";
import { escapeHTML as esc, renderMarkdown } from "./content.js";
/** 评论的读取、编辑和投票均调用受权限约束的数据库函数。 */
export async function mountComments(host, thread) {
  let disposed = false,
    generation = 0,
    rows = [],
    user = null,
    reply = null,
    edit = null;
  const draftKey = "comment-draft:" + thread;
  host.innerHTML =
    '<div class="page-votes"></div><form class="comment-form"><label>写下你的想法 <small>支持 Markdown 和公式</small></label><p class="reply-context"></p><textarea maxlength="20000" rows="4" aria-label="评论正文" required></textarea><div><button type="submit" class="secondary">发表评论</button><button type="button" class="quiet cancel" hidden>取消</button></div></form><p role="status" class="comment-status"></p><div class="comment-list"></div>';
  const form = host.querySelector("form"),
    input = host.querySelector("textarea"),
    status = host.querySelector('[role="status"]');
  input.value = sessionStorage.getItem(draftKey) || "";
  input.oninput = () => sessionStorage.setItem(draftKey, input.value);
  const fail = (e) => {
    status.textContent = e.message;
    status.classList.add("error");
  };
  async function rpc(name, args) {
    const { data, error } = await cloud().rpc(name, args);
    if (error) throw error;
    return data;
  }
  function buttons(item, id = "") {
    return `<button class="quiet" data-vote="1" data-id="${id}" aria-pressed="${item.my_vote === 1}" aria-label="赞">赞 ${item.upvotes}</button><button class="quiet" data-vote="-1" data-id="${id}" aria-pressed="${item.my_vote === -1}" aria-label="踩">踩 ${item.downvotes}</button>`;
  }
  function clearContext() {
    reply = null;
    edit = null;
    host.querySelector(".reply-context").textContent = "";
    host.querySelector(".cancel").hidden = true;
  }
  host.querySelector(".cancel").onclick = () => {
    clearContext();
    input.value = sessionStorage.getItem(draftKey) || "";
  };
  async function refresh() {
    const current = ++generation;
    const [s, comments, votes] = await Promise.all([
      session(),
      rpc("read_comments", { p_thread: thread }),
      rpc("read_page_votes", { p_thread: thread }),
    ]);
    if (disposed || current !== generation) return;
    user = s;
    rows = comments;
    host.querySelector(".page-votes").innerHTML =
      "<span>这篇内容怎么样？</span>" + buttons(votes[0]);
    form.querySelector('[type="submit"]').textContent = user
      ? "发表评论"
      : "使用 GitHub 登录后评论";
    const list = host.querySelector(".comment-list");
    list.replaceChildren();
    if (!rows.length)
      list.innerHTML = '<p class="muted">还没有评论，欢迎留下第一条。</p>';
    const children = new Map();
    for (const row of rows) {
      const key = row.parent_id || "";
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(row);
    }
    const stack = (children.get("") || [])
      .slice()
      .reverse()
      .map((r) => ({ r, depth: 0 }));
    while (stack.length) {
      const { r, depth } = stack.pop();
      const el = document.createElement("article");
      el.className = "comment";
      el.style.marginInlineStart = Math.min(depth, 4) * 16 + "px";
      let body;
      try {
        body = renderMarkdown(r.body);
      } catch {
        body = `<pre>${esc(r.body)}</pre>`;
      }
      el.innerHTML = `<header><a href="https://github.com/${encodeURIComponent(r.author)}" target="_blank" rel="noopener">${esc(r.author)}</a><time>${esc(new Date(r.created_at).toLocaleString("zh-CN"))}</time>${r.source_url ? `<a href="${esc(r.source_url)}" target="_blank" rel="noopener">旧站评论 ↗</a>` : ""}</header>${depth ? '<small class="muted">回复 ' + esc(rows.find((x) => x.id === r.parent_id)?.author || "") + "</small>" : ""}<div class="prose">${r.deleted ? '<p class="muted">此评论已删除</p>' : body}</div><footer>${!r.deleted ? buttons(r, r.id) : ""}<button class="quiet" data-reply="${r.id}">回复</button>${r.mine && !r.deleted ? `<button class="quiet" data-edit="${r.id}">编辑</button><button class="quiet" data-delete="${r.id}">删除</button>` : ""}</footer>`;
      list.append(el);
      for (const child of (children.get(r.id) || []).slice().reverse())
        stack.push({ r: child, depth: depth + 1 });
    }
    host.querySelectorAll("[data-vote]").forEach(
      (button) =>
        (button.onclick = async () => {
          if (!user) {
            await signIn().catch(fail);
            return;
          }
          button.disabled = true;
          try {
            const id = button.dataset.id || null;
            const value = Number(button.dataset.vote);
            const row = id ? rows.find((r) => r.id === id) : votes[0];
            await rpc("vote", {
              p_thread: thread,
              p_comment: id,
              p_value: row.my_vote === value ? 0 : value,
            });
            await refresh();
          } catch (e) {
            fail(e);
            button.disabled = false;
          }
        }),
    );
    host.querySelectorAll("[data-reply],[data-edit]").forEach(
      (button) =>
        (button.onclick = () => {
          const id = button.dataset.reply || button.dataset.edit;
          const r = rows.find((x) => x.id === id);
          edit = button.dataset.edit || null;
          reply = edit ? null : id;
          host.querySelector(".reply-context").textContent = edit
            ? "编辑评论"
            : "回复 " + r.author;
          host.querySelector(".cancel").hidden = false;
          if (edit) input.value = r.body;
          input.focus();
        }),
    );
    host.querySelectorAll("[data-delete]").forEach(
      (button) =>
        (button.onclick = async () => {
          if (!confirm("删除这条评论？回复仍会保留。")) return;
          button.disabled = true;
          try {
            await rpc("write_comment", {
              p_thread: thread,
              p_body: "",
              p_id: button.dataset.delete,
              p_delete: true,
            });
            await refresh();
          } catch (e) {
            fail(e);
            button.disabled = false;
          }
        }),
    );
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      await signIn().catch(fail);
      return;
    }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await rpc("write_comment", {
        p_thread: thread,
        p_body: input.value,
        p_parent: reply,
        p_id: edit,
      });
      input.value = "";
      sessionStorage.removeItem(draftKey);
      clearContext();
      await refresh();
      status.textContent = "已保存";
      status.classList.remove("error");
    } catch (error) {
      fail(error);
    } finally {
      button.disabled = false;
    }
  };
  const changed = () => refresh().catch(fail);
  window.addEventListener("account-change", changed);
  await refresh().catch(fail);
  return () => {
    disposed = true;
    generation++;
    window.removeEventListener("account-change", changed);
  };
}
