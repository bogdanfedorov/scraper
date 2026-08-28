function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getSavedVacancies() {
  const { savedVacancies = {} } = await browser.storage.local.get("savedVacancies");
  return savedVacancies;
}

async function markVacancySaved(url, { filename, content }) {
  const savedVacancies = await getSavedVacancies();
  savedVacancies[url] = { filename, content, savedAt: Date.now() };
  await browser.storage.local.set({ savedVacancies });
}

async function fileStillExists(filename) {
  const { exists } = await browser.runtime.sendMessage({ type: "checkFileExists", filename });
  return exists;
}

function sanitizeFilename(name) {
  return name.replace(/[\\/*?:"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 150);
}
/**/
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

function setSaveButtonStyle(button, colorKey) {
  button.style.background = SAVE_BUTTON_COLORS[colorKey];
  button.style.cursor = colorKey === "saved" ? "default" : "pointer";
}

function showPreviewModal(content) {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.5);" +
    "display:flex;align-items:center;justify-content:center;";

  const box = document.createElement("pre");
  box.textContent = content;
  box.style.cssText =
    "max-width:80vw;max-height:80vh;overflow:auto;background:#fff;color:#111;" +
    "padding:20px 24px;border-radius:8px;white-space:pre-wrap;font-size:13px;" +
    "font-family:inherit;box-shadow:0 4px 24px rgba(0,0,0,.4);";

  overlay.appendChild(box);
  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
}

function setPreviewButton(previewButton, content) {
  if (!content) {
    previewButton.style.display = "none";
    previewButton.onclick = null;
    return;
  }
  previewButton.style.display = "block";
  previewButton.onclick = () => showPreviewModal(content);
}

async function refreshSaveButtonState(adapter, button, previewButton) {
  const { content } = adapter.extractVacancy();
  if (!content) {
    button.textContent = await t("noContent");
    setSaveButtonStyle(button, "unsaved");
    button.disabled = true;
    setPreviewButton(previewButton, null);
    return;
  }

  const savedVacancies = await getSavedVacancies();
  const entry = savedVacancies[location.href];
  const onDisk = entry ? await fileStillExists(entry.filename) : false;

  if (onDisk && entry.content === content) {
    button.textContent = await t("alreadySaved");
    setSaveButtonStyle(button, "saved");
    button.disabled = true;
    setPreviewButton(previewButton, entry.content);
  } else if (onDisk) {
    button.textContent = await t("changedSaveButton");
    setSaveButtonStyle(button, "changed");
    button.disabled = false;
    setPreviewButton(previewButton, entry.content);
  } else {
    button.textContent = await t("saveButton");
    setSaveButtonStyle(button, "unsaved");
    button.disabled = false;
    setPreviewButton(previewButton, null);
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
  await markVacancySaved(location.href, { filename, content });
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

  document.body.appendChild(btn);
  document.body.appendChild(previewBtn);
}

(async () => {
  const adapter = await findEnabledAdapter();
  if (adapter) await addButton(adapter);
})();
