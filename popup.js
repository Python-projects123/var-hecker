const api = globalThis.browser || globalThis.chrome;
const statusEl = document.getElementById("status");
const variablesEl = document.getElementById("variables");
const refreshButton = document.getElementById("refresh");
let currentTabId = null;

async function getFrames(tabId) {
  try { return await api.webNavigation.getAllFrames({ tabId }) || [{ frameId: 0 }]; }
  catch { return [{ frameId: 0 }]; }
}

async function askFrame(tabId, frameId, action, data = {}) {
  try {
    return await api.tabs.sendMessage(tabId, { type: "SVE_REQUEST", action, data }, { frameId });
  } catch { return null; }
}

function showStatus(message) { statusEl.textContent = message; }

function renderVariables(variables) {
  variablesEl.replaceChildren();
  if (!variables.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No variables found.";
    variablesEl.append(empty);
    return;
  }
  for (const variable of variables) {
    const card = document.createElement("div"); card.className = "variable";
    const name = document.createElement("div"); name.className = "var-name"; name.textContent = variable.name;
    const target = document.createElement("div"); target.className = "var-target";
    target.textContent = `${variable.isStage ? "Stage" : variable.targetName} · Frame ${variable.frameId}`;
    const current = document.createElement("div"); current.className = "var-current";
    current.textContent = `Current value: ${String(variable.value)}`;
    const controls = document.createElement("div"); controls.className = "controls";
    const input = document.createElement("input"); input.value = String(variable.value);
    input.setAttribute("aria-label", `New value for ${variable.name}`);
    const save = document.createElement("button"); save.textContent = "Set";
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        const result = await askFrame(currentTabId, variable.frameId, "set", {
          targetId: variable.targetId, targetIndex: variable.targetIndex,
          variableId: variable.variableId, value: input.value
        });
        if (!result) showStatus("Could not communicate with that frame.");
        else if (result.error) showStatus(result.error);
        else { current.textContent = `Current value: ${String(result.value)}`; showStatus(`Updated "${variable.name}".`); }
      } catch (error) { showStatus(error.message); }
      finally { save.disabled = false; }
    });
    controls.append(input, save); card.append(name, target, current, controls); variablesEl.append(card);
  }
}

async function refresh() {
  refreshButton.disabled = true; variablesEl.replaceChildren(); showStatus("Searching project frames...");
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https:\/\/ninja\.greninja\.xyz\//.test(tab.url || "")) {
      showStatus("Open a project on ninja.greninja.xyz first."); return;
    }
    currentTabId = tab.id;
    const frames = await getFrames(tab.id); const found = []; const errors = [];
    for (const frame of frames) {
      const result = await askFrame(tab.id, frame.frameId, "list");
      if (result?.variables) for (const variable of result.variables) found.push({ ...variable, frameId: frame.frameId });
      else if (result?.error) errors.push(result.error);
    }
    const unique = []; const seen = new Set();
    for (const variable of found) {
      const key = [variable.frameId, variable.targetId, variable.targetIndex, variable.variableId].join(":");
      if (!seen.has(key)) { seen.add(key); unique.push(variable); }
    }
    renderVariables(unique);
    if (unique.length) showStatus(`${unique.length} variables found.`);
    else showStatus(errors[0] || "No variables found. The project's runtime may not be exposed.");
  } catch (error) { showStatus(`Error: ${error.message}`); }
  finally { refreshButton.disabled = false; }
}
refreshButton.addEventListener("click", refresh);
refresh();
