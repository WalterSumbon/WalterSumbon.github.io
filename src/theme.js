/** 在绘制页面前确定主题；显式选择优先于系统设置。 */
(() => {
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const root = document.documentElement;
  let preference = null;
  try {
    preference = localStorage.getItem("site-theme");
  } catch (error) {
    console.warn("无法读取主题偏好", error);
  }
  if (!["light", "dark"].includes(preference)) preference = null;
  function apply() {
    const dark = preference ? preference === "dark" : system.matches;
    root.dataset.theme = dark ? "dark" : "light";
    const button = document.getElementById("theme-toggle");
    if (button) {
      button.setAttribute("aria-checked", String(dark));
      button.title = dark ? "切换到日间模式" : "切换到夜间模式";
    }
  }
  apply();
  system.addEventListener("change", () => {
    if (!preference) apply();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === "site-theme") {
      preference = ["light", "dark"].includes(event.newValue)
        ? event.newValue
        : null;
      apply();
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    apply();
    document.getElementById("theme-toggle").addEventListener("click", () => {
      preference = root.dataset.theme === "dark" ? "light" : "dark";
      apply();
      try {
        localStorage.setItem("site-theme", preference);
      } catch (error) {
        console.warn("无法保存主题偏好", error);
      }
    });
  });
})();
