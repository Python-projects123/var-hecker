(() => {
  if (window.__svePageInstalled) return;
  window.__svePageInstalled = true;

  function looksLikeVM(value) {
    try {
      return Boolean(value && value.runtime && Array.isArray(value.runtime.targets) &&
        value.runtime.targets.some(target => target && target.variables));
    } catch { return false; }
  }

  function findVM() {
    const candidates = [window.vm, window.Scratch?.vm, window.__scratchVM, window.scaffolding?.vm];
    for (const candidate of candidates) if (looksLikeVM(candidate)) return candidate;
    try {
      for (const key of Object.keys(window)) {
        let value;
        try { value = window[key]; } catch { continue; }
        if (looksLikeVM(value)) return value;
        if (looksLikeVM(value?.vm)) return value.vm;
      }
    } catch {}
    return null;
  }

  function listVariables() {
    const vm = findVM();
    if (!vm) return { error: "Scratch VM not exposed in this frame. The project may use an isolated or private runtime." };
    const variables = [];
    vm.runtime.targets.forEach((target, targetIndex) => {
      for (const variable of Object.values(target.variables || {})) {
        variables.push({
          name: variable.name, value: variable.value, variableId: variable.id,
          targetId: target.id ?? null, targetIndex,
          targetName: target.getName?.() || target.sprite?.name || (target.isStage ? "Stage" : "Sprite"),
          isStage: Boolean(target.isStage), type: variable.type ?? ""
        });
      }
    });
    return { variables };
  }

  function setVariable(data) {
    const vm = findVM();
    if (!vm) return { error: "Scratch VM not found in this frame." };
    const targets = vm.runtime.targets;
    let target = data.targetId != null ? targets.find(t => t.id === data.targetId) : null;
    if (!target && Number.isInteger(data.targetIndex)) target = targets[data.targetIndex];
    if (!target) return { error: "Target not found. Refresh the variable list." };
    const variable = target.variables?.[data.variableId];
    if (!variable) return { error: "Variable not found. Refresh the list." };
    const raw = String(data.value);
    const numeric = Number(raw);
    variable.value = raw.trim() !== "" && Number.isFinite(numeric) ? numeric : raw;
    return { success: true, value: variable.value };
  }

  window.addEventListener("message", event => {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.source !== "sve-extension") return;
    let result;
    try {
      if (message.action === "list") result = listVariables();
      else if (message.action === "set") result = setVariable(message.data || {});
      else result = { error: "Unknown action." };
    } catch (error) { result = { error: String(error) }; }
    window.postMessage({ source: "sve-page", id: message.id, result }, "*");
  });
})();
