let activeCancel;

/** 在页面内确认操作；离开页面或按 Escape 时取消。 */
export function confirmAction(message) {
  activeCancel?.();
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "site-confirm";
    dialog.setAttribute("aria-labelledby", "confirm-title");
    dialog.setAttribute("aria-describedby", "confirm-message");
    dialog.innerHTML = `<h2 id="confirm-title">确认操作</h2><p id="confirm-message"></p><div class="confirm-actions"><button class="secondary cancel" autofocus>取消</button><button class="primary accept">确认</button></div>`;
    dialog.querySelector("p").textContent = message;
    const previous = document.activeElement;
    function finish(accepted) {
      window.removeEventListener("hashchange", cancel);
      dialog.close();
      dialog.remove();
      activeCancel = undefined;
      if (previous?.isConnected) previous.focus();
      resolve(accepted);
    }
    const cancel = () => finish(false);
    activeCancel = cancel;
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      cancel();
    });
    dialog.querySelector(".cancel").onclick = cancel;
    dialog.querySelector(".accept").onclick = () => finish(true);
    window.addEventListener("hashchange", cancel);
    document.body.append(dialog);
    dialog.showModal();
  });
}
