function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// cyrb53: fast, deterministic, non-cryptographic — good enough to detect text
// changes without storing the full vacancy text in browser.storage.local.
function hashString(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

async function getSavedVacancies() {
  const { savedVacancies = {} } = await browser.storage.local.get("savedVacancies");
  return savedVacancies;
}

async function markVacancySaved(url, { filename, hash }) {
  const savedVacancies = await getSavedVacancies();
  savedVacancies[url] = { filename, hash, savedAt: Date.now() };
  await browser.storage.local.set({ savedVacancies });
}

async function fileStillExists(filename) {
  const { exists } = await browser.runtime.sendMessage({ type: "checkFileExists", filename });
  return exists;
}

async function getServerSavedVacancies() {
  const { serverSavedVacancies = {} } = await browser.storage.local.get("serverSavedVacancies");
  return serverSavedVacancies;
}

async function markVacancyServerSaved(url, { id, hash }) {
  const serverSavedVacancies = await getServerSavedVacancies();
  serverSavedVacancies[url] = { id, hash, savedAt: Date.now() };
  await browser.storage.local.set({ serverSavedVacancies });
}

function extractMails(text) {
  return [...new Set(text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || [])];
}

function sanitizeFilename(name) {
  return name.replace(/[\\/*?:"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 150);
}

function htmlToMarkdown(node) {
  let out = "";
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent;
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const tag = child.tagName.toLowerCase();
    switch (tag) {
      case "br":
        out += "\n";
        break;
      case "p":
      case "div":
        out += htmlToMarkdown(child).trim() + "\n\n";
        break;
      case "strong":
      case "b":
        out += `**${htmlToMarkdown(child).trim()}**`;
        break;
      case "em":
      case "i":
        out += `*${htmlToMarkdown(child).trim()}*`;
        break;
      case "a":
        out += `[${htmlToMarkdown(child).trim()}](${child.href})`;
        break;
      case "ul":
      case "ol":
        out += Array.from(child.children)
          .map((li) => `- ${htmlToMarkdown(li).trim()}`)
          .join("\n") + "\n\n";
        break;
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        out += `${"#".repeat(Number(tag[1]))} ${htmlToMarkdown(child).trim()}\n\n`;
        break;
      case "script":
      case "style":
        break;
      default:
        out += htmlToMarkdown(child);
    }
  }
  return out;
}

async function findEnabledAdapter() {
  const adapters = window.SCRAPER_ADAPTERS || [];
  const candidate = adapters.find((a) => {
    try {
      return a.match();
    } catch {
      return false;
    }
  });
  if (!candidate) return null;

  const { disabledAdapters = {} } = await browser.storage.local.get("disabledAdapters");
  if (disabledAdapters[candidate.id]) return null;
  return candidate;
}

const SAVE_BUTTON_COLORS = {
  unsaved: "#2ecc71",
  changed: "#f39c12",
  saved: "#95a5a6",
};

const SERVER_BUTTON_COLORS = {
  unsaved: "#3498db",
  changed: "#f39c12",
  saved: "#95a5a6",
  error: "#e74c3c",
};

function setButtonStyle(button, colors, colorKey) {
  button.style.background = colors[colorKey];
  button.style.cursor = colorKey === "saved" ? "default" : "pointer";
}

function setPreviewButton(previewButton, entry) {
  if (!entry) {
    previewButton.style.display = "none";
    previewButton.onclick = null;
    return;
  }
  previewButton.style.display = "block";
  previewButton.onclick = () => browser.runtime.sendMessage({ type: "openFile", filename: entry.filename });
}

async function refreshSaveButtonState(adapter, button, previewButton) {
  const { content } = adapter.extractVacancy();
  if (!content) {
    button.textContent = await t("noContent");
    setButtonStyle(button, SAVE_BUTTON_COLORS, "unsaved");
    button.disabled = true;
    setPreviewButton(previewButton, null);
    return;
  }

  const savedVacancies = await getSavedVacancies();
  const entry = savedVacancies[location.href];
  const onDisk = entry ? await fileStillExists(entry.filename) : false;

  if (onDisk && entry.hash === hashString(content)) {
    button.textContent = await t("alreadySaved");
    setButtonStyle(button, SAVE_BUTTON_COLORS, "saved");
    button.disabled = true;
    setPreviewButton(previewButton, entry);
  } else if (onDisk) {
    button.textContent = await t("changedSaveButton");
    setButtonStyle(button, SAVE_BUTTON_COLORS, "changed");
    button.disabled = false;
    setPreviewButton(previewButton, entry);
  } else {
    button.textContent = await t("saveButton");
    setButtonStyle(button, SAVE_BUTTON_COLORS, "unsaved");
    button.disabled = false;
    setPreviewButton(previewButton, null);
  }
}

function createEditorPanel() {
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;top:0;right:0;width:420px;height:100vh;z-index:100000;display:none;" +
    "flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;" +
    "background:#1e1e1e;color:#eee;box-shadow:-2px 0 8px rgba(0,0,0,.4);font-family:monospace;";

  const status = document.createElement("div");
  status.style.cssText = "font-size:12px;color:#aaa;";

  const textarea = document.createElement("textarea");
  textarea.style.cssText =
    "flex:1;width:100%;background:#111;color:#eee;border:1px solid #444;" +
    "padding:8px;resize:none;font-family:monospace;font-size:13px;box-sizing:border-box;";

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:8px;";

  const commitBtn = document.createElement("button");
  commitBtn.style.cssText =
    "flex:1;padding:8px;background:#2ecc71;color:#000;border:none;border-radius:6px;cursor:pointer;";

  const closeBtn = document.createElement("button");
  closeBtn.style.cssText =
    "padding:8px 12px;background:#555;color:#fff;border:none;border-radius:6px;cursor:pointer;";
  closeBtn.addEventListener("click", () => {
    panel.style.display = "none";
  });

  actions.appendChild(commitBtn);
  actions.appendChild(closeBtn);
  panel.appendChild(status);
  panel.appendChild(textarea);
  panel.appendChild(actions);
  document.body.appendChild(panel);

  return { panel, status, textarea, commitBtn, closeBtn };
}

async function openEditorPanel(editor, id) {
  editor.panel.style.display = "flex";
  editor.textarea.disabled = true;
  editor.commitBtn.disabled = true;
  editor.commitBtn.textContent = await t("editorCommitButton");
  editor.closeBtn.textContent = await t("editorCloseButton");
  editor.status.textContent = await t("editorLoading");

  try {
    const res = await browser.runtime.sendMessage({ type: "getServerVacancyRaw", id });
    if (!res.exists) {
      editor.status.textContent = await t("editorNotFound");
      return;
    }
    editor.textarea.value = res.text;
    editor.textarea.disabled = false;
    editor.commitBtn.disabled = false;
    editor.status.textContent = "";
  } catch (err) {
    editor.status.textContent = `${await t("serverSaveError")}: ${err.message}`;
  }
}

async function commitEditorChanges(editor, id, adapter, serverBtn, previewBtn) {
  editor.commitBtn.disabled = true;
  editor.status.textContent = await t("editorCommitting");

  try {
    const { vacancy } = await browser.runtime.sendMessage({ type: "saveVacancyRaw", id, text: editor.textarea.value });
    const hash = hashString(JSON.stringify({
      id, title: vacancy.title, company: vacancy.company, description: vacancy.description, mails: vacancy.mails,
    }));
    await markVacancyServerSaved(location.href, { id, hash });
    editor.status.textContent = await t("editorCommitted");
    await refreshServerButtonState(adapter, serverBtn, previewBtn, editor);
  } catch (err) {
    editor.status.textContent = `${await t("serverSaveError")}: ${err.message}`;
  } finally {
    editor.commitBtn.disabled = false;
  }
}

function setServerPreviewButton(previewBtn, entry, onOpen) {
  if (!entry) {
    previewBtn.style.display = "none";
    previewBtn.onclick = null;
    return;
  }
  previewBtn.style.display = "block";
  previewBtn.onclick = () => onOpen(entry.id);
}

function serverPayload(adapter) {
  const { filename, content, title, company } = adapter.extractVacancy();
  if (!content) return null;
  return { id: filename, title, company, url: location.href, description: content, mails: extractMails(content) };
}

async function refreshServerButtonState(adapter, button, previewBtn, editor) {
  const payload = serverPayload(adapter);
  if (!payload) {
    button.textContent = await t("noContent");
    setButtonStyle(button, SERVER_BUTTON_COLORS, "unsaved");
    button.disabled = true;
    setServerPreviewButton(previewBtn, null);
    return;
  }

  const hash = hashString(JSON.stringify(payload));
  const serverSavedVacancies = await getServerSavedVacancies();
  const entry = serverSavedVacancies[location.href];
  const onOpen = (id) => openEditorPanel(editor, id);

  if (entry && entry.hash === hash) {
    button.textContent = await t("alreadySavedToServer");
    setButtonStyle(button, SERVER_BUTTON_COLORS, "saved");
    button.disabled = true;
    setServerPreviewButton(previewBtn, entry, onOpen);
  } else if (entry) {
    button.textContent = await t("changedSaveToServerButton");
    setButtonStyle(button, SERVER_BUTTON_COLORS, "changed");
    button.disabled = false;
    setServerPreviewButton(previewBtn, entry, onOpen);
  } else {
    button.textContent = await t("saveToServerButton");
    setButtonStyle(button, SERVER_BUTTON_COLORS, "unsaved");
    button.disabled = false;
    setServerPreviewButton(previewBtn, null);
  }

  editor.commitBtn.onclick = () => commitEditorChanges(editor, payload.id, adapter, button, previewBtn);
}

async function saveCurrentVacancyToServer(adapter, button, previewBtn, editor) {
  const payload = serverPayload(adapter);
  if (!payload) return;

  button.disabled = true;
  button.textContent = await t("savingToServer");

  try {
    await browser.runtime.sendMessage({ type: "saveToServer", ...payload });
    await markVacancyServerSaved(location.href, { id: payload.id, hash: hashString(JSON.stringify(payload)) });
    button.textContent = await t("savedToServer");
    setTimeout(() => refreshServerButtonState(adapter, button, previewBtn, editor), 1500);
  } catch (err) {
    button.textContent = `${await t("serverSaveError")}: ${err.message}`;
    setButtonStyle(button, SERVER_BUTTON_COLORS, "error");
    button.disabled = false;
  }
}

async function saveCurrentVacancy(adapter, button, previewButton) {
  button.disabled = true;
  button.textContent = await t("saving");

  const { filename, content } = adapter.extractVacancy();
  if (!content) {
    button.textContent = await t("noContent");
    button.disabled = false;
    return;
  }

  await browser.runtime.sendMessage({ type: "save", filename, content });
  await markVacancySaved(location.href, { filename, hash: hashString(content) });
  button.textContent = await t("saved");
  setTimeout(() => refreshSaveButtonState(adapter, button, previewButton), 1500);
}

function findMoreButton(adapter) {
  return Array.from(document.querySelectorAll("a, button"))
    .find((el) => el.textContent.trim().startsWith(adapter.moreButtonText) && el.offsetParent !== null);
}

async function loadAllVacancies(adapter, button) {
  button.disabled = true;
  let count = 0;
  let btn;
  while ((btn = findMoreButton(adapter))) {
    btn.click();
    count++;
    button.textContent = await t("loadingMore", count);
    await sleep(1200);
  }
  button.textContent = await t("doneNoMore");
  button.disabled = false;
}

async function addButton(adapter) {
  const btn = document.createElement("button");
  btn.style.cssText =
    "position:fixed;top:80px;right:20px;z-index:99999;padding:10px 16px;" +
    "background:#2ecc71;color:#000;border:none;border-radius:6px;cursor:pointer;" +
    "font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.3);";

  if (adapter.isListingPage()) {
    btn.textContent = await t("loadMoreButton");
    btn.addEventListener("click", () => loadAllVacancies(adapter, btn));
    document.body.appendChild(btn);
    return;
  }

  const previewBtn = document.createElement("button");
  previewBtn.style.cssText =
    "position:fixed;top:130px;right:20px;z-index:99999;padding:8px 14px;display:none;" +
    "background:#3498db;color:#fff;border:none;border-radius:6px;cursor:pointer;" +
    "font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.3);";
  previewBtn.textContent = await t("previewButton");

  await refreshSaveButtonState(adapter, btn, previewBtn);
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    saveCurrentVacancy(adapter, btn, previewBtn);
  });

  const serverBtn = document.createElement("button");
  serverBtn.style.cssText =
    "position:fixed;top:180px;right:20px;z-index:99999;padding:10px 16px;" +
    "color:#fff;border:none;border-radius:6px;cursor:pointer;" +
    "font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.3);";

  const serverPreviewBtn = document.createElement("button");
  serverPreviewBtn.style.cssText =
    "position:fixed;top:230px;right:20px;z-index:99999;padding:8px 14px;display:none;" +
    "background:#9b59b6;color:#fff;border:none;border-radius:6px;cursor:pointer;" +
    "font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.3);";
  serverPreviewBtn.textContent = await t("serverPreviewButton");

  const editor = createEditorPanel();

  await refreshServerButtonState(adapter, serverBtn, serverPreviewBtn, editor);
  serverBtn.addEventListener("click", () => {
    if (serverBtn.disabled) return;
    saveCurrentVacancyToServer(adapter, serverBtn, serverPreviewBtn, editor);
  });

  document.body.appendChild(btn);
  document.body.appendChild(previewBtn);
  document.body.appendChild(serverBtn);
  document.body.appendChild(serverPreviewBtn);
}

(async () => {
  const adapter = await findEnabledAdapter();
  if (adapter) await addButton(adapter);
})();
