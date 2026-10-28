import { cloud, session, signIn } from "./services.js";
import { escapeHTML as esc } from "./content.js";
/** 全站共用一个 Supabase 会话；状态事件不重新挂载正在运行的游戏。 */
export async function initAccount(host) {
  function render(s) {
    host.innerHTML = s
      ? `<img class="account-avatar" src="https://github.com/${encodeURIComponent(s.user.user_metadata.user_name || "")}.png?size=48" alt="" width="24" height="24"><span class="account-name">${esc(s.user.user_metadata.user_name || "GitHub 用户")}</span><button class="quiet" data-logout>退出</button>`
      : '<button class="secondary" data-login>GitHub 登录</button>';
    host
      .querySelector("[data-login]")
      ?.addEventListener("click", () => signIn().catch(showError));
    host.querySelector("[data-logout]")?.addEventListener("click", async () => {
      const { error } = await cloud().auth.signOut();
      if (error) showError(error);
    });
  }
  function showError(e) {
    let p = host.querySelector('[role="alert"]');
    if (!p) {
      p = document.createElement("span");
      p.role = "alert";
      host.append(p);
    }
    p.textContent = e.message;
  }
  render(await session());
  cloud().auth.onAuthStateChange((event, s) => {
    render(s);
    if (["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event))
      setTimeout(
        () => window.dispatchEvent(new CustomEvent("account-change")),
        0,
      );
  });
}
