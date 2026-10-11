(() => {
  if (window.__sveContentInstalled) return;
  window.__sveContentInstalled = true;
  const pending = new Map();
  let nextId = 0;
  const api = globalThis.browser || globalThis.chrome;

  function sendToPage(action, data = {}) {
    return new Promise(resolve => {
      const id = `sve-${Date.now()}-${++nextId}`;
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ error: "No response from the project page." });
      }, 2500);
      pending.set(id, result => { clearTimeout(timer); resolve(result); });
      window.postMessage({ source: "sve-extension", id, action, data }, "*");
    });
  }

  window.addEventListener("message", event => {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.source !== "sve-page") return;
    const callback = pending.get(message.id);
    if (callback) { pending.delete(message.id); callback(message.result); }
  });

  const script = document.createElement("script");
  script.src = api.runtime.getURL("page.js");
  script.onload = () => script.remove();
  script.onerror = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "SVE_REQUEST") return;
    sendToPage(message.action, message.data || {}).then(sendResponse);
    return true;
  });
})();
